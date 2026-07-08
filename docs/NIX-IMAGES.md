---
last-reviewed: 2026-07-07
status: active
---

# Nix Container Images

All MapleSpike container images are built via **Nix** (`flake.nix`) using `pkgs.dockerTools.buildLayeredImage`. Legacy Dockerfiles have been removed — there is no dual build system.

## Available Images

| Nix attribute | Image name | Port | Entry point |
|---|---|---|---|
| `quill-mcp-image` | `quill-mcp` | 3001 | `node packages/quill-mcp/dist/index.js` |
| `quill-api-image` | `quill-api` | 8082 | `node packages/api-server/dist/dev-server.js` |
| `quill-portal-image` | `quill-portal` | 8080 | `python3 /app/server.py` |
| `quill-ingest-image` | `quill-ingest` | CLI | `node packages/pipeline-core/dist/cli/ingest.js` |
| `quill-engine-image` | `quill-engine` | CLI | `node packages/engine/dist/sweep/run.js` |

## Building

```bash
# Build a single image
nix build .#quill-mcp-image -L

# Load into podman/docker
podman load < result

# Build all images
nix build .#quill-all -L
```

## Pushing to GHCR

The `quill-push-all` script handles tagging and pushing:

```bash
REGISTRY=ghcr.io/reverb256 TAG=stable nix run .#quill-push-all
```

Or manually:

```bash
nix build .#quill-api-image -L
podman load < result
podman tag quill-api:latest ghcr.io/reverb256/quill/quill-api:dev
podman push ghcr.io/reverb256/quill/quill-api:dev
```

## CI/CD

Both `deploy-dev.yml` and `deploy-prod.yml` use `nix build` + `podman load` to build and push images. No Dockerfiles are involved.

The CI workflow (`ci.yml`) includes a **forbidden Dockerfile check** — any `Dockerfile*` committed to the repo will cause CI to fail.

## Nix Image Features

- **Reproducible**: Same input always produces same image hash
- **Layered**: `buildLayeredImage` creates optimal layers for caching
- **Secure**: OCI labels, `runAsNonRoot`, `capabilities.drop=[ALL]` by default
- **Versioned**: Image tag includes `self.shortRev` (git SHA)

## Adding a New Image

1. Add a `mkImage` call in `flake.nix` under `packages`
2. Add to `quill-all` symlinkJoin
3. Add build+push step in `deploy-dev.yml` and `deploy-prod.yml`
4. **Never** create a Dockerfile — use Nix exclusively
