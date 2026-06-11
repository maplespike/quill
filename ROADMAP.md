---
last-reviewed: 2026-06-11
status: active
---

# MapleSpike Roadmap

> **Current version:** v0.2.1 (2026-05-13)
> **Build:** ✅ `pnpm build` passes (12/12 packages)
> **Tests:** 683 passing (pipeline-core 339, mcp-server 215, api-server 66, engine 56, sdk 7)
> **Modules:** 135 ingestion directories, 142 registry entries
> **MCP tools:** ~53 registered in tools/index.ts

---

## Phase 1: Build Integrity & CI (NOW — June 2026)

| Task | Status | Notes |
|------|--------|-------|
| Fix mcp-server build (4 missing tool files, pino dep) | ✅ DONE | Committed 1fbe306 |
| Add `.github/workflows/ci.yml` | ✅ DONE | Build + test on push |
| Fix fantasy docs (PIPELINE-ARCHITECTURE.md, SELF-HEALING.md) | ✅ DONE | Added aspirational warnings |
| Add doc metadata to all 9 remaining files | ✅ DONE | Last-reviewed + status frontmatter |
| Fix metrics.json (135→53 MCP tools) | ✅ DONE | Real tool count now accurate |
| Close stale open issues | ✅ DONE | Closed 7 issues (#640, #641, #642, #653, #659, #660, #393) |
| Fix #642 shared attribution imports | ✅ DONE | worldbank-wdi fixed; 3 skeletons skipped |
| Add MCP server tests | ✅ DONE | 215 tests covering all 53 tools |
| Fix search-gic uncaught error | ✅ DONE | Added try/catch to handler |
| Verify flake.nix image builds | 🔴 BLOCKED | Remote builder sandbox has no npm network access. Needs `__noChroot` or local build |

## Phase 2: MVP Quality Gate (Next)

| Task | Priority | Effort | Notes |
|------|----------|--------|-------|
| Close remaining open issues | P1 | 30m | #617, #557, #549, #558, #564, #370 — mostly epics |
| Strip 37% placeholder modules from production view | P2 | 1-2h | 32 metadata-only/skeleton modules |
| Create k8s/ manifests for dev deployment | P2 | 2-4h | Currently none exist despite being documented |
| docker-compose.yml for local stack | P1 | 2h | Flake outputs one already, needs access to images |

## Phase 3: Deployment (This Month)

| Task | Priority | Effort |
|------|----------|--------|
| Docker compose for local stack (api + mcp + portal) | P1 | 2h |
| Fix flake.nix sandbox networking for Nix image builds | P1 | 1-2h |
| CI publish to GHCR on main merge | P2 | 1h |
| Deploy dev namespace on K3s | P2 | 2-4h |

---

## Current Blockers

1. **Remote builder sandbox**: `nix build .#maplespike-mcp-image` fails because the Nix sandbox on nexus can't reach npm registry. Fix: add `__noChroot = true` or use `--option sandbox false` for the build.
2. **MCP server test gap**: Zero test coverage. The test script is a TODO stub. Blocks confidence in the primary consumer interface.
3. **No deployment manifests**: The elaborate K8s/CI infrastructure documented in `docs/` does not exist. First step: a working `docker-compose.yml`.
