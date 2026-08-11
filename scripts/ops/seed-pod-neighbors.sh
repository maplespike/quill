#!/usr/bin/env bash
# seed-pod-neighbors.sh — Calico host->pod ARP recovery (2026-08-10 incident)
#
# WHY THIS EXISTS
# ---------------
# On this cluster the pod netns sysctls are arp_ignore=2 / arp_announce=2 /
# arp_filter=1, so pods REFUSE host ARP requests that claim a source address
# outside the pod's own /32 subnet. Host->pod connectivity therefore depends
# entirely on the host neighbor entries seeded by the CNI plugin at ADD time
# and kept fresh by ongoing probes. If those entries lapse (pod recreation,
# node reboot, calico-node rollout), every pod whose entry needs re-resolution
# becomes unreachable and kubelet liveness probes kill it -> restart loop.
#
# This script re-seeds permanent host neighbor entries for every pod IP using
# the pod's real eth0 MAC (read from the veth's peer netns), restoring
# host->pod connectivity without waiting for ARP.
#
# USAGE
# -----
#   sudo bash scripts/ops/seed-pod-neighbors.sh
#
# Run on the cluster node (nexus) with sudo. Re-run after any pod churn,
# node reboot, or calico-node rollout — permanent entries do not survive a
# reboot. Safe to run repeatedly; `ip neigh replace` overwrites MACs for
# reused IPs.
set -u
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

echo '=== [0] MECHANISM: felix dataplaneMode + Installation linuxDataplane ==='
kubectl get felixconfiguration default -o jsonpath='felix.dataplaneMode={.spec.dataplaneMode}{"\n"}' 2>&1
kubectl get installation default -o jsonpath='install.linuxDataplane={.spec.linuxDataplane}{"\n"}' 2>&1

# NOTE: a node reboot wipes the entire host neighbor table. For durable
# recovery, run this script from a systemd unit / timer on nexus at boot
# (or after any calico-node rollout), not only by hand.
echo '=== [1] SEED PERMANENT HOST NEIGHBOR ENTRIES (running pods only) ==='
kubectl get pods -A --no-headers -o custom-columns=NS:.metadata.namespace,N:.metadata.name,IP:.status.podIP,PHASE:.status.phase 2>/dev/null | awk '$4 == "Running" {print $1, $2, $3}' | while read NSNAME PNAME PIP; do
  [ -z "$PIP" ] && continue
  PV=$(ip route get "$PIP" 2>/dev/null | grep -oE 'dev [a-z0-9]+' | awk '{print $2}')
  [ -z "$PV" ] && continue
  PNS=$(ip -o link show "$PV" 2>/dev/null | grep -oE 'link-netns [a-z0-9-]+' | awk '{print $2}')
  [ -z "$PNS" ] && continue
  PMAC=$(ip netns exec "$PNS" ip link show eth0 2>/dev/null | grep -oE 'link/ether [0-9a-f:]+' | awk '{print $2}')
  if [ -n "$PMAC" ]; then
    ip neigh replace "$PIP" dev "$PV" lladdr "$PMAC" nud permanent
    echo "seeded $PIP -> $PMAC dev $PV (ns $PNS, pod $NSNAME/$PNAME)"
  else
    echo "SKIP $PIP (no MAC in $PNS)"
  fi
done

echo '=== [2] PERMANENT ENTRIES NOW ==='
ip neigh | grep -c PERMANENT || true

echo '=== [3] VERIFY HOST->POD (all maplespike pods) ==='
sleep 2
for POD in $(kubectl get pods -n maplespike --no-headers -o custom-columns=N:.metadata.name 2>/dev/null | grep -E '^(quill-mcp|quill-portal|quill-api)'); do
  IP=$(kubectl get pod -n maplespike "$POD" -o jsonpath='{.status.podIP}' 2>/dev/null)
  [ -z "$IP" ] && continue
  PORT=8082; case "$POD" in *mcp*) PORT=3001;; *portal*) PORT=8080;; esac
  HTTP=$(timeout 4 curl -s -o /dev/null -w '%{http_code}' "http://$IP:$PORT/" 2>/dev/null || echo TIMEOUT)
  echo "HOST->$POD $IP:$PORT HTTP=$HTTP"
done

echo '=== [4] DEPLOYMENTS + POD STATES ==='
kubectl get deploy -n maplespike 2>&1 | head -5
kubectl get pods -n maplespike 2>&1 | grep -E 'quill-(mcp|portal|api)' | head -8
