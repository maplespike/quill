# 0005 — Quill: product name for the data-layer MCP server

**Status:** ACCEPTED (2026-07-02) — Phase C complete
**Date:** 2026-07-02
**Last-reviewed:** 2026-07-02 (post-Phase-C update)
**Owner:** j_kro
**Driver:** The data-layer MCP server was previously burdened with the generic `quill-mcp` package name and `@reverb256` npm scope. Internal references called it "MapleSpike Quill" or "the data layer" interchangeably. The brand SPA's three-spike list (Fabric, Mosaic, Social Bridge) had no entry for the data-layer MCP server, creating ambiguity about what brand name the MCP tool actually answers to.

## Decision

Adopt **Quill** as the canonical product name for the data-layer MCP server.

## Naming criteria (applied)

A valid candidate must satisfy:

1. **Civic** — must read as "Canada's public record." (Matches the existing brand tagline.)
2. **Record-keeping** — must equip the MCP tool's *attested-data* identity, not just "another data source."
3. **Civic / Canadian-friendly** — must be readable by anyone in 1–2 words.
4. **Differentiated from `Fabric`** — Fabric is already a sibling product in the brand SPA; the data layer's name must not collide semantically.
5. **CLI-friendly** — `ms <name> query` must read aloud without spelling out.
6. **Ownable** — no major colliding trademarks in the data / MCP / civic space.

## Considered candidates (round 1)

| Candidate | Reasoning | Decision |
|---|---|---|
| **Quill** | Civic-feel, "Canada's public record", one-syllable, unmatched CLI | **ACCEPT** |
| Hansard | Most authentic Canadian-civic reference; reads as "the public record" | REJECT — one word as a project sounds like a 2014 TS library |
| Gazette | Official government bulletin; doubly Canadian | REJECT — generic "Project Gazette" history |
| Tapestry | Strong fabric-data metaphor w/o colliding with Fabric | REJECT — declines to *sign*; data fabric is woven, not signed |
| Codex / Vellum / Ledger | Old-paper / accounting / governmental | REJECT — too niche |
| Lattice / Filament / Loom | Fabric-data axis | REJECT — compete with "Fabric" |
| Sap / Heartwood / Boreal | Canadian-natural | REJECT — less immediate metaphor than Quill for "record" |
| Compass / Probe / Tap | MCP-spirit | REJECT — overloaded in tech |

## Considered candidates (round 2 — fresh angles)

| Candidate | Reasoning | Decision |
|---|---|---|
| Docket | Legal-civic, distinctive in MCP space, easy CLI | REJECT — reads as "court" (adversarial), not "record" |
| Attest | Verb-first, professional; "attested data" | REJECT — could read as crypto, off-axis |
| Tabled | Parliamentary metaphor; verb-first | REJECT — British-coded nuance, opaque to Americans |
| Quire | Old bookbinder's term; "a quire of records" | REJECT — too quiet; needs explanation first time |
| Polaris / Caribou / Loon | Northern-Canadian | REJECT — too decorative; doesn't speak to data layer |

Quill was reaffirmed in round 2 — user picked it in both rounds.

## Consequences

- ✅ **No new product is created.** Quill is the renamed and re-skinned `packages/quill-mcp/` (→ `packages/quill-mcp/`). Source code path complete in Phase C.
- ✅ **No infrastructure change yet.** Quill continues to live at `data.maplespike.ca` via cloudflared. URL rotation deferred to Phase D; `quill.maplespike.ca` toggle in Cloudflare Dashboard follows next migration window.
- ✅ **Brand SPA can adopt Quill without dependency on code rename.** Phase A only changes `maplespike-brand/src/pages/Landing.tsx`.
- ✅ **`@maplespike/quill-mcp` npm scope fixed in Phase C** — root `package.json`'s `build:quill` script now uses `pnpm --filter @maplespike/quill-mcp build`. The `@reverb256/` drift was a stale leftover, not a published-scope choice. (Tracked issue to follow: publication-as-`@maplespike/quill-mcp` once the npm org is ready.)
- ✅ **Tool count discrepancy reconciled** — `164` is the canonical tool count (per `docs/metrics.json`). Both `packages/quill-mcp/README.md` and top-level docs use 164.
- ⚠️ **Confusion risk** — until the rename completes, "Quill" and "the MCP server" coexist. Documented in this ADR and the product brief.

## Implementation phases

| Phase | Scope | Risk | Branch / commit |
|---|---|---|---|
| **A** | Brand SPA landing page: 4th spike "Quill" | Lowest (brand-only) | `feature/quill-brand-spike` |
| **B** | This ADR + product brief + `README.md` / `AGENTS.md` / `CLAUDE.md` / `FORK_PLAN.md` updates | Low (string-only) | `docs/quill-product-name` *(this commit)* |
| **C** | `packages/quill-mcp/` → `packages/quill-mcp/`, `@maplespike/quill-mcp` scope, downstream import fixes | ✅ DONE (commit on `docs/quill-product-name` branch) | `docs/quill-product-name` |
| **D** | Add `quill.maplespike.ca` as alias tunnel route; keep `data.maplespike.ca` as legacy | Highest (Cloudflare token policy blocks) | `infra/quill-domain-alias` |

## References

- Product brief: [`docs/products/quill.md`](../products/quill.md)
- Routing: [`docs/ROUTING.md`](../ROUTING.md), [`docs/decisions/0004-split-hostname-routing.md`](./0004-split-hostname-routing.md)
- Cleanup commit already on origin: `fix/deploy-pages-yaml-and-routing-table`
- Phase C commit (this rename): on `docs/quill-product-name` branch
