---
last-reviewed: 2026-05-17
status: active
---

# AGENTS.md — MapleSpike

> **Mission**: Build the Library of Alexandria for Canadian public data — 150+ modules covering every federal, provincial, territorial, and municipal source.
> **Current metrics**: [docs/metrics.json](./docs/metrics.json) — 65 modules, 24 MCP tools, ~115K lines TS, 10 packages.

Quick reference for agents working in this repo. Don't guess — check here first.

---

## Repository Identity

| Attribute | Value |
|-----------|-------|
| Type | pnpm monorepo (pnpm@10.32.1) |
| Orchestrator | Turbo (workspace config in `turbo.json`) |
| Node | ≥18 (CI uses 22) |
| Packages | 11 in `packages/*` |
| TS | strict mode, ES2022 target, ESNext modules (bundler resolution) |
| No ESLint/Prettier | Match existing code style |
| npm scope | `@maplespike/` |
| License | AGPL-3.0 (pipeline-core) / MIT (others) |
| Changesets baseBranch | `prod` (not `main`) |

---

## Package Quick Reference

| Package | Entry point | Build | Test (framework) | Published? |
|---------|-------------|-------|------------------|------------|
| `pipeline-core` | `dist/index.js` | `tsc -b` | `node --test` (tsx) | No |
| `mcp-server` | `dist/cli.js` (bin: `maplespike-mcp`) | `tsc -b` | `node --test` (tsx) | No |
| `api-server` | `dist/dev-server.js` | `tsc -b` | `node --test` (tsx) | No |
| `engine` | `src/index.ts` | `tsc` | `vitest` (no config file) | No |
| `sdk` | `dist/index.js` (tsup, CJS+ESM) | `tsup` | `pnpm build && tsx --test` | Yes (npm) |
| `legal-core` | `dist/index.js` (tsup) | `tsup` | — | Yes (npm) |
| `legislation` | `dist/index.js` (tsup) | `tsup` | — | Yes (npm) |
| `sdk-python` | `maplespike/__init__.py` | `python -m build` | — | Yes (PyPI) |
| `portal` | `.` (static HTML) | No build step | — | No |
| `docs` | `src/index.md` | VitePress | — | No |
| `pretext-civic` | — | Orphaned (no package.json) | — | No |

**Build tools by package**: tsc -b (pipeline-core, mcp-server, api-server), tsc (engine), tsup (sdk, legal-core, legislation), vite/vitepress (docs), none (portal, pretext-civic, sdk-python).

**API server runs from `dist/dev-server.js`**, not `dist/index.js`.

**Engine has no vitest.config.ts** — uses vitest defaults. All other packages use Node's built-in test runner (`node --test` via tsx).

---

## Commands

### Root (from repo root)

```bash
pnpm install                     # Install all deps
pnpm build                       # Turbo topological build
pnpm -r build                    # Bypass Turbo, build each package independently (used in CI)
pnpm test                        # Turbo: build → test all
pnpm -r test                     # Run all package tests (no Turbo orchestration)
pnpm run clean                   # Remove dist/ and tsconfig.tsbuildinfo
```

### Per-package

```bash
# mcp-server
cd packages/mcp-server && pnpm start                  # stdio mode (needs MAPLESPIKE_API_KEY=dev-key)
cd packages/mcp-server && pnpm start:sse               # SSE mode on :3001 (via cli.ts with PORT=3001)
cd packages/mcp-server && pnpm test                     # node --test with tsx

# engine
cd packages/engine && pnpm test                         # vitest run
cd packages/engine && pnpm run migrate                  # Run SQL migrations
cd packages/engine && pnpm run typecheck                # tsc --noEmit

# api-server
cd packages/api-server && pnpm run dev                  # Start on :8082 (needs MAPLESPIKE_API_KEY)

# sdk
cd packages/sdk && pnpm build                           # tsup CJS+ESM+types
cd packages/sdk && pnpm test                            # Builds first, then runs tests!

# portal
cd packages/portal && python3 -m http.server 4321       # Or: npx serve . -p 4321

# changesets
pnpm changeset                                           # Create version/changelog entry
```

