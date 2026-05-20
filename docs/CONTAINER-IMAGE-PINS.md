
---
last-reviewed: 2026-05-19
status: active

||||||| e980c07
 origin/main
# Container Image Digest Pins

> OWASP LLM05: Supply Chain Vulnerability mitigation
> Last updated: 2026-05-19

All container images are pinned to `sha256` digests to prevent supply chain attacks via tag mutation.

## Registry

The single source of truth is [`k8s/images.json`](../k8s/images.json). It tracks:
- Third-party image digests (Docker Hub)
- Internal image digests (GHCR, local registry)
- Pin timestamps for audit

## Third-Party Images (Pinned)

| Image | Tag | Digest (sha256) | Pinned |
|-------|-----|-----------------|--------|
| postgres | 17-alpine | `979c4379...` | 2026-05-19 |
| prom/prometheus | v3.2.1 | `6927e091...` | 2026-05-19 |
| prom/pushgateway | v1.11.0 | `99392035...` | 2026-05-19 |
| prom/alertmanager | v0.28.1 | `27c475db...` | 2026-05-19 |
| grafana/loki | 3.4.2 | `58a6c186...` | 2026-05-19 |
| grafana/promtail | 3.4.2 | `c6e9a987...` | 2026-05-19 |
| louislam/uptime-kuma | 2 | `9aeb4e51...` | 2026-05-19 |
| gitea/gitea | latest-rootless | `4c425649...` | 2026-05-19 |

## Internal Images

| Image | Env | Tag | Digest | Notes |
|-------|-----|-----|--------|-------|
| maplespike-api | dev | dev | *(set by CI)* | Mutable — updates on every push to main |
| maplespike-api | prod | stable | *(set by CI)* | Pinned after each prod build |
| maplespike-mcp | dev | dev | *(set by CI)* | Mutable |
| maplespike-mcp | prod | stable | *(set by CI)* | Pinned after each prod build |
| maplespike-portal | dev | dev | *(set by CI)* | Mutable |
| maplespike-portal | prod | stable | *(set by CI)* | Pinned after each prod build |
| maplespike-dashboard | dev | dev | *(set by CI)* | Mutable |
| maplespike-ingest | prod | stable | *(set by CI)* | Local registry (nexus:5000) |

## Updating Digests

### Third-party images

```bash
# Resolve all third-party digests from Docker Hub
./scripts/update-image-digests.sh

# Apply pins to k8s manifests
./scripts/apply-image-pins.sh

# Or dry-run to see what would change
DRY_RUN=true ./scripts/update-image-digests.sh
DRY_RUN=true ./scripts/apply-image-pins.sh
```

### Internal images

Internal image digests are automatically recorded by CI pipelines:
- **Deploy Dev** (`.github/workflows/deploy-dev.yml`): Records dev digests after build
- **Deploy Prod** (`.github/workflows/deploy-prod.yml`): Records prod digests and pins k8s manifests

To manually resolve internal image digests:
```bash
GHCR_TOKEN=*** ./scripts/update-image-digests.sh
```

## Drift Detection

A weekly GitHub Actions workflow (`.github/workflows/image-digest-drift.yml`) checks all third-party image digests against upstream. If drift is detected, it creates a GitHub issue with the details.

To run manually:
```bash
python3 scripts/check-image-drift.py
```

## Build Script

The local build script (`scripts/build-images.sh`) records digests in `images.json` when pushing:

```bash
PUSH=true ./scripts/build-images.sh --tag stable
```

## Security Rationale

Pinning to digests prevents:
1. **Tag squatting**: An attacker who compromises a registry could replace a tag with a malicious image
2. **Silent updates**: Tags like `latest` or `stable` can change without notice
3. **Supply chain attacks**: Digest pinning ensures the exact same binary runs every time

See [OWASP LLM05: Supply Chain Vulnerability](https://owasp.org/www-project-top-10-for-large-language-model-applications/) for context.