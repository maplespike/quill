---
last-reviewed: 2026-06-01
status: active
---

# K8s Nix Manifests

All Kubernetes manifests are generated from Nix modules using [easykubenix](https://github.com/lillecarl/easykubenix).

## Build

```bash
nix build .#k8s-manifests
```

Output: `result/manifest.yaml` — a multi-document YAML containing all K8s resources.

## Architecture

```
k8s/
├── cron.nix              # 24 CronJobs (23 pipeline + searxng-health)
├── dev.nix               # maplespike-dev namespace, deployments, services, configmaps
├── prod.nix              # maplespike-prod namespace, statefulset, deployments, services, ingresses, secrets
├── infra.nix             # Observability (Prometheus, Alertmanager, Loki, Promtail, Pushgateway),
│                         # DevOps (Gitea), Monitoring (Uptime Kuma), MCP dev deployment
├── default.nix           # Module import list (used by flake.nix)
├── grafana-dashboard.json # Static Grafana dashboard definition (not a K8s manifest)
└── prod/
    └── ghcr-secret.nix   # NixOS module for GHCR pull secret bootstrap (not an easykubenix module)
```

## Resource Summary

| Kind | Count | Module |
|------|-------|--------|
| CronJob | 24 | `cron.nix` |
| Deployment | 14 | `dev.nix`, `prod.nix`, `infra.nix` |
| Service | 14 | `dev.nix`, `prod.nix`, `infra.nix` |
| ConfigMap | 6 | `dev.nix`, `prod.nix`, `infra.nix` |
| Namespace | 3 | `dev.nix`, `prod.nix`, `infra.nix` |
| Ingress | 3 | `prod.nix` |
| StatefulSet | 1 | `prod.nix` |
| Secret | 1 | `prod.nix` |
| PrometheusRule | 1 | `infra.nix` |
| DaemonSet | 1 | `infra.nix` |
| **Total** | **68** | |

## easykubenix Patterns

### Object definition

```nix
config.kubernetes.objects.<namespace>.<Kind>.<name> = { ... };
```

- `namespace` — K8s namespace (use `"none"` for cluster-scoped resources)
- `Kind` — K8s resource kind (Deployment, Service, CronJob, etc.)
- `name` — Resource name
- `apiVersion` and `kind` are auto-injected from `apiMappings`
- `metadata.name` is auto-injected from the key
- `metadata.namespace` is auto-injected from the namespace key

### Named lists

K8s fields that are arrays (containers, ports, volumeMounts, volumes, env) must use `_namedlist = true`:

```nix
containers = {
  _namedlist = true;
  myapp = {
    name = "myapp";
    image = "myimage:latest";
    # ...
  };
};
```

### Custom CRDs

Register CRD apiVersions not in the default easykubenix mapping:

```nix
config.kubernetes.apiMappings = {
  PrometheusRule = "monitoring.coreos.com/v1";
};
```

### String escaping in Nix multi-line strings

Nix `''..''` strings interpret `''` as the string delimiter. Use double quotes inside JS/YAML config strings:

```nix
# BAD — '' ends the Nix string prematurely
data."config.js" = ''
  MAPLESPIKE.apiKey = '';
'';

# GOOD — use double quotes
data."config.js" = ''
  MAPLESPIKE.apiKey = "";
'';
```

## Flake Integration

`flake.nix` uses easykubenix as a `flake = false` input:

```nix
inputs.easykubenix.url = "github:lillecarl/easykubenix";
inputs.easykubenix.flake = false;
```

The `k8s-manifests` package:

```nix
k8s-manifests = (import easykubenix {
  inherit pkgs;
  modules = [ ./k8s/cron.nix ./k8s/dev.nix ./k8s/prod.nix ./k8s/infra.nix ];
}).manifestYAMLFile;
```

## CI Validation

The `ci.yml` workflow includes a `k8s-manifests` job that:
1. Runs `nix build .#k8s-manifests` to verify all Nix modules evaluate
2. Counts generated resources and reports in the job summary

## Migration from Raw YAML

All 50 raw YAML files have been removed from `k8s/`:

- `k8s/cron/*.yaml` (24 files) — replaced by `k8s/cron.nix`
- `k8s/dev/*.yaml` (11 files) — replaced by `k8s/dev.nix`
- `k8s/prod/*.yaml` (14 files, excluding `ghcr-secret.nix`) — replaced by `k8s/prod.nix`
- `k8s/*.yaml` (9 root files) — replaced by `k8s/infra.nix`

Kept as-is:
- `k8s/grafana-dashboard.json` — static Grafana dashboard, not a K8s manifest
- `k8s/prod/ghcr-secret.nix` — NixOS module for agenix-based GHCR secret bootstrap
