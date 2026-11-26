---
last-reviewed: 2026-08-11
status: active
---

# Quill Gap Map — spec intent → current state → GitHub issue

> **Purpose:** every intended-but-not-yet-done item from the ecosystem strategy is tracked here and on
> GitHub. This is the "map all the gaps" document: for each gap it names the spec direction, the
> intent source (plan file + section), the **verified** current state (2026-08-11), the tracking
> issue, and the exit criteria.
>
> **Canonical backlog:** [`ROADMAP.md`](../ROADMAP.md) (phases) · **Execution plan:**
> [`ECOSYSTEM-EXECUTION-PLAN.md`](./ECOSYSTEM-EXECUTION-PLAN.md) (WS-0…WS-7, milestones M0–M4) ·
> **Strategy memo:** [`STRATEGIC-2026-08-ECOSYSTEM-UPGRADE.md`](./STRATEGIC-2026-08-ECOSYSTEM-UPGRADE.md)
> (P0/P1/P2 blind spots). New gaps are added here first, then filed as issues under the parent
> [#827](https://github.com/maplespike/quill/issues/827).

## How to read this

- **ID** — gap identifier used across issues (`GAP-n`).
- **Direction** — which of the six spec directions the gap serves.
- **Intent source** — where the item is promised in-tree.
- **State (verified)** — what was confirmed on disk / live 2026-08-11, not what the plan hoped for.
- **Issue** — the GitHub tracking issue.

Status legend: 🔴 open · 🟡 in progress · 🟢 done (live-verified)

---

## Gap matrix (open work)

| ID | Direction | Intent source | State (verified 2026-08-11) | Issue | Exit criteria |
|----|-----------|---------------|------------------------------|-------|---------------|
| GAP-1 | 2 (composition) | Exec plan §WS-1b/WS-2, M2 | 🟢 **DONE 2026-08-11** — graph-builder wired into `runModule`; live committees run (limit=2) → 492 entities / 897 mentions / 4350 links; `resolveEntity` returns real ids; `search_cross_reference` returns `graph: true` (committees registry + connections); lobbying/gic backfills added + unit-tested | ~~[#828](https://github.com/maplespike/quill/issues/828)~~ | Live ingestion (committees/lobbying/GIC) populates the entity graph; `linked_entities` returns per-registry evidence; `search_cross_reference` graph path fires — **all verified live** |
| GAP-2 | 3 (agent-native) | Exec plan §WS-3 | Only `notifications/progress` emitted (`server.ts:663-674`); no job model; 55s handler timeout | [#829](https://github.com/maplespike/quill/issues/829) | Heavy cross-reference completes via chunked/progressed results; documented |
| GAP-3 | 3 (agent-native) | Exec plan §WS-3; plan §1 audit row | Server is 2 protocol majors behind (2025-03-26 vs 2026-07-28) | [#830](https://github.com/maplespike/quill/issues/830) | `QUILL_PROTOCOL_VERSION` opt-in gives stateless mode + `subscriptions/listen`; defaults unaffected |
| GAP-4 | 4 (barrier) | Exec plan §WS-4 | **`QUILL_LITE` env does not exist** (grep empty); zero-DB stdio mode implicit, not a product | [#831](https://github.com/maplespike/quill/issues/831) | `QUILL_LITE=1 npx @maplespike/quill-mcp` runs with no DB; DB tools error gracefully |
| GAP-5 | 4 (barrier) | Exec plan §WS-4 | `packages/sdk/src/ingestion.ts` exports exist, undocumented as pattern library | [#832](https://github.com/maplespike/quill/issues/832) | CKAN/Socrata/ArcGIS/XML fetcher patterns documented on the SDK surface |
| GAP-6 | 4 (barrier) | Exec plan §WS-4 | Pattern-only; no per-tenant recipe doc | [#833](https://github.com/maplespike/quill/issues/833) | Documented env-based naming + `charts/quill/values.yaml` overrides |
| GAP-7 | 4 (barrier) | Exec plan §WS-4 | No `packages/sdk/examples/` files | [#834](https://github.com/maplespike/quill/issues/834) | `verify-claim.ts` + `crossref-agent.ts` committed, typechecked |
| GAP-8 | 3/4 | Exec plan §WS-5 | Annotations API + `get_annotations` exist; integration docs absent | [#835](https://github.com/maplespike/quill/issues/835) | Gazette/Mosaic integration notes in `docs/integrations/` |
| GAP-9 | 5 (monetization) | Exec plan §WS-6; plan §1 audit row | x402 proof parsed from tool args, not `_meta["x402/payment"]` | [#836](https://github.com/maplespike/quill/issues/836) | Standard x402 wallet calls a paid tool without Quill shims; settlement receipts |
| GAP-10 | 5 (monetization) | Exec plan §WS-6 | No published price map; resource/prompt free-tier undocumented | [#837](https://github.com/maplespike/quill/issues/837) | Price map + free-tier scope published in `building-on-quill.md` |
| GAP-11 | 6 (focus) | Exec plan §WS-7 | `search_*` thin-CKAN wrappers unlabeled; no Featured tier | [#838](https://github.com/maplespike/quill/issues/838) | Hygiene pass done; 7 cross-ref tools Featured; metrics.json refreshed |
| GAP-12 | 1 (verification) | Memo §3 P1 | Hashes exist; `quality` score absent; `provenance.ts` real but unused | [#839](https://github.com/maplespike/quill/issues/839) | `ClaimBundle.quality` (source tier, freshness, extraction confidence) in `get_citation` + verify responses |
| GAP-13 | 6/2 (outcome data) | Memo §3 P1 | Modules scattered across ROADMAP 5.2/5.3; no joined dataset | [#840](https://github.com/maplespike/quill/issues/840) | **Joined versioned dataset** (immigration+housing+labour+fiscal+crime) with methodology note — acceptance is the dataset, not module count |
| GAP-14 | 1/2 (transparency) | Memo §3 P1 | OIC module only in gap list; nothing else | [#841](https://github.com/maplespike/quill/issues/841) | Completed-ATI summaries + proactive disclosure feed + delay tracking |
| GAP-15 | 1 (verification) | Memo §2.1 | `/verify` page exists; no cite-any-URL bundle | [#842](https://github.com/maplespike/quill/issues/842) | Public "verify this URL" returns claim bundle for any link |
| GAP-16 | 1/4 | Memo §3 P2 | No LLM-assisted PDF→table extraction in `pipeline-core` | [#843](https://github.com/maplespike/quill/issues/843) | Public Accounts / FOI / Hansard PDFs → structured citable tables |
| GAP-17 | 3 (agents-as-infra) | Memo §3 P2 | No continuous watchers | [#844](https://github.com/maplespike/quill/issues/844) | Watchers → grounded briefings w/ citations; maps to kanban cronjobs + notification-service |
| GAP-18 | 1 (trust) | Memo §3 P2 | No evals for citation accuracy | [#845](https://github.com/maplespike/quill/issues/845) | citecheck-analog suite runnable in `pnpm test` |
| GAP-19 | 6 (focus) | Memo §2.2 (P2 sketch) | No news-archive module | [#846](https://github.com/maplespike/quill/issues/846) | Neutral news-archive module; **inclusion policy defined before build** (guardrail) |
| GAP-20 | 5 (reliability) | Exec plan §WS-0 | `/v1/status` live + auth-exempt; portal status page + subdomain not wired | [#847](https://github.com/maplespike/quill/issues/847) | Portal status page + `status.maplespike.ca` serving `/v1/status` |
| GAP-21 | 1 (verification) | Exec plan §WS-1e | `withClaims` on 7 tools only; sweep incomplete | [#848](https://github.com/maplespike/quill/issues/848) | Every upstream-returning tool emits a `claims` array |
| GAP-22 | 2 (composition) | Exec plan §WS-2 | `docs/schemas/index.md` deferred | [#849](https://github.com/maplespike/quill/issues/849) | Schema inventory published for non-MCP authors |

**Parent tracking issue:** [#827](https://github.com/maplespike/quill/issues/827) (labels: `parent-issue` `roadmap` `strategic`).

---

## What is already done (so the map is complete, not just the gaps)

Verified 2026-08-11 — these are **not** gaps, do not re-file:

| Spec ask | State |
|----------|-------|
| D1: claim bundles SHA-256 + source + retrieval time | 🟢 Live — claim store 6.5 MB, **7 claims survive pod rollouts**, `/v1/claims/verify/{hash}` returns `verified: true` |
| D1: verify without full access | 🟢 Live — `GET /v1/claims/verify/:hash` + `verify_claim` MCP tool |
| D1: graph fragments as MCP resources | 🟢 Registered — `quill://tool-index`, `quill://schemas{/module}`, `quill://entities/{id}`, `quill://citations/{hash}`, `quill://crossref/{entityId}` |
| D2: entity ID scheme + REST twin | 🟢 `quill://entity/{id}`, `GET /v1/entities/{id}` + `/links` (data gate = GAP-1 — **now closed**: graph live-verified 2026-08-11) |
| D3: curated skills | 🟢 `quill-influence-mapping` + `quill-provenance-briefing` (SKILL.md, v1.0.0, Hermes metadata) |
| D3: resources/prompts exposure | 🟢 `resources/list\|read\|templates`, `prompts/list\|get` (influence-map, provenance-brief, narrative-shift) |
| D4: one-command local + free discovery tier | 🟢 stdio `npx`, free tier 1,000 calls/mo, discovery/metadata tier |
| D4: building-on-quill guide | 🟢 `docs/building-on-quill.md` with worked composition example |
| D5: reliability/sovereign ops | 🟢 Registry systemd-managed, seed-neighbors timer reboot-validated, PVC-backed `/data`, canonical `nix build .#saas-manifests`, VAP + PSA hardening |
| D5: informal SLA | 🟢 `/v1/status` (99% best-effort, freshness windows, endpoint map, claim-store count) |
| D6: influence/parliament depth | 🟢 186 MCP tools / 0 dupes, `get_politician_influence`, `track_bill`, `signal_check` |
| Near-term: go-live reliability | 🟢 Live sweep 200s across quill/api/mcp; claims 7/7 post-rollout |

## Priority order (suggested execution)

1. ~~**GAP-1**~~ — populate the entity graph: **DONE 2026-08-11** (graph-builder + committees/lobbying/gic backfills wired into `runModule`; 492 entities live; `search_cross_reference` graph path verified).
2. **GAP-4** — Quill Lite product (the one explicit Direction-4 deliverable that is code-missing).
3. **GAP-12 + GAP-18** — quality scores + benchmark (make "verified by Quill" measurable).
4. **GAP-2 + GAP-3** — streaming + protocol migration (agent-native depth).
5. **GAP-13, GAP-14, GAP-16, GAP-17** — memo P1/P2 data pushes (module work).
6. **GAP-15, GAP-19** — neutral citation layer (needs inclusion-policy guardrail first).
7. **GAP-5…GAP-11, GAP-20…GAP-22** — enablement/docs/monetization polish.
