---
last-reviewed: 2026-06-11
status: active
---

> **🟡 Status (2026-07-07):** `k8s/base/` hand-edited YAML is live (applied via `kubectl apply -k k8s/base/`). Prometheus + Alertmanager + Pushgateway are Nix-rendered via `k8s/infra.nix`. This document tracks the longer-term goal of generating all k8s/ trees from `k8s/*.nix` via [easykubenix](https://github.com/lillecarl/easykubenix) rather than hand-editing YAML — see [ROADMAP.md Phase 4](./../ROADMAP.md) for the migration plan.

## Usage

> **NOTE:** These commands are for the planned infrastructure. Current deployment uses Docker Compose.

```bash
# View generated manifests
nix run .#k8s-manifests

# Build manifests (produces multi-doc YAML in result/)
nix build .#k8s-manifests

# Apply to dev cluster
nix build .#k8s-manifests -o k8s-output
kubectl apply -f k8s-output/manifest.yaml -n maplespike
```

## Structure

```
k8s/
├── cron.nix          # 24 CronJobs (23 pipeline + searxng-health)
├── default.nix       # Module import list
├── dev.nix           # maplespike-dev namespace, deployments, services, configmaps
├── prod.nix          # quill-prod namespace, statefulset, deployments, services, ingresses
├── infra.nix         # Observability (Prometheus, Alertmanager, Loki, Promtail, Pushgateway)
├── grafana-dashboard.json
└── prod/
    └── ghcr-secret.nix
```

## Docker Compose (for local dev)

```bash
# View generated docker-compose.yml
nix run .#docker-compose

# Build manifests directory (Dockerfile + docker-compose.yml)
nix build .#docker-manifests
```

## Helm (for non-Nix clusters)

```bash
# View generated values.yaml
nix run .#helm-values
```

## See also

- `k8s/` — easykubenix module files
- `nix/` — NixOS module for MapleSpike services
- `flake.nix` — package definitions for all images, manifests, and apps