---

## MCP Server Architecture

The MCP server has **dual transport** in a single binary (`dist/cli.js`):

- **Mode auto-detected by `PORT` env var**: if PORT is set (>0), starts HTTP SSE server. Otherwise, stdio.
- **Standalone SSE-only entry**: `dist/index.js` (separate file, hardcoded PORT=3001).
- **API dependency**: 14 search tools proxy through the API server via `api-client.ts`. The AI tools and `system_health` are standalone.
- **Test quirk**: MCP integration tests need the API server running (`packages/api-server/dist/dev-server.js` on port 8082). Smoke/smoke tests will fail without it.

**Local dev:**
```bash
export MAPLESPIKE_API_KEY=dev-key
cd packages/mcp-server
pnpm start   # stdio mode — connect from any MCP client
```

---

## Git Hooks

Hooks live in `.githooks/` (not a pre-commit framework). They are NOT auto-installed by pnpm — configure with:
```bash
git config core.hooksPath .githooks
```

| Hook | Behavior |
|------|----------|
| `pre-commit` | **Blocks commits on `prod` branch** with error message directing user to use CI/CD |
| `prepare-commit-msg` | **Warns** if commit message lacks `#NNN` issue reference (non-blocking for manual commits) |

---

## GitHub Issues Workflow (MANDATORY)

Every change **must** have a GitHub issue. No issue = no code.

1. **Check**: `gh issue list -R reverb256/maplespike --limit 10`
2. **Create**: `gh issue create -R reverb256/maplespike --title "..." --label "p2,frontend" --body "..." --assignee "@me"`
3. **Branch**: `git checkout -b issue-NNN-short-description`
4. **Commit**: Message must include `(#NNN)` — e.g., `feat: add IRCC immigration module (#42)`
5. **PR**: Body must contain `Closes #NNN` or `Related to #NNN`

**Labels:** `bug`, `enhancement`, `p1`, `p2`, `k8s`, `frontend`, `module`, `security`, `documentation`, `cleanup`

---

## CI/CD Pipeline

| Branch | Workflow | Action |
|--------|----------|--------|
| `main` | CI (ci.yml) | Build + test all packages |
| `main` | Deploy Dev (deploy-dev.yml) | Build images → deploy to `maplespike-dev` → **auto-merge to `prod`** |
| `prod` | Deploy Prod (deploy-prod.yml) | Build images → deploy to `maplespike-prod` |
| `prod` | Publish (publish.yml) | npm (via Changesets) + PyPI |

**CI test order**: pipeline-core → mcp-server (needs API server running) → engine → sdk → build-only checks (legal-core, legislation, api-server).

**CRITICAL**: Never commit/push to `prod` directly. Pre-commit hook blocks it. All changes flow `main → CI → deploy-dev → auto-merge to prod → deploy-prod`.

**Prod namespace is `maplespike-prod`**, not `maplespike` (the k8s dir is `k8s/prod/` mapped to namespace `maplespike-prod`). The original `maplespike` namespace still exists but dev now deploys to `maplespike-dev`.

**Container image tags**: `:dev` (dev builds), `:latest` and `:stable` (prod builds), `:$sha` (both).

**Image naming**: `ghcr.io/reverb256/maplespike/maplespike-{service}:{tag}` (repo-scoped, works with GITHUB_TOKEN).

---

## Data Module Architecture

Every ingestion module lives at `packages/pipeline-core/src/ingestion/<module>/` with:
- `constants.ts` — URL configs, source definitions
- `types.ts` — TS interfaces
- `fetcher.ts` — HTTP/API fetch
- `parser.ts` — Data parsing and normalization
- `db.ts` — DB persistence (optional)
- `index.ts` — Public API (`ingest*`, `search*`)

Register new modules in `packages/pipeline-core/src/ingestion/registry.ts`. The metrics.json is **NOT auto-generated** — update it manually when adding modules/tools.

