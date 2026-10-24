#!/usr/bin/env bash
# Live breach-containment test for the maplespike namespace.
#
# Simulates a compromised quill pod (probe pod inside the namespace) and
# asserts it cannot reach the nodes, the LAN, the tailnet, or cluster APIs,
# while the legitimate flows (DNS, service mesh, tunnel, LAN proxy, internet)
# still work. Run from a machine with kubectl access to the cluster
# (zephyr). Exit 0 = containment intact, 1 = regression.
#
# The probe pods are removed on exit (trap), success or failure.
set -euo pipefail

NS=maplespike
EDGE_NS=cloudflared
ASTRAL_NS=astral-key
PROBE="netpol-probe-$$"
EDGE_PROBE="netpol-edge-$$"
K="kubectl"

command -v kubectl >/dev/null || { echo "kubectl not found" >&2; exit 2; }

cleanup() {
  "$K" -n "$NS" delete pod "$PROBE" --ignore-not-found --wait=false >/dev/null 2>&1 || true
  "$K" -n "$EDGE_NS" delete pod "$EDGE_PROBE" --ignore-not-found --wait=false >/dev/null 2>&1 || true
}
trap cleanup EXIT

ipof() { "$K" -n "$1" get pods -l "$2" -o jsonpath='{.items[0].status.podIP}' 2>/dev/null; }
svcof() { "$K" -n "$1" get svc "$2" -o jsonpath='{.spec.clusterIP}' 2>/dev/null; }

echo "== probe pods =="
"$K" -n "$NS" run "$PROBE" --image=busybox:stable --restart=Never \
  --command -- sleep 600 >/dev/null
"$K" -n "$EDGE_NS" run "$EDGE_PROBE" --image=busybox:stable --restart=Never \
  --command -- sleep 600 >/dev/null
"$K" -n "$NS" wait --for=condition=Ready "pod/$PROBE" --timeout=90s >/dev/null
"$K" -n "$EDGE_NS" wait --for=condition=Ready "pod/$EDGE_PROBE" --timeout=90s >/dev/null

NODES=$("$K" get nodes -o jsonpath='{range .items[*]}{.status.addresses[?(@.type=="InternalIP")].address}{"\n"}{end}')
CP=$(echo "$NODES" | head -1)

fail=0
expect() { # expect <blocked|ok> <description> <probe> <ip:port>
  local want=$1 desc=$2 probe=$3 target=$4 out
  if "$K" -n "$5" exec "$probe" -- timeout 3 nc -z "${target%:*}" "${target#*:}" >/dev/null 2>&1; then
    out=ok
  else
    out=blocked
  fi
  if [ "$out" = "$want" ]; then
    echo "ok   [$want] $desc"
  else
    echo "FAIL [expected $want, got $out] $desc ($target)" >&2
    fail=1
  fi
}

echo "== containment: the breached pod must NOT reach these =="
for ip in $NODES; do
  expect blocked "host ssh on $ip" "$PROBE" "$ip:22" "$NS"
  expect blocked "kubelet on $ip" "$PROBE" "$ip:10250" "$NS"
done
expect blocked "k3s api on $CP" "$PROBE" "$CP:6443" "$NS"
if [ -n "${TAILNET_PROBE_IP:-}" ]; then
  expect blocked "tailnet probe" "$PROBE" "$TAILNET_PROBE_IP:8080" "$NS"
else
  echo "SKIP tailnet probe — set TAILNET_PROBE_IP to test that path"
fi
expect blocked "grafana nodeport" "$PROBE" "$CP:30300" "$NS"

echo "== legitimate flows must still work =="
CLUSTER_DNS="${CLUSTER_DNS:-$(svcof kube-system kube-dns)}"
expect ok "cluster dns" "$PROBE" "${CLUSTER_DNS}:53" "$NS"
expect ok "internet" "$PROBE" "1.1.1.1:443" "$NS"
expect ok "portal service" "$PROBE" "$(svcof $NS quill-portal):8080" "$NS"
expect ok "api service" "$PROBE" "$(svcof $NS quill-api):8082" "$NS"
expect ok "redis service" "$PROBE" "$(svcof $NS quill-redis):6379" "$NS"
expect ok "astral-key service" "$PROBE" "$(svcof $ASTRAL_NS astral-key):8080" "$NS"

echo "== edge (tunnel namespace) must reach the three front doors =="
expect ok "edge->portal" "$EDGE_PROBE" "$(svcof $NS quill-portal):8080" "$EDGE_NS"
expect ok "edge->api" "$EDGE_PROBE" "$(svcof $NS quill-api):8082" "$EDGE_NS"
expect ok "edge->mcp" "$EDGE_PROBE" "$(svcof $NS quill-mcp):3001" "$EDGE_NS"

echo "== astral-key containment: auth sidecar must not reach hosts either =="
APROBE="$PROBE-astral"
"$K" -n "$ASTRAL_NS" run "$APROBE" --image=busybox:stable --restart=Never \
  --command -- sleep 600 >/dev/null
"$K" -n "$ASTRAL_NS" wait --for=condition=Ready "pod/$APROBE" --timeout=90s >/dev/null
expect blocked "host ssh" "$APROBE" "$CP:22" "$ASTRAL_NS"
expect blocked "kubelet" "$APROBE" "$CP:10250" "$ASTRAL_NS"
expect ok "internet (rpc endpoints)" "$APROBE" "1.1.1.1:443" "$ASTRAL_NS"
"$K" -n "$ASTRAL_NS" delete pod "$APROBE" --ignore-not-found --wait=false >/dev/null 2>&1 || true

if [ "$fail" -ne 0 ]; then
  echo "ISOLATION REGRESSION DETECTED" >&2
  exit 1
fi
echo "containment verified: hosts unreachable from the public namespace, legit flows intact"
