---
last-reviewed: 2026-06-11
status: active
---

# MapleSpike Roadmap

> **Current version:** v0.2.1 (2026-06-12)
> **Build:** ✅ `pnpm build` passes (13/13 packages)
> **Tests:** 696 passing (pipeline-core 339, mcp-server 215, api-server 66, engine 56, sdk 7, notification-service 13)
> **Modules:** 144 registry entries (9 marked placeholder)
> **MCP tools:** 129 registered in tools/index.ts (164 tool definition files)
> **MVP tracker:** [#665](https://github.com/reverb256/maplespike/issues/665) — Real readiness: ~30%
> **Open issues:** 7 (3 quality sub-issues + 4 strategic)

---

## Phase 1: Build Integrity & CI ✅ DONE

| Task | Status |
|------|--------|
| Fix mcp-server build (4 missing tool files) | ✅ |
| Add `.github/workflows/ci.yml` | ✅ |
| Archive 3 fiction docs (PIPELINE-ARCHITECTURE, SELF-HEALING, K8S-NIX-MANIFESTS) | ✅ |
| Fix kanban docs (empty board, no cronjobs) | ✅ |
| Fix metrics.json (135→53 MCP tools) | ✅ |
| Fix ARCHITECTURE.md metrics | ✅ |
| Close 5 stale issues | ✅ |
| Fix #642 shared imports | ✅ |
| Add MCP server tests (215) | ✅ |
| Fix notification-service tests (4 SQLITE_ERROR) | ✅ |
| Add Dockerfile + docker-compose.yml | ✅ |
| Mark 16 placeholder modules in registry | ✅ |
| Label remaining 4 open issues | ✅ |

## Phase 2: MVP Quality Gate (Next)

| Task | Priority | Effort | Notes |
|------|----------|--------|-------|
| **Docker compose build verification** | P0 | 30m | Run `docker compose build` and verify locally |
| **Create end-to-end run script** | P1 | 1h | Script that shows: clone → install → build → ingest → query |
| **Fix flake.nix sandbox for Nix image builds** | P1 | 1-2h | Add `__noChroot = true` to maplespike-build derivation |
| **Close #268 (AI Ask)** needs scoping | P1 | - | This is the largest remaining feature — needs PRD |
| **Update metrics.json** | P2 | 15m | Run `node scripts/generate-metrics.mjs` and commit |

## Phase 3: Deployment (This Month)

| Task | Priority | Effort |
|------|----------|--------|
| Create `run.sh` for local dev (install → build → start) | P1 | 1h |
| Fix flake sandbox for Nix image builds | P1 | 1-2h |
| CI publish to GHCR on main merge | P2 | 1h |
| Deploy dev namespace on K3s | P2 | 2-4h |

## Remaining Open Issues

| # | Title | Priority | Status |
|---|-------|----------|--------|
| 268 | AI Ask — natural language Q&A | P1 | Needs scoping/PRD |
| 549 | Quality Baseline & Competitive Gaps | P1 | Epic — partially done |
| 309 | OWASP compliance dashboard | P2 | Security headers done, dashboard remaining |
| 318 | Sovereign LLM Fine-tuning | P2 | Blocks on #268 |
