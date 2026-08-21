# Nix-First Development Workflow

## Philosophy

MapleSpike is a **Nix-first project**. All artifacts — container images, Kubernetes manifests, development environments, deployment scripts — are generated from Nix expressions. This ensures reproducibility, declarative configuration, and single-source-of-truth.

## Core Principles

1. **No Dockerfiles** — All images built via `pkgs.dockerTools.buildLayeredImage`
2. **No hand-written YAML** — K8s manifests generated via easykubenix
3. **No imperative setup** — Dev environments via `nix develop` (direnv integration optional)
4. **Single source of truth** — `flake.nix` is the canonical source for all configs

## Quick Start

### Enter Dev Environment
```bash
# Using nix develop (requires flake support in nix >= 2.4)
nix develop

# Using legacy nix-shell
nix-shell -A devShells.x86_64-linux.default
```

The dev shell provides:
- Node.js 22 + pnpm (workspace manager)
- TypeScript + tsserver (language server)
- Python 3 (for portal)
- Docker/Podman CLI
- kubectl
- age (for secret decryption)

### Build All Packages
```bash
# Build all runtime images (api, mcp, portal) — layered OCI images via dockerTools
nix build .#quill-api-image .#quill-mcp-image .#quill-portal-image -L

# Or all images (incl. ingest/engine)
nix build .#quill-all -L

# View build output
ls -la result/
```

### Run Tests
```bash
# Using nix run app
nix run .#test

# Or manually in dev shell
pnpm test
```

## Development Workflow

### 1. Local Development (self-host, one-touch)

The recommended local path is the Podman Quadlet stack — no Docker, no
docker-compose, no manual YAML. `nix/selfhost.nix` generates the
`.container`/`.volume`/`.network` units; `./selfhost.sh` installs and starts
them.

```bash
./selfhost.sh up      # build images (nix) + install quadlet units + start
./selfhost.sh status  # health check (API/MCP/Portal)
./selfhost.sh logs    # tail all three services
./selfhost.sh down    # stop + disable

# Equivalent nix app:
nix run .#selfhost up
```

Ports: API `8082`, MCP `3001` (SSE at `/sse`), Portal `8080`.

### 2. Cluster Development (SaaS, k3s)

Manifests are generated from Nix (`nix/saas-manifests.nix`) and match the
live cloudflared-routed cluster.

```bash
# Push images to GHCR
REGISTRY=ghcr.io/reverb256 TAG=stable nix run .#push-images

# Generate + apply manifests
nix build .#saas-manifests -L
kubectl apply -f result/manifests.yaml -n maplespike

# Or one-shot:
TAG=stable nix run .#deploy-saas
```

