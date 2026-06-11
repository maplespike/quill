---
last-reviewed: 2026-05-23
status: active
---

# AGENTS.md — MapleSpike

> **Mission**: Build the Library of Alexandria for Canadian public data — 150+ modules covering every federal, provincial, territorial, and municipal source.
> **Current metrics**: [docs/metrics.json](./docs/metrics.json) — 142 modules, 135 MCP tools, ~178K lines TS, 13 packages.

Quick reference for agents working in this repo. Don't guess — check here first.

---

## Repository Identity

| Attribute | Value |
|-----------|-------|
| Type | pnpm monorepo (pnpm@10.32.1) |
| Orchestrator | Turbo (workspace config in `turbo.json`) |
| Node | ≥18 (CI uses 22) |
| Packages | 12 in `packages/*` |
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

---

## Commands

### Root
```bash
pnpm install                     # Install all deps
pnpm build                       # Turbo topological build
pnpm -r build                    # Bypass Turbo, build each package independently
pnpm test                        # Turbo: build → test all
pnpm -r test                     # Run all package tests (no Turbo)
pnpm run clean                   # Remove dist/ and tsconfig.tsbuildinfo
```

### Per-package
```bash
# mcp-server
cd packages/mcp-server && pnpm start                  # stdio mode
cd packages/mcp-server && pnpm start:sse               # SSE mode on :3001
cd packages/mcp-server && pnpm test

# engine
cd packages/engine && pnpm test                         # vitest run
cd packages/engine && pnpm run migrate                  # Run SQL migrations
cd packages/engine && pnpm run typecheck                # tsc --noEmit

# api-server
cd packages/api-server && pnpm run dev                  # Start on :8082

# sdk
cd packages/sdk && pnpm build                           # tsup CJS+ESM+types
cd packages/sdk && pnpm test
```

---

## Git Hooks
```bash
git config core.hooksPath .githooks
```
| Hook | Behavior |
|------|----------|
| `pre-commit` | Blocks commits on `prod` branch |
| `prepare-commit-msg` | Warns if commit lacks `#NNN` reference |

---

## Primary Workflow

Every change flows: **Issue → Branch/Worktree → PR → Merge → Close Issue**.

1. **Issues first**: `gh issue create -R reverb256/maplespike --title "..." --label "p2" --body "..." --assignee "@me"`
2. **Worktree**: `git worktree add -b issue-NNN-desc /data/projects/own/maplespike-NNN main`
3. **Develop**: Commit with `(#NNN)` in message
4. **PR**: `gh pr create -R reverb256/maplespike --base main --head issue-NNN-desc --title "feat: description (#NNN)" --body "Closes #NNN"`
5. **Merge**: Squash-merge via GitHub UI
6. **Cleanup**: `git worktree remove /data/projects/own/maplespike-NNN && git branch -d issue-NNN-desc`

---

## Claude Code Protocol — Updated

The AI Inference Gateway now has a **real Anthropic `/v1/messages` endpoint**. Claude Code can route through the gateway:

```json
// ~/.claude/settings.json
{
  "model": "claude-sonnet-4",
  "provider": {
    "apiKey": "***",
    "baseUrl": "http://ai-inference-gateway.ai-inference.svc.cluster.local:8080"
  }
}
```

Model mapping (hardcoded in gateway router.py):
- `claude-haiku-4` → local Qwen 0.8B distilled
- `claude-sonnet-4` → local Qwen 9B distilled
- `claude-opus-4` → local Qwen 35B distilled

Supports thinking levels, PII sanitization, and full gateway routing.

---

## Kelos Model Routing

When Kelos spawns agents for MapleSpike issues, the model is selected by `model-routing-controller`:

| Issue Label | Model | Reason |
|-------------|-------|--------|
| `bug` / `fix` | Omni 30B (reasoning) | Debugging |
| `enhancement` / `feature` | Super 120B | Code generation |
| `documentation` | Qwen 3 Coder 480B | Prose |
| `data` / `analysis` | Nano 30B | Analysis |
| Default | Nano 30B | General |

Updated every 15min by controller, every 6h by benchmark.

---

## CI/CD Pipeline
_(unchanged)_

---

## Data Module Architecture
_(unchanged)_

---

## Related Repositories

- [reverb256/ai-inference-gateway](https://github.com/reverb256/ai-inference-gateway) — AI gateway, model routing (#38), eval pipeline (#60)
- [reverb256/nixos-config](https://github.com/reverb256/nixos-config) — Cluster NixOS config