**67 ingestion subdirectories** (including cross-reference, attestation, gc-standards — which are utilities, not data modules).

---

## Testing Quirks

- **MCP tests** (`node --test`) require the API server running on port 8082 (CI starts it as a background process).
- **SDK tests** run `pnpm build` first as part of the test script. Running `tsx --test` directly without building will fail.
- **Engine tests** use vitest (no vitest.config.ts — defaults only). All other packages use Node built-in `node --test` with tsx.
- **No test config files** in root — each package self-defines.
- **CI only runs**: pipeline-core, mcp-server, engine, sdk tests. Other packages are build-only checks.

---

## Key Workflow Rules

### BUILD IT OUT, DO NOT DELETE
- Empty placeholder dirs (e.g., `defence-veterans/`) represent planned work — build them out
- Never delete stubs, strip TODOs, or simplify to "skeleton" — that is failure

### TEST BEFORE PR
- Run `pnpm test` at root (or at least the affected packages)
- Check MCP test failures — smoke tests needing a running API server are expected to fail locally
- Run `pnpm build` to ensure no TS errors

### NO TYPE SUPPRESSION
- Never use `as any`, `@ts-ignore`, `@ts-expect-error` — fix type errors properly

### DATA CITATIONS
- Every factual record requires SHA-256 citation hash + trust score (≥60% threshold)
- Cross-reference ≥2 independent sources for high-sensitivity data (immigration, Indigenous, defence)

---

## Multi-Host Worktree Workflow (zephyr / nexus / sentry / forge)

Cluster has 4 machines sharing the same repo via a bare repo hub:

| Machine | Clone path | Bare remote URL |
|---------|-----------|-----------------|
| **zephyr** (current) | `/data/projects/own/maplespike` | `file:///srv/git/maplespike.git` |
| **nexus** | `/data/projects/own/maplespike` | `ssh://zephyr/srv/git/maplespike.git` |
| **sentry** | `/data/projects/own/maplespike` | `ssh://zephyr/srv/git/maplespike.git` |
| **forge** | `/data/projects/own/maplespike` | `ssh://zephyr/srv/git/maplespike.git` |

**Remotes on every clone:** `bare` (sync hub), `origin` (GitHub), `gitea` (Gitea).

**Workflow:**

1. **Create a worktree** for a branch:
   ```bash
   git worktree add -B feat/my-thing ../maplespike-feat bare/main
   ```

2. **Work, commit, push:**
   ```bash
   cd ../maplespike-feat
   # edit, git add, git commit
   git push bare HEAD
   ```
   Bare repo's post-receive hook auto-mirrors to GitHub + Gitea.

3. **Sync another machine** to the same branch:
   ```bash
   git fetch bare
   git worktree add -B feat/my-thing ../maplespike-feat bare/feat/my-thing
   ```

4. **Update existing worktree** with latest main:
   ```bash
   git fetch bare main
   git merge bare/main
   ```

5. **Clean up** when done:
   ```bash
   git worktree remove ../maplespike-feat
   git branch -d feat/my-thing
   ```

**SSH keys:** All 4 machines share the same `id_ed25519` + SSH certificate. Copy from zephyr if a new node needs access:
```bash
scp ~/.ssh/id_ed25519* $host:~/.ssh/
```

---

## Quick Start (Full Setup)

```bash
pnpm install
pnpm build

# MCP server (stdio) — no external deps needed in dev
export MAPLESPIKE_API_KEY=dev-key
cd packages/mcp-server && pnpm start

# All 22 tools return real data from pipeline-data.json. No external DB needed.
```

For full-stack dev (API + MCP):
```bash
# Terminal 1: API server
export MAPLESPIKE_API_KEY=dev-key
node packages/api-server/dist/dev-server.js

# Terminal 2: MCP (stdio, needs API running for 14 proxy tools)
export MAPLESPIKE_API_KEY=dev-key
export MAPLESPIKE_API_URL=http://localhost:8082/v1
cd packages/mcp-server && pnpm start
```
