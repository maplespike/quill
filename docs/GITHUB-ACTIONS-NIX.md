---
last-reviewed: 2026-10-26
status: active
---

# Tools on the GitHub Actions runner

> **Corrected 2026-10-01.** This document previously described the self-hosted
> runners as NixOS with all tools supplied by Nix system packages. That was
> wrong, and wrong in a way that misleads: the runner label really is
> `nixos`, so the claim read as verified. The hosts actually run **Omarchy**
> (Arch-based) with tools installed as ordinary system packages. Verified
> directly on the runner:
>
> | Claimed here | Reality on the runner |
> |---|---|
> | NixOS system packages | Omarchy, Arch-based; no `nix` installed |
> | `node` v24.x | **v26.10.0** |
> | `podman` available | **not installed** — `docker` 29.8.1 is |
> | (unlisted) `syft` | **not installed** — needed by the SBOM control |
>
> A control wired to a toolchain that is not installed is worse than no
> control, because it looks like one. The per-image SBOM was briefly wired to
> `flake.nix`'s `nix run .#push-images` on the strength of the `nixos` label
> and had to be moved to `scripts/pin-images.sh`, which uses docker. Keep the
> operational advice below — it is still correct — but trust the table above
> over the filename and the label.
>
> The `nixos` **label** is left in place on purpose: it is how the runner was
> registered and 10+ workflows select on it, so renaming it is an ops change
> (re-register the runner) rather than an edit.

MapleSpike CI/CD runs on self-hosted runners (`runs-on: [self-hosted, nixos]`, despite the name). Build tools are preinstalled system packages — no `apt-get`, no `setup-node`, no `pnpm/action-setup`.

## Available Tools

| Tool | Source | Verified on runner 2026-10-01 |
|------|--------|------------------------------|
| `node` | system package | v26.10.0 |
| `pnpm` | system package | 10.32.1 |
| `python3` | system package | 3.14.7 |
| `kubectl` | system package | present |
| `docker` | system package | 29.8.1 |
| `gh` (GitHub CLI) | system package | 2.101.0 |
| `git` | system package | 2.55.0 |
| `jq` | system package | 1.8.2 |
| `age` | system package | 1.3.2 |
| `nix` | — | **not installed** |
| `podman` | — | **not installed** (use `docker`) |
| `syft` | — | **not installed** (required by `scripts/generate-sbom.sh`) |

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

## Public forks

The repository is prepared to be public. A `pull_request` workflow runs the file from the merge commit. A fork can delete every `if` and set `runs-on: [self-hosted, nixos]`. Those runners share the host home directory and can reach the cluster.

Rules:

- No workflow uses `on: pull_request`. Pull requests use `pull_request_target`, so the base branch supplies the workflow file.
- A fork pull request runs on `ubuntu-latest`. It gets `contents: read` and no repository secrets. The job clears `GITHUB_TOKEN` after checkout.
- A same-repo pull request and a push stay on `[self-hosted, nixos]`.
- `workflow_run` on a self-hosted runner requires `head_repository.full_name == github.repository`. It checks out `main`, not the triggering SHA.
- `scripts/gates/check-fork-runner-policy.mjs` fails CI when a workflow breaks these rules.

A fork can still add a new workflow file. The base-branch gate cannot see that file. Install the runner hook on every self-hosted runner:

```text
ACTIONS_RUNNER_HOOK_JOB_STARTED=/absolute/path/scripts/ci/refuse-untrusted-self-hosted.sh
```

Put that line in the runner directory `.env` and restart the runner. The hook refuses every `pull_request` job and refuses a fork `pull_request_target` or `workflow_run`. This repository does not install the hook.

In the GitHub repository settings, set Actions → General → Fork pull request workflows to "Require approval for all outside collaborators". Approval does not grant the cluster runner. The hook still refuses `pull_request` after an approval.

Fork jobs that need Node install it only when `runner.environment == 'github-hosted'`: Node 22 and pnpm 10.32.1, with no cache. Do not add those setup actions on the self-hosted runners.

## Why

- **Reproducible**: Nix pins exact tool versions, no drift across runners
- **Fast**: No `apt-get update/install` overhead (~30-60s saved per job)
- **Consistent**: Same tools in dev, CI, and production (NixOS)
- **Nix-first**: Aligns with project's infrastructure philosophy