This is the canonical replacement for the hand-maintained `k8s/base/*.yaml`
and the old easykubenix modules (removed in PR #733). See
`docs/K8S-NIX-MANIFESTS.md`.

### 3. MCP Server Testing

#### Local Testing (Hermes Integration)
```bash
# Start MCP server (local)
cd packages/quill-mcp
pnpm start:sse &

# Add to Hermes
hermes mcp add quill --url http://localhost:3001/sse

# Or using cluster deployment
kubectl port-forward -n maplespike svc/quill-mcp 3001:3001
hermes mcp add quill --url http://localhost:3001/sse
```

#### Verify Tools Available
```bash
# Test MCP connection
hermes mcp test quill

# List MCP tools
hermes mcp list

# In Hermes session, tools are prefixed with server name:
# e.g., maplespike-explore_catalog, maplespike-system_health
```

## Build Pipeline

### CI/CD Integration

The `.github/workflows/deploy-dev.yml` and `.github/workflows/deploy-prod.yml` workflows use Nix:

```yaml
steps:
  - uses: cachix/install-nix-action@v25
  - run: nix build .#quill-mcp-image -L
  - run: podman load < result
  - run: podman push $REGISTRY/quill-mcp:${{ github.sha }}
```

### Image Builds

All images use `pkgs.dockerTools.buildLayeredImage`:

```nix
mkImage = { name, cmd, port, extraEnv }: pkgs.dockerTools.buildLayeredImage {
  inherit name;
  tag = "latest";
  created = "now";
  contents = with pkgs; [ quill-build nodejs bash coreutils dumb-init ];
  config = {
    Env = [ "NODE_ENV=production" "PORT=${toString port}" ] ++ extraEnv;
    Cmd = cmd;
    ExposedPorts = { "${toString port}/tcp" = {}; };
  };
};
```

### Manifest Generation

K8s manifests generated via easykubenix:

```nix
k8s-manifests = (import easykubenix {
  inherit pkgs;
  modules = [
    ./k8s/cron.nix
    ./k8s/dev.nix
    ./k8s/prod.nix
    ./k8s/infra.nix
  ];
}).manifestYAMLFile;
```

## Troubleshooting

### Build Issues

**Problem**: "error: hash mismatch in fixed-output derivation"

**Solution**:
```bash
# Clean and rebuild
rm -rf result
nix build .#quill-mcp-image --rebuild
```

**Problem**: "pnpm install fails"

**Solution**: The build uses `__noChroot = true` for network access. If still failing:
```bash
# Clear pnpm cache
pnpm store prune

# Update lockfile
pnpm install --frozen-lockfile=false
```

### Runtime Issues

**Problem**: MCP server returns "Unauthorized"

**Solution**: Set dev mode API key:
```bash
kubectl set env -n maplespike deployment/quill-mcp QUILL_API_KEY=***
```

**Problem**: Pods in CrashLoopBackOff

**Solution**:
```bash
# Check logs
kubectl logs -n maplespike deployment/<pod-name> --previous

# Check events
kubectl get events -n maplespike --sort-by=.metadata.creationTimestamp

# Common issues:
# - Missing secrets: create in k8s/prod/ghcr-secret.nix
# - Image pull errors: check registry and tag
# - Resource limits: increase in flake.nix mkImage resources
```

### Networking Issues

**Problem**: Can't connect to ClusterIP service from host

**Solution**: Use port-forward:
```bash
kubectl port-forward -n maplespike svc/quill-mcp 3001:3001
```

Or configure NodePort:
```nix
# In k8s/dev.nix
services.quill-mcp = {
  type = "NodePort";
  ports = [{
    port = 3001;
    targetPort = 3001;
    nodePort = 31745;
  }];
};
```

## Advanced Usage

### Custom Dev Shells

Define specialized dev shells in `flake.nix`:

```nix
devShells.mcp = pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs pnpm
    (pkgs.writeShellScriptBin "test-mcp" ''
      pnpm start:sse &
      sleep 2
      curl http://localhost:3001/health
    '')
  ];
};
```

Usage:
```bash
nix develop .#devShells.mcp
```

### NixOS Integration

For running MapleSpike directly on NixOS hosts (no containers):

```nix
# In /etc/nixos/configuration.nix
{ config, pkgs, ... }: {
  imports = [ (import ~/Projects/quill/nix) ];

  services.quill-mcp = {
    enable = true;
    port = 3001;
  };
}
```

### Multi-System Support

The flake supports all systems that nixpkgs supports:
- x86_64-linux
- aarch64-linux
- x86_64-darwin (macOS)
- aarch64-darwin (Apple Silicon)

```bash
# Build for specific system
nix build .#quill-mcp-image --system aarch64-linux
```

## Migration Path (Legacy → Nix-First)

If coming from legacy Dockerfile/docker-compose setup:

1. **Remove Dockerfiles** — Delete all Dockerfile* files (CI will block this)
2. **Update CI** — Use `nix build` instead of `docker build`
3. **Use nix develop** — Replace `npm install` with `nix develop`
4. **Generate manifests** — Use `nix build .#k8s-manifests` instead of Helm
5. **Deploy via Nix** — Use `colmena apply` or direct kubectl on Nix YAML

## References

- `flake.nix` — Source of truth for all builds and manifests
- `k8s/*.nix` — K8s module definitions
- `docs/NIX-IMAGES.md` — Container image documentation
- `docs/K8S-NIX-MANIFESTS.md` — Manifest generation guide
- `AGENTS.md` — Development quick reference

## Support

For Nix-specific issues:
- Check NixOS wiki: https://nixos.wiki
- Check easykubenix docs: https://github.com/lillecarl/easykubenix
- Search issues: https://github.com/reverb256/quill/issues

For MapleSpike-specific issues:
- Check `docs/` directory for component-specific docs
- Check `ROADMAP.md` for architecture decisions
- Open GitHub issue with `nix` label