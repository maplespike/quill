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

The repository is prepared to be public. A `pull_request` workflow runs the file from the merge commit. GitHub withholds secrets from a fork pull request and gives that job a read-only token. The self-hosted runners share the host home directory and can reach the cluster. A fork job must use a GitHub-hosted runner.

Rules:

- Keep `on: pull_request` for code jobs.
- Each job sets `runs-on`. A fork pull request resolves to `ubuntu-latest`. A same-repo pull request and a push resolve to the self-hosted labels.
- `merge-when-green.yml` and `label-guard.yml` are the `pull_request_target` workflows. Neither checks out pull request code. `merge-when-green.yml` needs a write token to squash-merge. A same-repo run uses `arc-maplespike-gate`. A fork resolves to `ubuntu-latest` and the job does not run. The pull request author must be Dependabot or the maintainer. On `pull_request_target` and `workflow_dispatch`, the actor must be one of those two as well. Only Atlas sets the `hold` label. The merge gate skips a pull request that carries `hold`. `label-guard.yml` runs on `ubuntu-latest`. It does not act when `reverb256`, the merge-gate App, or the merge workflow itself while it merges removes `ready-to-merge`. It restores that label when another Bot removes it.
- `workflow_run` on a self-hosted runner requires `head_repository.full_name == github.repository`. It checks out `main`.
- `scripts/gates/check-fork-runner-policy.mjs` fails CI when a `pull_request_target` job checks out the pull request head, or when a fork can reach a self-hosted runner.

A fork can still add a new workflow file. This gate cannot see that file. Install the runner hook on every self-hosted runner:

```text
ACTIONS_RUNNER_HOOK_JOB_STARTED=/absolute/path/scripts/ci/refuse-untrusted-self-hosted.sh
```

Put that line in the runner directory `.env` and restart the runner. The hook refuses `pull_request`, `pull_request_target`, and `workflow_run` when the head repository is not this repository. A same-repo pull request is allowed. This repository does not install the hook.

In the GitHub repository settings, set Actions → General → Fork pull request workflows to "Require approval for all outside collaborators". Approval does not grant the cluster runner. The hook still refuses a fork job after an approval.

Fork jobs that need Node install it only when `runner.environment == 'github-hosted'`: Node 22 and pnpm 10.32.1, with no cache. Do not add those setup actions on the self-hosted runners.

## Why

- **Reproducible**: Nix pins exact tool versions, no drift across runners
- **Fast**: No `apt-get update/install` overhead (~30-60s saved per job)
- **Consistent**: Same tools in dev, CI, and production (NixOS)
- **Nix-first**: Aligns with project's infrastructure philosophy
