#!/usr/bin/env bash
# forge k3s join — restores forge as the third etcd voter.
#
# Template = sentry-agent's PROVEN post-reimage join (v1.37.0+k3s1, rejoined
# successfully after its own reimage), with forge identity + GPU labels.
# Nixos-era args deliberately dropped: /nix/store kubelet config, audit-log
# flags, terminated-pod-gc, etcd compaction overrides (sentry runs fine
# without them; parity beats archaeology).
#
# Requires BEFORE first start (staged by the operator next to this script):
#   k3s-cluster-token          → installed to /var/lib/rancher/k3s/server/token
#   encryption-config.yaml     → /var/lib/rancher/k3s/server/cred/encryption-config.yaml
# (the encryption config must match the cluster's key or apiserver secrets
#  decryption breaks — copied from nexus, never regenerated)
#
# Run with:  sudo bash ~/install-k3s-forge.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "ERROR: run with sudo" >&2; exit 1; fi
if [ -x /usr/local/bin/k3s ]; then echo "k3s already installed — aborting to avoid clobber" >&2; exit 1; fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_SRC="${SCRIPT_DIR}/k3s-cluster-token"
ENC_SRC="${SCRIPT_DIR}/encryption-config.yaml"
for f in "$TOKEN_SRC" "$ENC_SRC"; do
  [ -s "$f" ] || { echo "ERROR: missing $f (stage it next to this script)" >&2; exit 1; }
done

# The apiserver on nexus must be reachable before we join
if ! timeout 5 bash -c "echo >/dev/tcp/10.1.1.120/6443" 2>/dev/null; then
  echo "ERROR: cannot reach 10.1.1.120:6443 — fix network first" >&2
  exit 1
fi

echo "==> installing token + encryption config"
mkdir -p /var/lib/rancher/k3s/server/cred
install -m 600 -o root -g root "$TOKEN_SRC" /var/lib/rancher/k3s/server/token
install -m 600 -o root -g root "$ENC_SRC"  /var/lib/rancher/k3s/server/cred/encryption-config.yaml

echo "==> installing k3s v1.37.0+k3s1 (server, joining https://10.1.1.120:6443)"
curl -sfL https://get.k3s.io | \
  INSTALL_K3S_VERSION="v1.37.0+k3s1" \
  INSTALL_K3S_CHANNEL_SKIP=true \
  sh -s - server \
  --server https://10.1.1.120:6443 \
  --token-file /var/lib/rancher/k3s/server/token \
  --node-name forge \
  --node-ip 10.1.1.130 \
  --data-dir /var/lib/rancher/k3s \
  --cluster-cidr 10.42.0.0/16 \
  --service-cidr 10.43.0.0/16 \
  --cluster-dns 10.43.0.10 \
  --write-kubeconfig-mode 644 \
  --disable traefik \
  --disable metrics-server \
  --flannel-backend none \
  --disable-network-policy \
  --tls-san 10.1.1.100 \
  --tls-san 10.1.1.110 \
  --tls-san 10.1.1.120 \
  --tls-san 10.1.1.130 \
  --tls-san 10.1.1.140 \
  --tls-san nexus \
  --tls-san forge \
  --tls-san sentry \
  --tls-san cluster.local \
  --tls-san localhost \
  --tls-san 127.0.0.1 \
  --kube-apiserver-arg encryption-provider-config=/var/lib/rancher/k3s/server/cred/encryption-config.yaml \
  --node-label accelerator=nvidia-gpu \
  --node-label gpu=amd

echo "==> waiting for node Ready (up to 5 min)"
for i in $(seq 1 30); do
  if k3s kubectl get node forge 2>/dev/null | grep -q Ready; then
    k3s kubectl get node forge -o wide
    echo "==> JOINED"
    exit 0
  fi
  sleep 10
done
echo "WARNING: joined but node not Ready within 5 min — check: journalctl -u k3s -e" >&2
exit 2
