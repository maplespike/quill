# MapleSpike Kubernetes Manifests (reference)

> **CANONICAL DEPLOY PATH (2026-09-21):** the live cluster state is owned by the
> **Helm chart in this repo** (`charts/quill` + `values-prod.yaml`), rendered by the
> **ArgoCD app `quill`** (hub: `media-k8s/helm/apps/quill.yaml`). Change the chart →
> push → ArgoCD syncs. Do not `kubectl apply` these files against the live cluster,
> and never hand-edit live resources (permanent rule).

## Structure

- `maplespike/` — reference manifests for the core services. Kept as
  documentation of the intended shape; the live key-name drift guard
  (`scripts/check-secret-lockstep.sh`) now scans `charts/quill/templates/`
  (the path ArgoCD actually renders) against the sync script's MAPPING table.
  Files such as
  `quill-hpa.yaml`, `quill-networkpolicy.yaml`, `quill-service-networkpolicies.yaml`
  and `vap-require-resources-and-security.yaml` are NOT applied — move them into
  the chart when wanted (HPA needs the metrics API first: see #757).
- `cloudflared/cloudflared.yaml` — historical raw deployment for the tunnel
  connectors (namespace `cloudflared`); the live connectors predate the chart and
  are managed manually (see the `cloudflare` / `haven-deploy` skills).
- `gnp-default-deny.yaml` — canonical Calico default-deny policy reference.
- Ingest cronjobs, `kanban-cronjob.yaml`, `canary-prometheusrule.yaml`,
  `grafana-dashboard.json`, health scripts — reference/aspirational; verify against
  the live cluster before relying on any of them.

## Removed (2026-09-21, #777)

- `mosiac/` — Mosaic-era manifests; the app is upstream Haven now, deployed via the
  `haven-k8s` chart (ArgoCD app `haven`).
- `prod/ghcr-secret.nix` — nix-era artifact (no nix on the fleet).

## History

The 2026-08 era generated a Nix manifest bundle (`nix build .#saas-manifests`);
that path is retired. The chart + ArgoCD is the only live path.
