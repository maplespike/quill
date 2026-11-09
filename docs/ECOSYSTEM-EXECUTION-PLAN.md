---
last-reviewed: 2026-08-09
status: active
---

# Quill as the Canadian Data Substrate — Ecosystem Execution Plan

> **Thesis:** Quill's highest-leverage role is not "the biggest Canadian data MCP." It is the
> **trustworthy, sovereign, composable memory layer** that makes every other Canadian-focused
> agent and tool more reliable and less hallucinated. Everything else (more modules, better
> portal, Stripe tiers) should serve that.
>
> **This document is the execution plan to make that real.** It is grounded in an audit of the
> current codebase (August 2026). The canonical *backlog* lives in [`ROADMAP.md`](../ROADMAP.md);
> this is the *how*, sequenced into milestones with file-level work items and validation gates.

---

## 1. Ground-Truth Audit: What Is Real vs. Aspirational

The plan is built on verified facts. Every "direction" in the strategy maps to a current state
below. **The single most important finding: the verification layer — the claimed crown jewel —
is the least-real part of the stack.** It must be made real first; everything else compounds on it.

| # | Claim / Direction | Ground truth (file-verified, 2026-08-09) | Verdict |
|---|---|---|---|
| 1 | "SHA-256 citation hashes on every response" (`packages/portal/agent-card.json`) | No tool calls `registerCitation` outside `get-citation.ts` + tests. `fact-check.ts` and sampled tools emit **no** hash bundles. | ❌ **False today** |
| 1 | Real SHA-256 machinery | `packages/pipeline-core/src/verification/hashing.ts` (`computeHash`/`verifyHash`), attestation suite (`Citation` envelope, `buildMerkleRoot`, `generateMerkleProof`, Ed25519 `signCitation`/`verifyCitationSignature`, in-memory `ContentAddressableStore`) in `packages/pipeline-core/src/ingestion/attestation/index.ts` | ✅ Real, **disconnected** |
| 1 | `get_citation` MCP tool | `packages/quill-mcp/src/tools/get-citation.ts` stores records under a **pseudo-hash** (32-bit JS string fold) in a **per-session in-memory Map** — not SHA-256, not persistent | ❌ Broken design |
| 1 | Public verification endpoint | `packages/api-server/src/routes/citation.ts`: `findRecordByHash()` **hardcoded to `return null`** → `/v1/citation/:hash` always 404s | ❌ Stub |
| 1 | Provenance scoring | `packages/pipeline-core/src/quality/provenance.ts` (`scoreProvenance`, `computeSourceTrust`, `scoreCitationChain`) | ✅ Real, unused by MCP |
| 2 | Cross-reference engine (entity graph) | `packages/engine/` full library: `entity/{resolver,linker,disambiguation,aliases}.ts`, `graph/{builder,queries,signals,cycles,metrics,validation}.ts`, `orchestrator`. MCP `resolve_entity`/`find_connections` backed by `packages/quill-mcp/src/tools/entity-resolver-lib.ts` querying `@maplespike/database` (`entities`, `entity_aliases`, `entity_links`, `entity_mentions`) | ✅ Real |
| 2 | `search_cross_reference` MCP tool | `packages/quill-mcp/src/tools/search-cross-reference.ts` is a **CKAN keyword search** with "cross reference entity" appended — does not touch the entity graph | ❌ Facade |
| 2 | Entity DB populated? | `packages/pipeline-core/maplespike.sqlite` is **4 KB** — effectively empty. `resolve_entity` returns stubs until ingestion populates `entities`/`entity_links` | ⚠️ Sparse |
| 3 | MCP resources/prompts | `packages/quill-mcp/src/server.ts` advertises `capabilities: { tools: {} }` only; `handleMessage` handles initialize / initialized / tools-list / tools-call. No `resources/*`, no `prompts/*`, no streaming, no progress | ❌ Absent |
| 3 | Discovery | `discover_tools` (BM25 over a **hard-coded** tool index in `discover-tools.ts`), `explore_catalog`; bilingual fr-CA descriptions | ✅ Partial |
| 3 | Long-running / job support | None (55s handler timeout, `QUILL_HANDLER_TIMEOUT_MS`) | ❌ Absent |
| 4 | Zero-config local path | Local stdio entry is `node packages/quill-mcp/dist/cli.js` after `pnpm --filter @maplespike/quill-mcp... build`. `@maplespike/quill-mcp` is not on npm (checked 2026-10-14), so `npx` does not install it. Hosted quota and x402 stay on the SSE server. | ⚠️ Checkout build |
| 4 | "Building on Quill" / ecosystem docs | **None.** `docs/` has ops/architecture docs only. `docs/products/quill.md` is **0 bytes** (empty). No `docs/mcp/`, no `docs/guide/` | ❌ Absent |
| 4 | Quill Lite / read-replica mode | Implicit (stdio `npx` = no DB). Not documented as a product | ⚠️ Implicit |
| 5 | Reliability / go-live | ROADMAP Phase 4 in progress; Cloudflare tunnel DNS wired (quill/api/mcp/data/datafabric.maplespike.ca); K3s drift items tracked (forge node, sops secrets, cloudflared-creds); MVP tracker #665 at ~30% | 🔄 In flight |
| 5 | Informal SLA / status page | None | ❌ Absent |
| 6 | Focus on influence/parliament depth | 184 tools, 207 modules; `get_politician_influence`, `track_bill`, `signal_check`, `get_entity_profile` | ✅ Real |
| — | MCP protocol version | From-scratch JSON-RPC, `2025-03-26` handshake. Ecosystem moved to 2026-07-28 spec (stateless, resources w/ `ttlMs`, `subscriptions/listen`, MRTR) | ⚠️ 2 majors behind |
| — | x402 payment shape | `x402-middleware.ts` extracts payment from tool args; spec-standard places proof in `_meta["x402/payment"]` and PaymentRequired in an `isError` tool result | ⚠️ Partial alignment |

