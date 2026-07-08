---
last-reviewed: 2026-07-07
status: active
---

# Nix in GitHub Actions

MapleSpike CI/CD runs on self-hosted NixOS runners (`runs-on: [self-hosted, nixos]`). All build tools are provided by Nix system packages — no `apt-get`, no `setup-node`, no `pnpm/action-setup`.

## Available Tools

| Tool | Source |
|------|--------|
| `node` v24.x | NixOS system package (`nodejs_24`) |
| `pnpm` | NixOS system package |
| `python3` | NixOS system package |
| `kubectl` | NixOS system package |
| `podman` | NixOS system package |
| `gh` (GitHub CLI) | NixOS system package |
| `git` | NixOS system package |
| `jq` | NixOS system package |
| `age` | NixOS system package |

## No Setup Actions Needed

Because the runner already has all tools, these actions are omitted:

```diff
- - uses: actions/setup-node@v4
- - uses: pnpm/action-setup@v4
```

Jobs go straight to `pnpm install`:

```yaml
jobs:
  test:
    runs-on: [self-hosted, nixos]
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
```

## Verify Nix Tools

To see available tool versions at the start of a job, include the reusable workflow:

```yaml
jobs:
  setup:
    uses: ./.github/workflows/nix-setup.yml
```

Or manually:

```yaml
- run: |
    echo "node $(node --version)"
    echo "pnpm $(pnpm --version)"
    echo "git $(git --version)"
```

## Why

- **Reproducible**: Nix pins exact tool versions, no drift across runners
- **Fast**: No `apt-get update/install` overhead (~30-60s saved per job)
- **Consistent**: Same tools in dev, CI, and production (NixOS)
- **Nix-first**: Aligns with project's infrastructure philosophy
