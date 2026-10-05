---
last-reviewed: 2026-07-07
status: active
---

# CI/CD & Automation

MapleSpike uses **GitHub Actions** for all CI/CD, running on a **self-hosted NixOS runner** in the K3s cluster. This document describes every workflow, what it does, and how to maintain it.

---

## Workflow Overview

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI** | `push`/`PR` → `main`/`prod` | Build, test, docs rot check, metrics drift check |
| **Docs Validation** | `push`/`PR` → `main`/`prod` (docs paths) | Metadata coverage, TODO density, metrics alignment |
| **PR Validation** | PR opened/edited/synced | Branch naming, issue linking, commit messages, title format |
| **Auto Create Issues** | Weekly (Mon 9AM) + manual | Stale docs, missing metadata, metrics drift |
| **Cross-Repo Sync** | Weekly (Sun midnight) + manual | AGENTS.md and workflow consistency across repos |

---

## CI (`ci.yml`)

**Runs on:** `push` and `pull_request` to `main`/`prod`

### Steps

1. **Checkout** with full git history (`fetch-depth: 0`)
2. **Verify commit signatures** — warns on unsigned commits (PR only)
3. **Setup Node 24** + `pnpm`
4. **Install** — `pnpm install --frozen-lockfile`
5. **Clean build artifacts**
6. **Build packages** — `scripts/build-packages.sh`
7. **Build docs** — `node scripts/build-docs.mjs`
8. **Rebuild native addon** — `better-sqlite3` for pipeline-core
9. **Validate `docs/metrics.json`** — regenerates metrics, fails if drifted
10. **Start API server** (background with JWT secret)
11. **Run tests:**
    - `packages/pipeline-core` (232+ tests)
    - `packages/quill-mcp` (70 tests)
    - `packages/engine` (50 tests)
    - `packages/sdk`
12. **Docs rot check** (PR only) — compares TODO/FIXME count vs base branch
13. **Metrics drift check** (PR only) — validates metrics.json is synchronized

### Concurrency

Cancels in-progress runs for the same branch to save runner time.

---

## Docs Validation (`docs-validation.yml`)

**Runs on:** `push`/`PR` to `main`/`prod` when docs files change, or manually.

### Checks

| Check | What it does | Fails on |
|-------|-------------|----------|
| **Metadata coverage** | Finds all `.md` files missing `last-reviewed:` frontmatter | Warning only |
| **TODO density** | Counts TODO/FIXME/HACK/XXX per file; flags >5% density | Error for security docs with any TODOs |
| **Metrics alignment** | Validates `docs/metrics.json` counts match actual code | Warning on mismatch |
| **AGENTS.md status** | Checks `status:` and `last-reviewed:` fields | Warning only |

All results are written to the GitHub Actions step summary for easy review in PRs.

---

## PR Validation (`pr-validation.yml`)

**Runs on:** PR opened, edited, synchronized, reopened, or marked ready

### Checks (all advisory — warnings don't block)

| Check | Rule |
|-------|------|
| **Branch naming** | Must match `issue-NNN-desc`, `feat/NNN-*`, `fix/NNN-*`, or `dependabot/*` |
| **Linked issue** | PR body must contain `Closes #NNN`, `Fixes #NNN`, etc. |
| **Commit messages** | Each commit must reference `#NNN` (merge/release exempted) |
| **Conventional title** | PR title must start with `feat:`, `fix:`, `chore:`, etc. |
| **Target branch** | Must target `main` |

---

## Auto Create Issues (`auto-issue-creator.yml`)

**Schedule:** Every Monday at 9 AM UTC
**Manual:** `workflow_dispatch`

### Jobs

#### 1. Stale docs check
- Scans all `.md` files for `last-reviewed:` metadata
- Creates issues for:
  - Files missing metadata entirely
  - Files not reviewed in >30 days
- Deduplicates against existing open issues
- Caps at 5 issues per run

#### 2. Metrics drift check
- Regenerates `docs/metrics.json` using `scripts/generate-metrics.mjs`
- If the file drifts, creates a `fix: metrics drift` issue

### Labels

Auto-generated issues use labels: `documentation`, `auto-generated`, `ci-cd`, `p2`/`p3`.

---

## Cross-Repo Sync (`cross-repo-sync.yml`)

**Schedule:** Every Sunday at midnight UTC
**Manual:** `workflow_dispatch`

### Checks across repositories

Runs against `reverb256/quill`, `reverb256/frostbite-gazette`, and `reverb256/mcp-canada`:

- **AGENTS.md** — exists, has `last-reviewed` and `status` fields
- **Workflows** — lists all `.github/workflows/*.yml` files

Results printed to the action summary — no auto-issues created (currently informational).

---

## Self-Hosted Runner

All workflows run on `[self-hosted, nixos]` — a NixOS runner inside the K3s cluster.

### Why NixOS

- Reproducible build environment
- No `apt-get` dependency drift
- Native Nix build support
- No GitHub-hosted runner billing

### Runner Setup

See the cluster NixOS config at `reverb256/nixos-config` for runner provisioning.

---

## Adding a New Workflow

1. Create `.github/workflows/<name>.yml`
2. Use `[self-hosted, nixos]` as the runner
3. Add `last-reviewed:` frontmatter to this file if docs-related
4. Add to the table above

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `better-sqlite3` build fails | Native addon mismatch | Add `pnpm rebuild better-sqlite3` step |
| Metrics drift in PR | Someone changed code without regenerating metrics | Run `node scripts/generate-metrics.mjs` locally |
| Garnix check fails | Flake evaluation error | Check `nix flake check` locally (often pre-existing) |
| API server not starting | Port conflict or missing JWT_SECRET | Set `JWT_SECRET` and use a unique port |
| Tests fail with ESM errors | Missing `.js` extension in import | Add `.js` to relative imports |
