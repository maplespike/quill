---
last-reviewed: 2026-05-17
status: active
---

# AGENTS.md — MapleSpike
# Kelos test - 2026-05-18 - pipeline verified

> **Mission**: Build the Library of Alexandria for Canadian public data — 150+ modules covering every federal, provincial, territorial, and municipal source.
> **Current metrics**: [docs/metrics.json](./docs/metrics.json) — 65 modules, 24 MCP tools, ~115K lines TS, 10 packages.

Quick reference for agents working in this repo. Don't guess — check here first.

---

## Permanent Principles

### Nix-native
NixOS modules in `nix/` (flake.nix, devenv.nix) are the single source of truth for deployment config. No direct k8s YAML edits, no hand-crafted wrapper scripts — CI/CD generates all derivative manifests. If you need to change how MapleSpike is deployed, change the Nix module.

### Gateway routing
All AI backend traffic routes through the AI Inference Gateway — circuit breakers, rate limiting, MCP brokerage, and observability depend on it. Never route a client directly to a backend (NIM, llama-cpp, etc.). If a backend format is incompatible, fix the gateway's transformation layer, not the routing. Send `"model": "auto"` in requests to let the gateway handle per-request model selection.

### Clean long-term solutions
Fix root causes, not symptoms. Every change should be the cleanest solution that lasts — no TODOs, no half-measures, no "fix it later" debt. If a task seems to require a workaround, stop and fix the underlying problem instead.

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

## Primary Workflow (MANDATORY — ALL AGENTS)

This workflow applies to **Hermes, Pi, OMP, OpenCode, Claude Code, and ALL delegated agents**. No exceptions.

### Golden Rule
Every change flows: **Issue → Label → Agent → PR → Merge → Close Issue**.

### Default Path: Kelos-Powered (for well-scoped issues)

1. **Create a GitHub issue** with clear acceptance criteria and a label (`bug`, `enhancement`, etc.)
2. **Label it `agent-ready`** — Kelos picks it up within ~5min
3. **Kelos handles the implementation** — agent spawns on Sentry, clones the repo, implements, pushes a branch, opens a PR
4. **Human reviews the PR** — check diff, test locally if needed, request changes via comments
5. **Merge** — squash-merge via GitHub UI
6. **Clean up** — Kelos auto-removes the finished Task after TTL expires

### Manual Fallback (exploratory/architectural/complex work)

For issues that are not well-scoped enough for autonomous execution:

1. **Issues first**: Nothing happens without a GitHub issue.
   - `gh issue view NNN -R reverb256/maplespike`
   - `gh issue create -R reverb256/maplespike --title "..." --label "p2" --body "..."`

2. **Worktree**: Worktrees let you work on multiple branches simultaneously.
   ```bash
   git worktree add -b issue-NNN-short-description /data/projects/own/maplespike-NNN main
   ```

3. **Develop on the right node**: See cluster table above.

4. **Commit**: Every commit message contains `(#NNN)` — e.g., `feat: add IRCC immigration module (#42)`

5. **PR**: Push branch → create PR with `Closes #NNN` in body.
   ```bash
   git push origin issue-NNN-short-description
   gh pr create -R reverb256/maplespike --base main --head issue-NNN-short-description \
     --title "feat: description (#NNN)" --body "Closes #NNN"
   ```

6. **Clean up**: `git worktree remove /data/projects/own/maplespike-NNN && git branch -d issue-NNN-desc`

---

## Known Frictions & Workarounds

Lessons learned from real usage. Update this section when new friction is discovered.

### SSH to Remote Nodes
The fish shell + devenv startup on remote nodes corrupts command output with:
```
Error: × IO error: not a terminal
Changes that will be made to bash/devenv.nix: ...
```
**Workaround:** Always use `bash --norc --noprofile -c "..."` for remote SSH commands:
```bash
ssh nexus 'bash --norc --noprofile -c "cd /data/projects/own/maplespike && git status"'
```
For multi-line commands, pipe through stdin:
```bash
ssh nexus 'bash --norc --noprofile 2>/dev/null' << 'REMOTE'
cd /data/projects/own/maplespike
git status --short
git log --oneline -3
REMOTE
```

### Worktree Staleness
Worktrees pinned to `bare/main` go stale (77+ commits behind) if not kept current. This causes:
- Phantom "diverged" branches
- PR merge failures
- Lost work when worktree is deleted

**Prevention:**
- After PR merge, clean up the worktree: `git worktree remove /data/projects/own/maplespike-NNN && git branch -d issue-NNN-desc`
- Verify the worktree was actually removed: `ls /data/projects/own/maplespike-NNN`
- If permissions prevent removal: `sudo rm -rf /data/projects/own/maplespike-NNN`

