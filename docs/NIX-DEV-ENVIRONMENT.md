# Nix-Based Development Environment

## Overview

MapleSpike provides a complete Nix-based development environment via `nix develop` (flakes) or `nix-shell` (legacy). This ensures all developers have identical tooling and dependencies.

## Quick Start

```bash
# Enter dev environment
nix develop

# Or with specific shell profile
nix develop .#devShells.x86_64-linux.mcp
```

## Available Dev Shells

### default (General Development)
```bash
nix develop
```

Provides:
- Node.js 22 + pnpm (workspace manager)
- TypeScript + tsserver (language server for IDEs)
- Python 3 (for portal)
- Docker/Podman CLI
- kubectl
- age (for secret decryption)

**Use for**: General development, running services locally, testing

### mcp (MCP Server Development)
```bash
nix develop .#devShells.x86_64-linux.mcp
```

Extends default with:
- curl (for testing SSE endpoint)
- netcat (for port testing)
- Test script: `test-mcp` (starts server + health check)

**Use for**: MCP server development, protocol testing, Hermes integration

### api (API Server Development)
```bash
nix develop .#devShells.x86_64-linux.api
```

Extends default with:
- psql (for PostgreSQL testing)
- SQLite CLI
- HTTPie (for API testing)
- Test script: `test-api` (starts server + runs smoke tests)

**Use for**: API server development, database schema changes, integration tests

### portal (Portal Development)
```bash
nix develop .#devShells.x86_64-linux.portal
```

Extends default with:
- Python 3.11
- Flask CLI
- Live reload script: `dev-portal`

**Use for**: Portal UI development, static file updates

## Tooling

### Node.js Ecosystem
- **pnpm**: Monorepo package manager (faster, stricter than npm/yarn)
- **TypeScript**: Type checking and transpilation
- **tsserver**: Language server for IDE autocompletion and type checking

### Container Runtime
- **Podman**: Daemonless container engine (default, rootless)
- **Docker**: Alternative (if installed)

### Kubernetes
- **kubectl**: Cluster management

### Secret Management
- **age**: File encryption for secrets (SSH key-based)

## Environment Variables

### Development Mode

Automatically set in dev shells:

```bash
NODE_ENV=development
QUILL_STORAGE=sqlite
MAPLESPIKE_DEBUG=true
```

### Auth Bypass (Local Dev)

MCP server in dev mode bypasses auth when:

```bash
QUILL_API_KEY=***  # Three asterisks enables dev bypass
NODE_ENV=development     # Must not be "production"
```

### GitHub Token

> Retired 2026-10-28: `secrets/github-pat.age` and the dev-shell agenix
> decryption hook were removed. Set `GITHUB_TOKEN` manually in your
> environment when you need private package access or GitHub API calls.

## Common Tasks

### Install Dependencies
```bash
nix develop
pnpm install --frozen-lockfile
```

### Build Project
```bash
nix develop
pnpm build
```

### Run Tests
```bash
nix develop
pnpm test

# Or run specific package tests
cd packages/quill-mcp && pnpm test
cd packages/api-server && pnpm test
```

### Start Services Locally

```bash
nix develop

# MCP server (SSE mode on :3001)
cd packages/quill-mcp && pnpm start:sse

# API server (dev mode on :8082)
cd packages/api-server && pnpm run dev

# Portal (simple HTTP on :8080)
cd packages/portal && python3 server.py
```

### Build Container Images
```bash
nix build .#quill-mcp-image
nix build .#quill-api-image
nix build .#quill-portal-image

# Load into Podman
podman load < result
```

### Deploy to Cluster
```bash
nix build .#k8s-manifests
kubectl apply -f result/manifest.yaml -n maplespike-dev
```

### Test MCP Integration
```bash
nix develop .#devShells.x86_64-linux.mcp
test-mcp  # Starts MCP server + runs health check

# In another terminal
hermes mcp add quill --url http://localhost:3001/sse
```

## IDE Integration

### VS Code

Install extensions:
```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension esbenp.prettier-vscode
```

Configure `.vscode/settings.json`:
```json
{
  "typescript.tsdk": "node_modules/.pnpm/typescript",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

### Neovim

Using `direnv` + `nvim-lspconfig`:

1. Enable `nix-direnv`:
```bash
mkdir -p ~/.config/direnv/lib
echo 'use nix' >> ~/.config/direnv/direnvrc
echo 'source_url "https://github.com/nix-community/nix-direnv/archive/master.tar.gz"' >> ~/.config/direnv/direnvrc
```

2. Create `.envrc` in project root:
```bash
use flake
```

3. Configure LSP in `init.lua`:
```lua
require('lspconfig').tsserver.setup {
  capabilities = require('cmp_nvim_lsp').default_capabilities(vim.lsp.protocol.make_client_capabilities()),
}
```

### Helix

Create `.helix/languages.toml`:
```toml
[language-server.tsserver]
command = "tsserver"

