---
last-reviewed: 2026-06-01
status: active
---

# Nix Flake Apps

MapleSpike's `flake.nix` provides Nix apps for common development and deployment operations.

## Available Apps

### Default: `nix run .`

Opens a `pnpm` shell. Equivalent to running `pnpm` directly.

### `nix run .#build`

Build all TypeScript packages:

```bash
nix run .#build
# runs: pnpm build
```

### `nix run .#test`

Run all tests:

```bash
nix run .#test
# runs: pnpm test
```

### `nix run .#deploy-dev`

Build container images tagged `:dev` for dev deployment:

```bash
nix run .#deploy-dev
# builds: maplespike-quill-image, maplespike-api-image, maplespike-portal-image
# then apply k8s/dev/ manifests
```

### `nix run .#deploy-prod`

Build container images tagged `:stable` for production deployment:

```bash
nix run .#deploy-prod
# builds: maplespike-quill-image, maplespike-api-image, maplespike-portal-image
# then apply k8s/prod/ manifests
```

## Checks

Run all checks:

```bash
nix flake check
```

Currently checks:
- **images-exist**: verifies all 5 container image derivations are defined

## Package Scripts

Also available via packages:

```bash
nix build ".#maplespike-build-all"     # build all images
nix build ".#maplespike-push-all"      # build + push all images
nix build ".#maplespike-quill-image"     # build single image
nix build ".#maplespike-api-image"
nix build ".#maplespike-portal-image"
```

## Dev Shell

```bash
nix develop
```

Enters a shell with node, pnpm, python3, kubectl, and age for secrets.
