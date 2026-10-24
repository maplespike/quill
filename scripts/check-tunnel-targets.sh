#!/usr/bin/env bash
# Tunnel-target drift check.
#
# The Cloudflare tunnel config pins ClusterIPs (e.g. http://<cluster-ip>:8080).
# If a Service is deleted and recreated with a new ClusterIP, the tunnel goes
# dark silently. This check resolves every config target against the live
# cluster and exits non-zero on drift.
#
# Cluster-side check: run where kubectl works (zephyr).
set -euo pipefail

CFG=$(mktemp)
trap 'rm -f "$CFG"' EXIT

kubectl -n cloudflared get cm cloudflared-config -o jsonpath='{.data.config\.yaml}' > "$CFG"

fail=0
while IFS= read -r line; do
  ip_port=$(echo "$line" | sed -n 's/.*service: http:\/\/\([0-9.]*:[0-9]*\).*/\1/p')
  [ -z "$ip_port" ] && continue
  ip=${ip_port%:*}
  port=${ip_port#*:}

  found=$(kubectl get svc -A -o jsonpath="{range .items[?(@.spec.clusterIP=='$ip')]}{.metadata.namespace}/{.metadata.name}:{.spec.ports[0].port}{'\n'}{end}" | head -1)
  if [ -z "$found" ]; then
    echo "DRIFT: tunnel target $ip:$port matches no live Service" >&2
    fail=1
  else
    svc_port=${found##*:}
    if [ "$svc_port" = "$port" ]; then
      echo "ok   $ip:$port -> $found"
    else
      echo "DRIFT: $ip:$port -> $found (port changed: $svc_port)" >&2
      fail=1
    fi
  fi
done < "$CFG"

# name-based targets resolve via DNS and cannot drift; just list them.
grep -oE 'service: http://[a-z0-9.-]+\.svc\.cluster\.local:[0-9]+' "$CFG" | sed 's/^/     (dns)/' || true

if [ "$fail" -ne 0 ]; then
  echo "TUNNEL TARGET DRIFT DETECTED" >&2
  exit 1
fi
echo "tunnel targets match live services"
