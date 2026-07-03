> ⚠️ **Historical artifact** — This document is preserved for context. The single source of truth for the active backlog is [`ROADMAP.md`](./ROADMAP.md). Do not edit without also updating ROADMAP.md.


# Plan: Issue #200 — Fix Multi-Machine K3s Access (Missing kubeconfig)

**Status**: Draft
**Created**: 2026-05-18
**Owner**: Sisyphus
**Issue**: https://github.com/reverb256/quill/issues/200
**Labels**: `bug`, `p1`, `k8s`

---

## Overview

Multi-machine K3s cluster access is inconsistent. `~/.kube/config` missing on forge (control-plane), sentry (control-plane), and nexus (control-plane). Only zephyr (worker) has it symlinked correctly.

### Current State

| Machine | Role | `~/.kube/config` | `kubectl` works | Fix needed |
|---------|------|-------------------|-----------------|------------|
| zephyr  | Worker | ✅ symlinked to `/etc/rancher/k3s/k3s.yaml` | ✅ | — |
| forge   | Control-plane | ❌ missing | ❌ (falls back to localhost:8080) | Symlink |
| sentry  | Control-plane | ❌ missing | ✅ (via NixOS env) | Symlink |
| nexus   | Control-plane | ❌ missing | ✅ (via NixOS env) | Symlink |

### Key Facts

- K3s config lives at `/etc/rancher/k3s/k3s.yaml` on all control-plane nodes (forge, sentry, nexus)
- zephyr is worker-only — also has `/etc/rancher/k3s/k3s.yaml` (can be a remote endpoint, check the actual file)
- Bare repo at `/srv/git/maplespike.git` must be accessible from all machines for worktree workflow
- SSH keys verified: forge ✅, sentry ✅, nexus (unknown)
- `git remote bare` must be configured on all machines
- pnpm/node versions must match (CI uses Node 22)

---

## Execution Plan

### Step 1: Symlink kubeconfig (per machine)

SSH into each machine and run:
```bash
mkdir -p ~/.kube
ln -sf /etc/rancher/k3s/k3s.yaml ~/.kube/config
```

Verify with `kubectl cluster-info` and `kubectl get nodes`.

**On zephyr** (current host): check if `/etc/rancher/k3s/k3s.yaml` is the local node config or a remote endpoint config. If it references localhost but forge is the API server, copy forge's config instead.

### Step 2: Verify bare repo access

On each machine:
```bash
git ls-remote bare
```

Should list refs without error. If SSH key issues, add the public key.

### Step 3: Verify SSH keys

Check if SSH public key is deployed to nexus (`ssh nexus 'cat ~/.ssh/authorized_keys'`). If missing, deploy with `ssh-copy-id`.

### Step 4: Verify git remote `bare`

On each machine:
```bash
git remote -v | grep bare
```

Should show:
```
bare	file:///srv/git/maplespike.git (fetch)
bare	file:///srv/git/maplespike.git (push)
```

Update via `git remote add bare file:///srv/git/maplespike.git` if missing.

### Step 5: Verify pnpm/node versions

Check `node --version` and `pnpm --version` on each machine against CI baseline (Node 22, pnpm 10.32.1).

### Step 6: Document in AGENTS.md

Update the multi-host worktree section in AGENTS.md with verification checklist.

---

## Verification

- [ ] `kubectl get nodes` works from forge, sentry, nexus (all 4 nodes visible)
- [ ] `kubectl get pods -A` returns pods across all namespaces
- [ ] `git ls-remote bare` works from all 4 machines
- [ ] SSH to nexus works from zephyr (key deployed)
- [ ] pnpm --version on all machines matches 10.32.1
- [ ] AGENTS.md updated with verification state

## Related Issues Found During Survey

### Namespace mismatch (prod)
`k8s/prod/namespace.yaml` declares `name: maplespike` but all prod manifests and CI/CD use `quill-prod`. Fix: change namespace.yaml to `name: quill-prod`. Low urgency since `kubectl apply -f` with existing namespace doesn't fail.

### Single-node pinning (HA risk)
All prod deployments and 22 CronJobs use `nodeName: nexus`. If nexus goes down, everything stops. Long-term fix: convert to `nodeAffinity preferredDuringScheduling` with multi-node host list (like dev pattern but include all nodes). Out of scope for this issue.

### Dev anti-zephyr affinity
Dev deployments use `nodeAffinity` that prefers nexus/sentry/forge and **excludes** zephyr. If zephyr is a cluster node, it can't serve dev pods. Verify if this is intentional (zephyr has less capacity).

### Root-level orphaned manifests
`k8s/mcp-deployment.yaml`, `k8s/uptime-kuma.yaml` not part of any kustomization. Might not be deployed by CI/CD.

### db-secret.yaml plaintext
`k8s/prod/db-secret.yaml` contains plaintext DB password checked into repo. Separate concern.

---

## Rollback

- `rm -f ~/.kube/config` to remove bad symlink
- Original `/etc/rancher/k3s/k3s.yaml` is always the source of truth