**Bottom line:** Directions 2/4/6 and the ingestion half of 1 are real. Direction 1's *public*
surface, Direction 3, and Direction 4's ecosystem docs are not. The plan below closes exactly those.

---

## 2. Guiding Principles

1. **Verification first.** No feature ships as "trusted" until `echo -n '<data>' | sha256sum`
   reproduces a Quill-issued hash. The first public thing a skeptic does is try to verify.
2. **Compose, don't own.** Expose stable schemas, entity IDs, and cross-reference surfaces so
   other MCPs link against Quill instead of reimplementing ingestion.
3. **Agent-native by default.** Resources + prompts + curated skills, not just 184 tools.
4. **Sovereign ops.** Everything must run `npx`-local, Docker, or K3s with zero cloud lock-in.
5. **Free tier stays generous.** Ecosystem experimentation is the growth engine; monetize
   after 1,000 calls and on paid tools only.
6. **Canada-first depth.** Curation effort goes to parliamentary process, regulatory influence,
   and cross-jurisdiction entity resolution — not breadth-for-breadth.

---

## 3. Workstreams

Each workstream lists concrete work items with the files they touch. Effort is rough engineering
estimate; sequencing and milestones are in §5.

### WS-0 — Reliability & Go-Live Finish (aligns with ROADMAP Phase 4)

The plan depends on dependable public endpoints. Finish the existing deploy path before
advertising ecosystem surfaces.

- [ ] Complete ROADMAP Phase 4: K3s secrets (`maplespike-secrets`, `cloudflared-creds` rotation),
      `forge` node recovery, cronjob images `quill-ingest`, DB migrations `002_*`.
      *(Files: `charts/quill/*`, `k8s/base/*`, `secrets/*`)* *(operator track — ongoing)*
- [x] **Informal free-tier SLA + status surface** — `/v1/status` endpoint live
      (`packages/api-server/src/routes/status.ts`: 99% best-effort uptime, freshness windows,
      public-endpoint map, claim-store count), auth-exempt. The portal `/status` page
      renders that payload plus municipal health and coverage. `status.maplespike.ca`
      is prepared in chart values. DNS remains an operator step ([ops/STATUS-PAGE.md](ops/STATUS-PAGE.md)).
