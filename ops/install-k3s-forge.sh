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
# Run with:  sudo K3S_SERVER_IP=<server-lan-ip> K3S_NODE_IP=<this-node-lan-ip> \
#              K3S_TLS_SANS=<ip,ip,...> bash ~/install-k3s-forge.sh
#
# The addresses come from the environment, never from this file: a tracked
# script that hard-codes the cluster's LAN plan publishes the operator's
# network map (see "never put the ... LAN plan into a tracked file" in
# AGENTS.md).
set -euo pipefail

K3S_SERVER_IP="${K3S_SERVER_IP:?set K3S_SERVER_IP to the k3s server's LAN address}"
K3S_NODE_IP="${K3S_NODE_IP:?set K3S_NODE_IP to this node's LAN address}"
# Extra apiserver SANs, comma-separated (ingress VIPs, other nodes).
K3S_TLS_SANS="${K3S_TLS_SANS:-}"

if [ "$(id -u)" -ne 0 ]; then echo "ERROR: run with sudo" >&2; exit 1; fi
if [ -x /usr/local/bin/k3s ]; then echo "k3s already installed — aborting to avoid clobber" >&2; exit 1; fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_SRC="${SCRIPT_DIR}/k3s-cluster-token"
ENC_SRC="${SCRIPT_DIR}/encryption-config.yaml"
for f in "$TOKEN_SRC" "$ENC_SRC"; do
  [ -s "$f" ] || { echo "ERROR: missing $f (stage it next to this script)" >&2; exit 1; }
done

# The apiserver on nexus must be reachable before we join
if ! timeout 5 bash -c "echo >/dev/tcp/${K3S_SERVER_IP}/6443" 2>/dev/null; then
  echo "ERROR: cannot reach ${K3S_SERVER_IP}:6443 — fix network first" >&2
  exit 1
fi

echo "==> installing token + encryption config"
mkdir -p /var/lib/rancher/k3s/server/cred
install -m 600 -o root -g root "$TOKEN_SRC" /var/lib/rancher/k3s/server/token
install -m 600 -o root -g root "$ENC_SRC"  /var/lib/rancher/k3s/server/cred/encryption-config.yaml

# k3s convention: the cluster DNS service sits at the 10th address of the
# service CIDR. Derive it instead of hard-coding it.
K3S_SERVICE_CIDR="${K3S_SERVICE_CIDR:-10.43.0.0/16}"
CLUSTER_DNS="${K3S_SERVICE_CIDR%.0/16}.10"

echo "==> installing k3s v1.37.0+k3s1 (server, joining https://${K3S_SERVER_IP}:6443)"
curl -sfL https://get.k3s.io | \
  INSTALL_K3S_VERSION="v1.37.0+k3s1" \
  INSTALL_K3S_CHANNEL_SKIP=true \
  sh -s - server \
  --server "https://${K3S_SERVER_IP}:6443" \
  --token-file /var/lib/rancher/k3s/server/token \
  --node-name forge \
  --node-ip "${K3S_NODE_IP}" \
  --data-dir /var/lib/rancher/k3s \
  --cluster-cidr "${K3S_CLUSTER_CIDR:-10.42.0.0/16}" \
  --service-cidr "${K3S_SERVICE_CIDR:-10.43.0.0/16}" \
  --cluster-dns "${CLUSTER_DNS}" \
  --write-kubeconfig-mode 644 \
  --disable traefik \
  --disable metrics-server \
  --flannel-backend none \
  --disable-network-policy \
  --tls-san "nexus,forge,sentry${K3S_TLS_SANS:+,$K3S_TLS_SANS}" \
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
