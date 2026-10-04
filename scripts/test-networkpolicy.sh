#!/usr/bin/env bash
# Static validation of the quill network policies.
#
# Renders the chart exactly the way ArgoCD does (values-prod.yaml), extracts
# the NetworkPolicy documents, and asserts the properties the breach-
# containment guarantee depends on. Runs anywhere with helm + coreutils;
# no cluster access needed (see isolation-test.sh for the live proof).
#
# Every assertion below maps to a property that was verified live on
# 2026-09-25: a breached maplespike pod must not reach nodes, the LAN, the
# tailnet, or the kubelet/k3s APIs, while DNS + the tunnel + LAN proxy +
# quill->astral auth stay working.
set -euo pipefail

cd "$(dirname "$0")/.."
CHART=charts/quill
VALUES=$CHART/values-prod.yaml
RENDER=$(mktemp)
NETPOLS=$(mktemp)
trap 'rm -f "$RENDER" "$NETPOLS"' EXIT

HELM=${HELM:-helm}
command -v "$HELM" >/dev/null || { echo "helm not found" >&2; exit 2; }

fail=0
check() { # check <description> <expected-count> <pattern>
  local desc=$1 want=$2 pat=$3 got
  got=$(grep -cF -- "$pat" "$NETPOLS" || true)
  if [ "$got" = "$want" ]; then
    echo "ok   $desc"
  else
    echo "FAIL $desc (expected $want x '$pat', found $got)" >&2
    fail=1
  fi
}
present() { check "$1" 1 "$2"; }

echo "== render =="
"$HELM" lint "$CHART" -f "$VALUES" >/dev/null
"$HELM" template quill "$CHART" --namespace maplespike -f "$VALUES" > "$RENDER"
# scope all checks to NetworkPolicy documents (services/deployments also have ports)
awk 'BEGIN{RS="---"} /kind: NetworkPolicy/{print "---" $0}' "$RENDER" > "$NETPOLS"
echo "ok   chart renders"

echo "== policy set =="
check "exactly 8 NetworkPolicies" 8 "kind: NetworkPolicy"
present "default-deny exists" "name: quill-default-deny"
present "dns allow exists" "name: quill-allow-dns"
present "intra-namespace allow exists" "name: quill-allow-intra-namespace"
present "edge ingress allow exists" "name: quill-allow-edge-ingress"
present "monitoring metrics ingress allow exists" "name: quill-allow-monitoring-scrape"
present "monitoring namespace is the metrics ingress source" "kubernetes.io/metadata.name: monitoring"
check "API metrics port allowed only in monitoring policy" 1 "port: 9464"
check "MCP metrics port allowed only in monitoring policy" 1 "port: 9465"
present "astral-key egress allow exists" "name: quill-allow-egress-astral-key"
present "cluster-services egress allow exists" "name: quill-allow-cluster-services-egress"
present "internet egress allow exists" "name: quill-allow-internet-egress"

echo "== internet egress excludes every private range =="
present "excludes 10/8 (LAN, node net, svc net)" "10.0.0.0/8"
present "excludes 172.16/12" "172.16.0.0/12"
present "excludes 192.168/16 (pod net)" "192.168.0.0/16"
present "excludes 100.64/10 (tailnet, CGNAT)" "100.64.0.0/10"
present "excludes 169.254/16 (link-local)" "169.254.0.0/16"
present "excludes 127/8" "127.0.0.0/8"
check "0.0.0.0/0 appears exactly once (internet egress only)" 1 "cidr: 0.0.0.0/0"

echo "== node-subnet allowances are exactly the two ingress rules =="
check "10.1.1.0/24 appears exactly twice" 2 "cidr: 10.1.1.0/24"

echo "== service traffic allowances (counts across the 4 port-scoped rules) =="
check "service CIDR allowed exactly once" 1 "cidr: 10.43.0.0/16"
check "redis port (svc egress + intra ingress)" 2 "port: 6379"
check "portal port (svc egress + edge + intra + astral)" 4 "port: 8080"
check "api port (svc egress + edge + intra)" 3 "port: 8082"
check "mcp port (svc egress + edge + intra)" 3 "port: 3001"

echo "== allowed sources =="
present "tunnel connectors allowed" "kubernetes.io/metadata.name: cloudflared"
present "lan proxy allowed" "kubernetes.io/metadata.name: media-reverse-proxy"
present "astral-key reachable" "kubernetes.io/metadata.name: astral-key"
present "dns via kube-dns only" "k8s-app: kube-dns"

if [ "$fail" -ne 0 ]; then
  echo "NETPOL VALIDATION FAILED" >&2
  exit 1
fi
echo "all network policy assertions passed"