### Multi-Node Branch Drift
Branches created on one node are invisible to other nodes unless pushed to `origin` (not just `bare`).

**Rule:** Always push to `origin` (GitHub), not just `bare` (local). The bare repo auto-mirrors to origin, but only branches pushed to origin are visible from all nodes.

```bash
git push origin issue-NNN-short-description   # ✅ Visible everywhere
git push bare issue-NNN-short-description      # ❌ Only visible on Zephyr
```

### Template Activation Gap
The NixOS `hermes-cli.nix` template only applies to fresh config.yaml files. Existing configs are skipped (the activation script checks for a `# Managed by NixOS` marker).

**To reapply template:** Either:
1. Delete the existing config and let it regenerate: `rm ~/.hermes/config.yaml && just switch`
2. Or manually update the config sections that need changing

### Claude Code Protocol Mismatch
Claude Code speaks Anthropic API. The AI Inference Gateway speaks OpenAI API. No translation layer exists. Claude Code **must** connect directly to Z.AI's Anthropic-compatible endpoint — it cannot route through the gateway.

This is a hard constraint until the gateway adds Anthropic API support.

### Node State Verification
After any cleanup or sync operation, verify all 4 nodes:
```bash
for host in zephyr nexus forge sentry; do
  echo "$host: $(ssh $host 'bash --norc --noprofile -c "cd /data/projects/own/maplespike && git log --oneline -1"' 2>/dev/null)"
done
```

If a node reports stale HEAD, sync it:
```bash
ssh nexus 'bash --norc --noprofile -c "cd /data/projects/own/maplespike && git fetch origin && git reset --hard origin/main"'
```

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

## Current Cluster State (verified 2026-05-18)

| Machine | Shell | kubeconfig | kubectl | bare repo access | Node | pnpm | Notes |
|---------|-------|-----------|---------|----------------|------|------|-------|
| **zephyr** | bash | ✅ symlink | ✅ | ✅ file:///srv/git/maplespike.git | v24.14.1 | 10.32.1 | Worker. GitHub Actions runner target |
| **forge** | fish | ✅ symlink | ✅ | ✅ ssh://zephyr | v24.14.1 | 10.33.2 | Control-plane. Use fish-compatible syntax for SSH commands |
| **sentry** | fish | ✅ symlink | ✅ | ✅ ssh://zephyr | v24.14.1 | 10.33.2 | Control-plane. ⚠️ origin URL has embedded GHO token — rotate |
| **nexus** | bash (devenv) | ✅ symlink | ✅ | ✅ ssh://zephyr | v24.14.1 | 10.33.2 | Control-plane. API server host. Devenv shell causes non-terminal errors |

**Known issues:**
1. `k8s/prod/namespace.yaml` — `name: maplespike` fixed to `maplespike-prod` (2026-05-18)
2. pnpm version mismatch: 10.33.2 on forge/sentry/nexus vs 10.32.1 in CI — may cause lockfile changes
3. Sentry origin remote has GHO token embedded — rotate credentials

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

---

## Agent-Ready Label Criteria

Issues labeled `agent-ready` are picked up autonomously by the Kelos workflow. Kelos spawns an OpenCode agent in an isolated pod that clones the repo, implements the change, builds, tests, pushes a branch, and opens a PR.

For an issue to be `agent-ready`, it **must** satisfy ALL of:

1. **Within maplespike repo scope** — the agent only has access to this repo. Changes requiring NixOS configs, kubectl, vault, or external repos are not agent-ready.
2. **Code changes only** — the agent edits, builds, tests, commits, and pushes. No SSH, no kubectl, no nixos-rebuild, no manual ops.
3. **No external service setup** — no Stripe API keys, email server configs, vault access, or third-party signup.
4. **No subjective design decisions** — the issue must be scoped clearly enough that any reasonable implementation is acceptable.
5. **Build + test must pass** — the agent runs `pnpm build && pnpm test`. Changes must be verifiable this way.
6. **Not a meta-issue** — umbrella trackers must be decomposed into child issues first.
7. **Completable in one session** — the pod has a finite TTL (~1h). Large tasks need splitting.

**Not agent-ready:**
- Issues that say "all fixes are in NixOS/external configs"
- Deployment/ops tasks (kubectl apply, nixos-rebuild, secret rotation)
- Meta-issues / sprint trackers
- Issues requiring API keys or service credentials not in the repo
- Documentation-only issues without code changes