[[language]]
name = "typescript"
roots = ["package.json", "tsconfig.json"]
file-types = ["ts", "tsx"]
language-servers = ["tsserver"]
```

## Troubleshooting

### nix develop Fails

**Problem**: "error: experimental feature 'nix-command' is disabled"

**Solution**: Add to `~/.config/nix/nix.conf`:
```
experimental-features = nix-command flakes
```

**Problem**: "error: flake 'github:NixOS/nixpkgs/nixos-unstable' is not immutable"

**Solution**: Update nixpkgs input:
```bash
nix flake update
```

### Build Issues

**Problem**: TypeScript errors about missing types

**Solution**: Ensure pnpm workspace is configured:
```bash
pnpm install
pnpm build
```

**Problem**: "Cannot find module 'xyz'"

**Solution**: Check workspace dependencies in `package.json`:
```json
{
  "dependencies": {
    "@maplespike/database": "workspace:*",
    "@maplespike/pipeline-core": "workspace:*"
  }
}
```

### Runtime Issues

**Problem**: Port already in use

**Solution**: Kill existing process or use different port:
```bash
# Find and kill
lsof -i :3001 | grep LISTEN
kill <PID>

# Or change PORT environment variable
PORT=3002 pnpm start:sse
```

**Problem**: MCP server won't start

**Solution**: Check logs and environment:
```bash
# Enable verbose logging
DEBUG=* pnpm start:sse

# Check environment variables
env | grep MAPLESPIKE
```

## Performance Tips

### Faster Builds

Use `--keep-going` to continue on errors:
```bash
pnpm build --keep-going
```

Use Turborepo caching (already configured):
```bash
pnpm build  # Automatically uses turbo.json cache

# Clear cache if needed
rm -rf .turbo
pnpm build
```

### Faster Tests

Run tests in parallel:
```bash
pnpm -r test --parallel
```

Run only changed packages:
```bash
pnpm test --filter=./packages/quill-mcp
```

### Faster Container Images

Use `--no-link` to avoid symlinking to `/nix/store`:
```bash
nix build .#quill-mcp-image --no-link
```

Use binary cache (Cachix):
```bash
# Add to ~/.config/nix/nix.conf
substituters = https://maplespike.cachix.org https://cache.nixos.org
trusted-public-keys = maplespike.cachix.org-1:...
```

## Advanced Configuration

### Custom Dev Shells

Add to `flake.nix`:

```nix
devShells.my-custom-shell = pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs pnpm
    jq  # JSON processing
    fzf # Fuzzy finder
  ];
  shellHook = ''
    export CUSTOM_VAR=value
    echo "Custom shell loaded"
  '';
};
```

### Conditional Dev Shells

Create dev shell based on git branch:

```nix
devShells.${branch} = pkgs.mkShell {
  # branch is derived from git
  buildInputs = with pkgs; [
    (if branch == "main" then [ jq ] else [ yq ])
  ];
};
```

### System-Specific Dev Shells

Provide different tooling per system:

```nix
devShells.default = pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs pnpm
  ] ++ lib.optional (stdenv.isLinux) [ podman ]
    ++ lib.optional (stdenv.isDarwin) [ docker ];
};
```

## Contributing

### Adding a New Package

1. Add to `packages/*/package.json`:
```json
{
  "name": "@maplespike/new-package",
  "dependencies": {
    "@maplespike/database": "workspace:*"
  }
}
```

2. Add to `flake.nix` build inputs:
```nix
maplespike-new-package = mkImage {
  name = "maplespike-new-package";
  cmd = [ "node" "packages/new-package/dist/index.js" ];
  port = 4000;
  extraEnv = [];
};
```

3. Update `quill-all` symlinkJoin:
```nix
quill-all = pkgs.symlinkJoin {
  name = "quill-all-images";
  paths = [
    # ... existing
    self.packages.${system}.maplespike-new-package
  ];
};
```

### Updating Node.js Version

Change in `flake.nix`:
```nix
nodejs = pkgs.nodejs_22;  # Change to pkgs.nodejs_20, etc.
```

Then rebuild:
```bash
nix flake lock --update-input nixpkgs
nix build .#quill-build
```

## References

- `flake.nix` — Dev shell definitions
- `AGENTS.md` — Quick reference for agents
- `docs/NIX-FIRST-WORKFLOW.md` — Full workflow documentation
- `docs/NIX-IMAGES.md` — Container image documentation
- Nix manual: https://nixos.org/manual/nix/stable/
- pnpm workspaces: https://pnpm.io/workspaces