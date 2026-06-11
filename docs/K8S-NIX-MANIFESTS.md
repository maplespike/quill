---
last-reviewed: 2026-06-11
status: active
---

# K8s Manifests — Nix-generated via easykubenix

All Kubernetes manifests are generated from Nix via [easykubenix](https://github.com/lillecarl/easykubenix).
Source files live in `k8s/` directory. The flake attribute is `.#k8s-manifests`.

## Usage

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
├── prod.nix          # maplespike-prod namespace, statefulset, deployments, services, ingresses
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