- [x] Empty-file fix: `docs/products/quill.md` filled (product overview, verification-first,
      composition hub, skills, modes, pricing, getting started).

**Acceptance:** `curl https://api.maplespike.ca/v1/health` → 200; `mcp.maplespike.ca/health` → 200; status page live.

### WS-1 — The Claim Stack (Direction 1: make verification real) ★ CORE

The differentiator. Replaces the pseudo-hash/stub with a real, persistent, verifiable claim layer.

**1a. Real claim bundles in `pipeline-core`**
- [x] New module `packages/pipeline-core/src/claims/` with a canonical `ClaimBundle` type:
      `{ claim, value, sha256, sourceName, sourceUrl, retrievedAt, license, updateFrequency,
         transformations[], merkleRoot?, signature?, signerKeyId? }` — reuse `Citation` envelope
      and `computeHash` from attestation.
- [x] `buildClaimBundle(record, citation, opts)` — serializes a canonical JSON form
      (stable key order), hashes it, returns bundle. Reuse `buildCitation` +
      `UPDATE_FREQUENCIES`.
- [x] Batch variant `buildClaimBatch(records)` using existing `buildMerkleRoot` so one pipeline
      run commits to N records with a single root.

**1b. Persistent content-addressable store**
- [x] Replace in-memory `ContentAddressableStore` with a SQLite-backed implementation
      (`packages/database` schema: `citation_records(hash PK, serialized, citation_json,
      created_at)`), reusing `getRawDb()` used by `entity-resolver-lib.ts`. **This store IS the
      claims module's store (single implementation, in-memory fallback when no DB is present,
      e.g. stdio `npx` mode)** — the claims module in 1a wraps it; do not build two competing
      content-addressable stores.
- [x] Wire ingestion: `registry.runModule` calls `registerModuleResultClaims` (claims/ingest-hook.ts)
      after every module run, content-addressing each parsed record at parse time — capped at
      `MAX_CLAIMS_PER_RUN` (5000, env `QUILL_CLAIMS_MAX`) so 400K-record modules never stall
      ingestion; failure-safe. *(This is the step that makes `maplespike.sqlite` actually populate.)*

**1c. Fix `get_citation` MCP tool**
- [x] `packages/quill-mcp/src/tools/get-citation.ts`: delete pseudo-hash; compute real SHA-256 via
      `computeHash`; look up SQLite store first, in-memory fallback; return
      `{ verified, citation, data, verifyCommand }`. Keep `generateVerifyCommand`.

