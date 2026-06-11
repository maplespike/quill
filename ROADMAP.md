---
last-reviewed: 2026-06-11
status: active
---

# MapleSpike Roadmap

> **Current version:** v0.2.1 (2026-05-13)
> **Build:** ✅ `pnpm build` passes (12/12 packages)
> **Tests:** 468 passing (pipeline-core 339, api-server 66, engine 56, sdk 7)
> **Modules:** 135 ingestion directories, 142 registry entries
> **MCP tools:** ~53 registered in tools/index.ts

---

## Phase 1: Build Integrity & CI (NOW — June 2026)

| Task | Status | Notes |
|------|--------|-------|
| Fix mcp-server build (4 missing tool files, pino dep) | ✅ DONE | Committed 1fbe306 |
| Add `.github/workflows/ci.yml` | ✅ DONE | Build + test on push |
| Fix fantasy docs (PIPELINE-ARCHITECTURE.md, SELF-HEALING.md) | ✅ DONE | Added aspirational warnings |
| Close stale open issues | ✅ DONE | Closed 5 issues marked "complete" but still open |
| Verify flake.nix image builds | 🔴 BLOCKED | Remote builder sandbox has no npm network access. Needs `__noChroot` or local build |

## Phase 2: MVP Quality Gate (Next)

| Task | Priority | Effort | Notes |
|------|----------|--------|-------|
| Add mcp-server tests (mock HTTP layer) | P1 | 2-4h | Currently 0 tests — "#1 quality gap" |
| Close remaining 7 open issues | P1 | 1h | #557, #549, #642, #617, #393, #370, #564 |
| Align metrics.json (135→~53 MCP tools) | P2 | 30m | Currently overstated by ~2.5x |
| Add last-reviewed metadata to 7 remaining doc files | P2 | 15m | Mechanical fix |
| Create k8s/ manifests for dev deployment | P2 | 2-4h | Currently none exist despite being documented |
| Strip 37% placeholder modules from production view | P3 | 1-2h | 32 metadata-only/skeleton modules |

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
