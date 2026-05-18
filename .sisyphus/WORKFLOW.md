---
# Sisyphus Workflow — Repository Contract
# This file defines how agents (Hermes, Claude, OMP, Pi) operate in this repo.
# All tools call track.sh and follow the same worktree/PR conventions.
# Version: 2
tracker:
  kind: github
  owner: reverb256
  repo: maplespike
  exclude_labels: [blocked, wontfix, duplicate]
  priority_sort: [p1, p2, p3]
agent:
  max_concurrent: 3
  max_turns: 10
  turn_timeout_ms: 300000
  retry_backoff_ms: 60000
workspace:
  root: /data/projects/own/maplespike
  prefix: maplespike-
  pattern: /data/projects/own/maplespike-{num}
  remote: origin
hooks:
  after_create: |
    git fetch origin main 2>/dev/null || true
    pnpm install 2>/dev/null || true
  before_run: |
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
proof:
  require_build: true
  require_tests: true
  require_pr: true
notify:
  tools: [hermes, claude, omp, pi]
---

# Sisyphus Workflow Template

You are implementing issue **{{issue.title}}**.

## Context

**Repository:** `/data/projects/own/maplespike`
**Worktree:** `{{workspace.path}}`
**Branch:** `{{workspace.branch}}`
**Remote:** origin (GitHub — accessible from all nodes)
**Worktree was created by:** `.sisyphus/track.sh` (shared by Hermes, Claude, OMP, Pi)

## Rules

### MUST DO
1. Start by reading the issue description and any linked resources.
2. Work inside the worktree directory: `cd {{workspace.path}}`
3. Read existing code before writing — understand the patterns.
4. Use pnpm for all package operations.
5. Commit with conventional commits: `type: description (#NNN)`
6. Push to origin: `git push origin HEAD`
7. Update `docs/metrics.json` if tools/modules change.
8. Verify builds pass before finishing.

### MUST NOT DO
1. Do not work outside the worktree directory.
2. Do not push to bare (Zephyr-local) — use origin (GitHub) instead.
3. Do not delete existing stubs or routes unless the issue explicitly asks.
4. Do not add `as any` / `@ts-ignore` / `@ts-expect-error`.
5. Do not add unrequested features or drive-by refactors.
6. Do not run `nix` commands in the maplespike repo (that's for nixos-config).

### Proof of Work
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes (relevant packages)
- [ ] Commit pushed to origin
- [ ] PR created with `Closes #NNN`
- [ ] Worktree cleaned up after PR merge: `git worktree remove {{workspace.path}}`
