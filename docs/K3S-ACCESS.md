
---
last-reviewed: 2026-05-19
status: active

||||||| e980c07
 origin/main
# K3s Cluster Access

MapleSpike runs on a 4-node K3s cluster: **zephyr**, **forge**, **sentry**, **nexus**.

## Prerequisites

- SSH key access to all 4 machines (shared `id_ed25519` + cert)
- `kubectl` installed on each machine

## kubeconfig Setup

K3s generates `/etc/rancher/k3s/k3s.yaml` on every node during install.
`kubectl` expects `~/.kube/config`. Create a symlink:

```bash
ln -sf /etc/rancher/k3s/k3s.yaml ~/.kube/config
```

## Automated Sync

Run from **zephyr** (has SSH access to all nodes):

```bash
# Check + fix all machines
./scripts/sync-kubeconfig.sh

# Check only, no changes
./scripts/sync-kubeconfig.sh --check
```

The script handles:
- Local machine (zephyr) — direct file operations
- Remote machines (forge, sentry, nexus) — SSH with `bash --norc --noprofile`
  to avoid fish shell / devenv terminal issues
- Creating `~/.kube/` directory if missing
- Wrong or stale symlink targets

## Verify

```bash
for host in zephyr forge sentry nexus; do
  echo "$host: $(ssh $host 'bash --norc --noprofile -c \"kubectl cluster-info 2>&1 | head -1\"' 2>/dev/null)"
done
```

Expected output shows each machine connected to the same K3s cluster.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Failed to get config: open ~/.kube/config: no such file or directory` | Missing symlink | Run `sync-kubeconfig.sh` |
| `The connection to the server localhost:8080 was refused` | kubeconfig points to wrong server | Check server field in `/etc/rancher/k3s/k3s.yaml` |
| SSH to forge/sentry fails with fish/devenv errors | Non-terminal shell | Use `bash --norc --noprofile` wrapper (script handles this) |