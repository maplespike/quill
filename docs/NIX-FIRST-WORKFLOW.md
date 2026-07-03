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
# Build all images
nix run .#apps.build-all

# Or build individually
nix build .#maplespike-quill-image
nix build .#maplespike-api-image
nix build .#maplespike-portal-image

# View build outputs
ls -la result/
```

### Run Tests
```bash
# Using nix run app
nix run .#apps.test

# Or manually in dev shell
pnpm test
```

## Development Workflow

### 1. Local Development (Container-based)

#### Option A: Docker/Podman (reproducible)
```bash
# Load Nix-built images into container runtime
nix run .#apps.load-all

# Start services via generated systemd quadlet files
# These are pre-generated in flake.nix under systemd-services package
sudo cp result/systemd-services/*.container /etc/containers/systemd/
sudo cp result/systemd-services/*.service /etc/systemd/system/
sudo systemctl daemon-reload

# Start services
sudo systemctl enable --now maplespike-quill
sudo systemctl enable --now maplespike-api
sudo systemctl enable --now maplespike-portal

# Verify
curl http://localhost:3001/health
curl http://localhost:8082/health
curl http://localhost:8080
```

#### Option B: Direct Node.js (fastest iteration)
```bash
# In dev shell
pnpm install
pnpm build

# Run services directly (with hot reload where available)
cd packages/quill-mcp && pnpm start:sse    # SSE mode on :3001
cd packages/api-server && pnpm run dev      # Dev mode on :8082
cd packages/portal && python3 server.py      # Python simple HTTP
```

### 2. Cluster Development

#### Deploy to K3s Cluster
```bash
# Build manifests from Nix
nix build .#k8s-manifests

# Apply to cluster
kubectl apply -f result/manifest.yaml -n maplespike

# Or use generated dev/prod manifests
kubectl apply -n maplespike-dev -f k8s/dev/
kubectl apply -n maplespike-prod -f k8s/prod/
```

#### Push to Container Registry
```bash
# Build and push all images
REGISTRY=ghcr.io/reverb256 TAG=dev nix run .#maplespike-push-all

# Or manually
nix build .#maplespike-quill-image
podman load < result
podman tag maplespike-quill:latest ghcr.io/reverb256/maplespike-quill:dev
podman push ghcr.io/reverb256/maplespike-quill:dev
```

#### Verify Deployment
```bash
# Check pods
kubectl get pods -n maplespike

# Check logs
kubectl logs -n maplespike deployment/maplespike-quill

# Port-forward for local testing
kubectl port-forward -n maplespike svc/maplespike-quill 3001:3001
curl http://localhost:3001/health
```

### 3. MCP Server Testing

#### Local Testing (Hermes Integration)
```bash
# Start MCP server (local)
cd packages/quill-mcp
pnpm start:sse &

# Add to Hermes
hermes mcp add maplespike --url http://localhost:3001/sse

# Or using cluster deployment
kubectl port-forward -n maplespike svc/maplespike-quill 3001:3001
hermes mcp add maplespike --url http://localhost:3001/sse
```

#### Verify Tools Available
```bash
# Test MCP connection
hermes mcp test maplespike

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
  - run: nix build .#maplespike-quill-image -L
  - run: podman load < result
  - run: podman push ghcr.io/reverb256/maplespike-quill:${{ github.sha }}
```

### Image Builds

All images use `pkgs.dockerTools.buildLayeredImage`:

```nix
mkImage = { name, cmd, port, extraEnv }: pkgs.dockerTools.buildLayeredImage {
  inherit name;
  tag = "latest";
  created = "now";
  contents = with pkgs; [ maplespike-build nodejs bash coreutils dumb-init ];
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
nix build .#maplespike-quill-image --rebuild
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
kubectl set env -n maplespike deployment/maplespike-quill MAPLESPIKE_API_KEY=***
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
kubectl port-forward -n maplespike svc/maplespike-quill 3001:3001
```

Or configure NodePort:
```nix
# In k8s/dev.nix
services.maplespike-quill = {
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
  imports = [ (import ~/Projects/maplespike/nix) ];

  services.maplespike-quill = {
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
nix build .#maplespike-quill-image --system aarch64-linux
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
- Search issues: https://github.com/reverb256/maplespike/issues

For MapleSpike-specific issues:
- Check `docs/` directory for component-specific docs
- Check `ROADMAP.md` for architecture decisions
- Open GitHub issue with `nix` label