**1d. Fix the public verification endpoint**
- [x] `packages/api-server/src/routes/citation.ts`: implement `findRecordByHash` against the
      shared SQLite store (or query MCP's DB via `@maplespike/database`). `/v1/citation/:hash`
      returns 200 `{ verified: true, citation }` or 404 with guidance.

**1e. Claim bundles on responses (opt-in, high-signal tools first)**
- [x] Add a `withClaims(response, bundles)` helper in quill-mcp that appends a `claims` array to
      tool results. Wire into: `fact_check`, `ai_ask`, `get_entity_profile`, `resolve_entity`,
      `find_connections`, `track_bill`, `signal_check` (7 tools), then sweep remaining search
      tools that return upstream records.
- [x] Update `packages/portal/agent-card.json` claim to a true, scoped statement
      (e.g. "SHA-256 claim bundles on 7+ cross-reference tools, verifiable via get_citation").

**1f. Claim verification surface**
- [x] New MCP tool `verify_claim` (`packages/quill-mcp/src/tools/verify-claim.ts`): accepts a
      bundle or hash, recomputes hash locally, returns `{ verified, matches }`.
- [x] REST twin in api-server for non-MCP callers. Note: api-server routes use path-param style
      (`params.id` in `citation.ts`) — implemented as `GET /v1/claims/verify/:hash` + `POST /v1/claims/verify`
      (avoiding the pre-existing `/v1/verify/:token` email-verification route).

**Acceptance (local-first, matching the M1 gate):** `get_citation` + `verify_claim` work
end-to-end in an MCP client against the **SQLite-backed mode** (smoke must pin the DB path —
stdio `npx` falls back to in-memory and would not exercise persistence); `echo -n '<canonical
json>' | sha256sum` reproduces a stored hash. **Stretch (once operator infra lands):**
`curl -s https://api.maplespike.ca/v1/citation/sha256:<hex>` returns `verified: true` for a
live-record hash.

### WS-2 — Cross-Reference & Composition Hub (Direction 2)

> **Relationship to ROADMAP Phase 5.3 §Ph10:** Phase 5.3 already scopes a 24h cross-reference
> engine module build (GIC↔lobbying↔committees↔donations, +5 modules). WS-2 does **not**
> duplicate that engine work — §Ph10 feeds `linked_entities`; the tool is a *thin adapter* over
> the populated entity graph. Effort is not double-counted: WS-2 = tool + ID-scheme + schema
> exposure (~8h), §Ph10 = module build (24h, tracked in ROADMAP).

- [x] **Fix `search_cross_reference`** (`packages/quill-mcp/src/tools/search-cross-reference.ts`):
      rewritten graph-backed via `entity-resolver-lib` — resolves the entity, groups appearances
      into per-registry buckets (lobbying / GIC / committees / corporate / CanLII / elections /
      oversight / municipal / provincial) with confidence, returns connections; graph miss
      degrades to keyword fallback (`graph:false` + note) instead of hard error.
- [x] **Entity ID scheme (documented + stable):** canonical `quill://entity/{id}` URIs defined in
      `packages/engine/src/entity/types.ts` (`toEntityUri`/`fromEntityUri`/`isEntityUri`,
      `ENTITY_REGISTRIES`) and mirrored in `quill-mcp/src/tools/entity-resolver-lib.ts` (engine is
      not a runtime dep of quill-mcp); documented in the guide.
- [x] **`linked_entities` tool** (`packages/quill-mcp/src/tools/linked-entities.ts`): "what does
      each registry say about X" — per-registry evidence with confidence + connections + claim
      bundles; registered (tools/index.ts) and priced premium `$0.10` (pricing.ts).
- [x] **Versioned schemas:** module schemas exposed as MCP resources `quill://schemas` +
      `quill://schemas/{module}` (server.ts, cached `extractSchemas` via new shared
      `pipeline-root.ts` helper — which also fixes a pre-existing broken path in `qa_schema`).
      `docs/schemas/index.md` generation deferred to doc pass.
- [x] **Federation hook:** `quill://crossref/{entityId}` resource template live (server.ts);
      external MCPs can fetch a resolvable entity subgraph without Quill tool-calling.

**Acceptance:** `linked_entities` returns per-registry evidence with confidence for a real person;
`search_cross_reference` returns graph-backed links (not CKAN text matches).

### WS-3 — Agent-Native MCP Surface (Direction 3)

Extend the from-scratch protocol implementation in `packages/quill-mcp/src/server.ts`.

- [x] **Resources:** add `resources/list`, `resources/read`, `resources/templates/list` handlers;
      advertise `capabilities.resources`. Implement: `quill://entities/{id}` (entity subgraph
      fragment), `quill://citations/{hash}` (claim bundle), `quill://tool-index` (live-built,
      replacing the hard-coded BM25 list in `discover-tools.ts`), `quill://crossref/{entityId}`.
- [x] **Prompts:** add `prompts/list`, `prompts/get`; ship curated multi-step workflows:
      `influence-map` ("map this lobbyist's influence trail"), `provenance-brief` ("produce a
      provenance-backed briefing on X regulation"), `narrative-shift` (Gazette + committee
      evidence comparison).
- [x] **Progress/streaming for heavy calls:** emit `notifications/progress` on long handlers;
      document a client-side pattern for chunked `linked_entities`/`track_bill` work.
- [x] **Discoverability:** rebuild `discover_tools` index programmatically from the live tool
      registry (drop the drift-prone static array).
- [ ] **Protocol hygiene:** keep `2025-03-26` handshake for compatibility; add a
      `QUILL_PROTOCOL_VERSION` env to opt into 2026-07-28 semantics (stateless mode, `Mcp-Method`
      headers, `subscriptions/listen`) once SSE clients migrate.

**Acceptance:** `mcp.maplespike.ca/sse` advertises `resources` + `prompts` capabilities; an MCP
client (Claude Desktop / a 10-line TS client) can `resources/read quill://entities/{id}` and
`prompts/get influence-map` without hard-coding tool names.

### WS-4 — Ecosystem Enablement (Direction 4)

- [x] **`docs/building-on-quill.md`** — the guide for other MCP authors + local agent builders:
      schemas & versioning, entity ID scheme, claim bundle format + verification recipe,
      composition patterns (Quill + CanLII MCP + Elections Canada + local RAG), free-tier limits,
      rate-limit etiquette, dataset-specific source terms, and a "hello world" client snippet using the SDK.
- [x] **Quill Lite / read-replica mode:** document the zero-DB stdio mode as a first-class product
      ("Quill Lite"): no SQLite, no API server, `npx`-only; SQLite-backed mode as the upgrade
      path. Add a `QUILL_LITE=1` env that disables DB-dependent tools with graceful errors.
- [ ] **Reusable ingestion patterns:** publish the CKAN/Socrata/ArcGIS/XML fetcher + parser
      patterns as a documented SDK surface (`packages/sdk/src/ingestion.ts` exports exist) so the
      Canadian open-data community stops re-inventing fetchers.
- [ ] **White-label / multi-tenant path:** document a per-tenant branded instance recipe
      (env-based naming; `charts/quill/values.yaml` overrides); keep it a documented pattern, not
      a product launch, until two paying tenants exist.
- [ ] **SDK examples:** add `packages/sdk/examples/verify-claim.ts` and
      `examples/crossref-agent.ts` (federated query demo).

**Acceptance:** an external developer follows `docs/building-on-quill.md` end-to-end without
asking maintainers; Quill Lite runs with zero config and no DB.

### WS-5 — Agent Skills & Runtime Integrations (Direction 3/4)

- [x] **Publish 2 skills** under `.agents/skills/` (SKILL.md standard, already used in-repo):
      - `quill-influence-mapping` — lobbyist → committees → GIC → contracts → media trail using
        `resolve_entity` / `find_connections` / `get_politician_influence`.
      - `quill-provenance-briefing` — regulation briefing with claim bundles + hash verification
        via `fact_check` / `verify_claim`.
- [x] **Hermes profile** (`docs/integrations/hermes.md`): a packaged profile example
      (SOUL.md + config.yaml + MCP connection to `mcp.maplespike.ca/sse` or local `npx`) that
      any Hermes user can import.
- [x] **OpenClaw / local runtime note:** document MCP config snippets (stdio + SSE) and skill
      discovery paths (`~/.agents/skills/`, `external_dirs`).
- [ ] **Frostbite Gazette / Mosaic integration notes:** document the journalism-mode hooks
      (annotations API `packages/api-server/src/routes/annotations.ts` + `get_annotations` tool)
      as the integration surface for Gazette-style tools.

**Acceptance:** a Hermes user imports the profile and completes an influence-map task end-to-end.

### WS-6 — Monetization & Trust Economics

> **2026-08-09 note:** `getToolPrice` now normalizes underscore→kebab before default fallback —
> a deliberate deploy-time pricing change: claim-stack tools (track_bill $1.00, fact_check /
> find_connections $0.10, resolve_entity $0.001, …) now charge their intended tiers instead of
> the flat $0.01 default. Confirm expected billing delta on next paid-tool deploy.

- [ ] **x402 spec alignment:** move payment proof to `_meta["x402/payment"]` per the x402 MCP
      convention (keep `extractPaymentFromArgs` as fallback) in `packages/quill-mcp/src/x402-middleware.ts`.
      *(Deferred — not part of this execution round.)*
- [ ] **Resource/prompt pricing:** document free tier for `quill://entities/*` + prompts; keep
      paid tiers tool-based. Publish price map to the guide.
- [ ] **Settlement receipts:** include a `settlement` field in paid tool results
      (`_meta["x402/payment-response"]`) so paying agents get auditable receipts.

**Acceptance:** a standard x402 wallet can call a paid Quill tool without Quill-specific shims.

### WS-7 — Focus & Curation (Direction 6)

- [ ] Tool-index hygiene pass: flag `search_*` tools that are thin CKAN wrappers; promote the
      7 cross-reference/influence tools to "Featured" in `discover_tools`.
- [ ] Content coverage budget: route new-module effort to influence/parliament/regulatory
      verticals (per ROADMAP Phase 5.3 §Ph10 cross-reference engine already scoped at 24h).
- [ ] Refresh `docs/metrics.json` and portal copy after any tool/claim changes.

---

## 4. Milestones (Sequenced) & Validation Gates

| MS | Exit criteria | Validation gate |
|----|----------------|-----------------|
| **M0 — Stabilize (WS-0)** — *parallel track, not a hard gate* | Health 200s on public endpoints (when operator clears infra); **status surface + SLA documented + `quill.md` filled — done 2026-08-09** (`/v1/status`, SLA in product doc) | `curl` smoke where public; local `pnpm test` always |
| **M1 — Claim Stack live (WS-1)** | Real SHA-256 store; `get_citation`/`verify_claim`/`/v1/citation` verify **locally**; 7 tools emit bundles | **Local gate:** `pnpm build` + `pnpm test` (pipeline-core, quill-mcp, api-server suites) + MCP-client smoke against local SQLite + `echo \| sha256sum` cross-check. **Stretch:** same curls against public `api.maplespike.ca` once operator infra lands |
| **M2 — Composition hub (WS-2)** | `linked_entities` + graph-backed `search_cross_reference` + entity ID scheme + `quill://schemas` resources — **code done 2026-08-09**; acceptance still requires a populated entity graph (WS-1b ingestion + Phase 5.3 §Ph10) | Engine/quill-mcp tests + `resolve_entity` on ingested records (DB no longer 4 KB) |
| **M3 — Agent-native (WS-3, WS-5)** | resources/prompts live; 2 skills + Hermes profile published | MCP client `resources/read` + `prompts/get`; skill smoke in Hermes |
| **M4 — Ecosystem (WS-4, WS-6)** | Building-on-Quill guide complete; Quill Lite documented; x402 aligned | External-dev walkthrough; standard x402 wallet smoke |

Milestones are **not** optional-gated on each other except M1→M2 (claims feed cross-ref evidence).
**M0 is deliberately decoupled from M1:** several Phase 4 blockers (bare-metal `forge` node
recovery, unrecoverable GitHub PAT / sops rotation) require operator intervention no agent can
clear — M1's gate is a *locally verified* claim stack, with public-endpoint verification as
stretch, so the crown jewel never stalls behind an infra ticket.

## 5. Validation Strategy (recurring)

- **Per milestone:** `pnpm build` (14 packages), `pnpm test` (910+ tests today), scoped suites for
  changed packages (`pnpm --filter quill-mcp test`, `pnpm --filter api-server test`,
  `pnpm --filter pipeline-core test`, `pnpm --filter engine test`).
- **Live checks:** `curl` against `api.maplespike.ca` / `mcp.maplespike.ca` health, citation, verify
  (stretch until operator infra lands).
- **MCP smoke:** a 20-line TypeScript MCP client exercising `resources/read`, `prompts/get`,
  `verify_claim` (script committed under `scripts/mcp-smoke.mts`).
- **Doc integrity:** run `scripts/test-doc-links.mts` *scoped*, not as the sole gate — it is part
  of `pnpm test` and includes network-dependent external-host checks.

## 6. KPIs / Success Signals

- **Verification take-rate:** # of `get_citation`/`verify_claim`/`/v1/citation` calls per month
  (proves external trust, not internal use).
- **Composition:** # of distinct non-Quill MCP clients / agents calling the hosted endpoint;
  # of `quill://entity`/`crossref` resource reads.
- **Ecosystem adoption:** downloads of `@maplespike/quill-mcp`, SDK installs, skill/profile
  imports, guide page views.
- **Reliability:** uptime + p95 latency on `/v1/health`, free-tier error rate.
- **Revenue (context):** paid-tool call volume + conversion after free quota — must grow while
  free tier stays generous.

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Verification promise broken in public (current state) | M1 before any ecosystem marketing; kill the agent-card claim until true |
| Entity DB sparse → cross-ref returns stubs | WS-1b ingestion wiring + M2 acceptance requires populated DB |
| 2026-07-28 spec migration churn | Keep `2025-03-26` handshake; feature-flag stateless mode |
| Hard-coded tool index drift | Rebuild `discover_tools` index from live registry (WS-3) |
| Scope creep vs. ROADMAP Phase 4/5 backlog | This plan is additive: WS-0 IS Phase 4; new work lands as Phase 7 rows |
| Skills/runtimes move fast (Hermes/OpenClaw) | Publish doc-first; skills are markdown, cheap to update |

## 8. Sequencing Rationale (Why This Order)

1. **M0 runs in parallel, never in the critical path** — a verification endpoint that 404s
   behind a flaky tunnel is worse than none, so M1 gates on a *locally verified* claim stack;
   public hardening (WS-0) proceeds on the operator track and is folded in as stretch criteria.
2. **M1 second** — the entire positioning ("trusted, verifiable substrate") collapses if the
   first skeptic's `sha256sum` check fails. Claim bundles + the citation store are **~10-15
   focused file changes** (new `pipeline-core/src/claims/`, `packages/database` schema,
   `get-citation.ts`, `citation.ts` route, `withClaims` helper + 7 tool files, `verify-claim.ts`,
   `/v1/verify` route, `agent-card.json`) that reuse machinery already present (`hashing.ts`,
   `attestation/index.ts`) — a small surface for the entire moat.
3. **M2 third** — cross-reference output only earns trust when each link carries a claim hash
   from M1.
4. **M3/M4** — resources, prompts, skills, and docs are the distribution layer; they multiply
   the value of M1+M2 with near-zero marginal infra cost.

---

## 9. Appendix — External Research Notes

### MCP spec (as of 2026)
- Latest spec **2026-07-28**: stateless core, resources + prompts with `CacheableResult`
  (`ttlMs`/`cacheScope`), resource templates, `subscriptions/listen`, Multi Round-Trip Requests
  (MRTR), sampling deprecated. TS SDK (`@modelcontextprotocol/sdk`) supports all primitives.
- Quill currently implements the `2025-03-26` handshake from scratch — fine for today's clients
  (Claude Desktop, Cursor), but plan the 2026-07-28 opt-in.
- **No native content-addressing in MCP** — Quill's SHA-256 claim bundles are a differentiator,
  not a spec feature. Ship them as first-class resources + a verification tool.

### x402 (2026)
- Standard flow: unpaid call → tool result `isError: true` + `PaymentRequired` payload → client
  signs with wallet → retry with proof in `_meta["x402/payment"]` → server settles, returns
  receipt in `_meta["x402/payment-response"]`. Quill's args-based extraction is close; align to
  `_meta` for wallet compatibility (WS-6).

### Agent skills
- SKILL.md convention (frontmatter: name/description/version/platforms/metadata.hermes),
  `references/`, `scripts/`, `templates/` dirs; discovery via `~/.hermes/skills/`,
  `~/.agents/skills/` + `external_dirs`. Hermes profiles = distributable git repos
  (SOUL.md + config.yaml + MCP connections). Repo already uses `.agents/skills/`.

### Canadian MCP ecosystem (gap)
- Existing servers (CKAN wrappers, CanLII-only, municipal portals) provide *access*; none provide
  per-claim verification, cross-registry entity resolution, or provenance scoring. That gap is
  Quill's moat — and it only exists if M1 lands.
