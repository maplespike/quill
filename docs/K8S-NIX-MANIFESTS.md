---
last-reviewed: 2026-06-11
status: archived
---

# K8s Nix Manifests

**Status:** ARCHIVED — This entire document was aspirational fiction. None of the described files exist.

## Reality

- No `k8s/` directory exists in the repository
- No CronJob, StatefulSet, Deployment, Service, Ingress, or ConfigMap manifests exist
- No Prometheus, Alertmanager, Loki, Grafana, or Uptime Kuma configurations
- `nix build .#k8s-manifests` will fail — the flake attribute doesn't exist

See `ROADMAP.md` for deployment plans. This file will be recreated when K8s manifests are actually built.
