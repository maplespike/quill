---
last-reviewed: 2026-10-14
status: active
---

# Building on Quill

> **Quill is the Canadian data substrate** — the layer other MCPs, agents,
> journalists, and researchers can trust without re-implementing ingestion,
> provenance, or cross-referencing. This guide is for **MCP authors and local
> agent builders** who want to compose with Quill rather than re-fetch CKAN.

Everything here is grounded in the live server (local stdio from a checkout,
or `https://mcp.maplespike.ca/sse`). `@maplespike/quill-mcp` is not published
on npm. The companion strategy lives in
[`docs/ECOSYSTEM-EXECUTION-PLAN.md`](./ECOSYSTEM-EXECUTION-PLAN.md).

---

## 1. Quick start

```bash
# Local stdio. Build the package first. Self-hosted calls are not counted
# against the hosted free quota.
pnpm --filter @maplespike/quill-mcp... build
node packages/quill-mcp/dist/cli.js

# In any MCP client:
{
  "mcpServers": {
    "quill": {
      "command": "node",
      "args": ["/absolute/path/to/quill/packages/quill-mcp/dist/cli.js"]
    }
  }
}
```

**Free tier:** 1,000 calls/month per identity on the hosted endpoint; the
discovery/health/verification tools (`discover_tools`, `explore_catalog`,
`system_health`, `verify_claim`, `cache_status`) are always free.

## 2. The claim stack (why you can trust Quill)

Every high-signal response (`fact_check`, `ai_ask`, `get_entity_profile`,
`resolve_entity`, `find_connections`, `track_bill`, `signal_check`) carries a
`claims` array:

```json
{
  "tool": "resolve_entity",
  "canonicalName": "Jane Doe",
  "claims": [
    {
      "claim": "Appearance in lobbying: Consultant",
      "sha256": "sha256:<64 hex>",
      "sourceName": "lobbying",
      "sourceUrl": "https://lobbycanada.gc.ca/...",
      "retrievedAt": "2026-08-09T12:00:00.000Z",
      "license": "The publisher license was not declared in the metadata returned to Quill. Consult the publisher's terms.",
      "license_basis": "no-publisher-declaration",
      "transformations": ["entity-resolution"]
    }
  ]
}
```

**Verify any hash three ways:**

1. MCP: `verify_claim` with `sha256` + the original `data` (local recompute —
   strongest, doesn't trust Quill storage).
2. MCP: `get_citation` with the hash (store lookup).
3. HTTP: `GET https://api.maplespike.ca/v1/claims/verify/<hash>` or
   `POST /v1/claims/verify` with `{ "data": ... }` → returns `recomputed_sha256`.

Both `/v1/claims/verify` routes are **public — no API key required** (same
status as `/v1/citation/`): they are the trust primitive anyone downstream can
call from a script, notebook, or newsroom pipeline. The portal ships a
journalist-facing UI at **https://quill.maplespike.ca/verify** — paste a hash,
and it renders the source name, retrieval time, license, update frequency, the
claim statement, and a copyable shell command that reproduces the hash.

**Don't have a hash yet? Discover what Quill has attested first.**
`GET /v1/claims/latest` (public, same trust-primitive status) returns the most
recently registered claim bundles — `sha256`, human-readable `claim`,
`source_name`, `source_url`, `retrieved_at`, `license` — so journalists and
other MCP authors can find something to verify instead of only pasting hashes
they were handed. The MCP server exposes the same surface as the
`quill://claims/latest` resource, and the portal renders it at
**https://quill.maplespike.ca/claims**, with each row deep-linking into the
verifier (`/verify?hash=sha256:...`).

**Privacy note:** the index intentionally exposes claim *statements* and
source attribution (the same fields the public verify surface already
returns), but never the raw `value`/payload behind a hash. The payload stays
behind the SHA-256 unless someone reproduces it from the original source —
that is the point of the trust model. `sha256` values in the index are
returned with the `sha256:` prefix; the verify endpoints accept both the
prefixed and bare forms.

Or fully offline:

```bash
echo -n '<canonical json>' | sha256sum
```

Canonical JSON = deeply sorted object keys (`canonicalJson` in
`@maplespike/pipeline-core`), so hashes are reproducible across languages.

## 3. Entity IDs & the composition hub

Quill resolves entities across registries (lobbying, committees, GIC,
corporate, elections, CanLII, procurement) to canonical IDs.

- **`resolve_entity`** — name → `{ id, canonicalName, aliases, confidence, appearances[] }`.
- **`linked_entities`** — cross-reference a name across every registry in one call
  (lobbying, GIC, committees, corporate, CanLII, elections, oversight, municipal,
  provincial) with per-registry evidence buckets + connections.
- **`find_connections`** — relationship network (employs, lobbies, directs, owns).
- **`get_entity_profile`** — MP + lobbying + GIC cross-reference in one call.

### 3.1 The `quill://entity/{id}` scheme

Every resolved entity has a **stable, addressable canonical URI**:

```text
quill://entity/{id}
```

where `{id}` is the raw `entities.id` value. The scheme is the composition
contract — any tool, resource, or API that names an entity exposes this URI so
clients can link registries against it without re-implementing resolution.
Helpers (`toEntityUri` / `fromEntityUri` / `isEntityUri`) live in
`packages/engine/src/entity/types.ts` and are mirrored in the shared resolver
(`packages/pipeline-core/src/entity/resolver-lib.ts`).

Two URI families, don't confuse them:

| Family | Example | Purpose |
|--------|---------|---------|
| **Canonical entity ID** (scheme) | `quill://entity/ent_123` | Stable identity — link your data against it, store it, cache it |
| **Resource template** (lookup) | `quill://entities/{name}` | Resolve a *name* to its profile on demand |

A raw id, a canonical URI, and a resource-template read all return the same
entity: `fromEntityUri` normalizes the URI back to the raw id, so
`quill://entity/ent_123` and `ent_123` are interchangeable everywhere.

**REST mirror (no MCP client needed):** the same composition surface is exposed
over HTTP for non-MCP clients — other APIs, local agent frameworks, and
journalism tools get identical results backed by the same shared resolver
(`packages/pipeline-core/src/entity/resolver-lib.ts`):

```http
GET /v1/entities/{id}          # entity profile + canonical quill://entity/{id} URI
GET /v1/entities/{id}/links    # linked_entities surface (per-registry + connections)
```

`{id}` accepts either a raw entity id **or** a full `quill://entity/{id}` URI —
the scheme round-trips through both surfaces. Tier gates mirror the MCP pricing:
profile is Pro+ (≈ `resolve_entity`, micro), links are Business+ (≈
`linked_entities`, premium $0.10). Neither is on the free discovery whitelist.

**Link against Quill entity IDs** from your own MCP server: resolve the name,
store `quill://entity/<id>` as your entity's canonical URI, and re-fetch the
subgraph via the resource surface (below) or `GET /v1/entities/{id}/links` when
you need updates. This is the "connective tissue" pattern — your server owns its
vertical, Quill owns cross-registry identity.

## 4. Agent-native surfaces (resources + prompts)

The server advertises **resources** and **prompts** (not just tools). Discover
via `resources/list` + `resources/templates/list` + `prompts/list` instead of
hard-coding tool names.

| Surface | URI / name | Returns |
|---------|------------|---------|
| Resource | `quill://tool-index` | Live list of every registered tool (~184) |
| Resource | `quill://schemas` | Module schema index — name, file, field count, required fields per module |
| Resource (template) | `quill://schemas/{module}` | Versioned field-level schema for one module (name, type, required, description per field) |
| Resource (template) | `quill://entities/{name}` | Resolved entity profile (name → canonical id + aliases + appearances) |
| Resource (template) | `quill://citations/{hash}` | Verifiable claim bundle (hash, source, retrievedAt, license) |
| Resource | `quill://claims/latest` | Recently registered claim bundles — discover what Quill has attested, then verify any hash |
| Resource (template) | `quill://crossref/{name}` | Entity connection subgraph (center + relationship edges) |
| Resource | `quill://jobs` | Long-running jobs: id, tool, state, timing |
| Resource (template) | `quill://jobs/{id}` | One job's state, progress and (when finished) result |
| Prompt | `influence-map` | Multi-step influence-trail workflow |
| Prompt | `provenance-brief` | Provenance-backed briefing workflow |
| Prompt | `narrative-shift` | Gazette + committee narrative analysis |

**Schemas are a first-class resource.** `quill://schemas` returns the versioned
data contract for every ingestion module — the fields other MCP authors should
link against — and `quill://schemas/{module}` returns one module's full
field-level schema (`name`, `type`, `required`, `description`). Read the schema
before composing so your server's expectations match Quill's output exactly
(no guessing field names).

Heavy calls accept `_meta.progressToken` and stream `notifications/progress`.

### 4.1 Heavy cross-references: jobs instead of timeouts

Synchronous calls are bounded by `QUILL_HANDLER_TIMEOUT_MS` (55s in the
hosted deployment) so the MCP gateway always gets an answer. Cross-references
that legitimately take longer should run as a **job**: the server returns a
handle immediately and the work continues in the background.

```jsonc
// 1. start — add _meta.quill.async; progressToken is optional but recommended
{
  "jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": {
    "name": "linked_entities",
    "arguments": { "name": "Acme Consulting Inc." },
    "_meta": { "progressToken": "crossref-1", "quill": { "async": true } }
  }
}
// -> { "jobId": "...", "uri": "quill://jobs/...", "state": "running",
//      "pollWith": { "method": "resources/read", "params": { "uri": "quill://jobs/..." } },
//      "cancelWith": { "method": "jobs/cancel", "params": { "id": "..." } } }
```

```jsonc
// 2. poll — cheap while running; carries the payload once finished
{ "jsonrpc": "2.0", "id": 2, "method": "resources/read",
  "params": { "uri": "quill://jobs/<id>" } }
// -> { "state": "running" | "succeeded" | "failed" | "cancelled",
//      "progressCount": 2, "latestProgress": { "step": "sanitizing", "fraction": 0.95 },
//      "result": { "content": [ ... ] } | null, "error": null }
```

```jsonc
// 3. cancel (optional)
{ "jsonrpc": "2.0", "id": 3, "method": "jobs/cancel", "params": { "id": "<id>" } }
```

- `quill://jobs` lists jobs; `quill://jobs/{id}` is the status surface.
- With a `progressToken` you also get `notifications/progress` frames carrying
  `jobId` and `jobState`, plus a final `progress: 1`.
- Jobs are **in-process**: bounded (oldest evicted past 50 jobs), kept ~30
  minutes after finishing, and dropped on restart. They exist so one call can
  outlive one request — they are not a durable queue. Persist anything you need
  to keep.
- The same sanitisation, quota accounting and x402 gating apply as for a
  synchronous call; only the delivery changes.

### 4.2 Protocol version (opt-in 2026-07-28)

The default handshake is `2025-03-26` and stays the default — nothing changes
for existing clients. Operators can opt in to `2026-07-28` semantics by setting
`QUILL_PROTOCOL_VERSION=2026-07-28`; clients opt in per connection by sending
`protocolVersion: "2026-07-28"` in `initialize` (or the `Mcp-Protocol-Version`
header on `POST /mcp`). **Both** sides must opt in.

Once negotiated:

| Feature | 2025-03-26 (default) | 2026-07-28 (opt-in) |
|---|---|---|
| `subscriptions/listen` | absent (`-32601`) | available — subscribe to resource URIs |
| `capabilities.subscriptions` | absent | `{ "listen": true }` |
| `resources` capability | `{ listChanged: false }` | `{ listChanged: true, subscribe: true, ttlMs: 30000 }` |
| resources in `resources/list` | no `ttlMs` | `ttlMs` per resource |
| `POST /mcp` statefulness | stateless request/response | stateless **and** requires an `Mcp-Method` header that matches the body method |

Subscribers get `notifications/resources/updated` when a job finishes, so a
2026-07-28 client can avoid polling entirely:

```jsonc
{ "jsonrpc": "2.0", "id": 4, "method": "subscriptions/listen",
  "params": { "uris": ["quill://jobs"] } }
// -> { "subscriptionId": "sub-1", "uris": ["quill://jobs"] }
```

`subscriptions/cancel { "subscriptionId": "sub-1" }` stops it. An unknown
`QUILL_PROTOCOL_VERSION` value is ignored rather than guessed, so a typo can
never silently migrate production traffic.

## 5. Composition patterns

### Worked example — trace + verify a lobbying influence trail

The pattern other MCP authors should copy: **resolve → cross-reference →
verify**, so every claim you relay is independently checkable. This is the
"lobbying registry + linked entities + claim verification" flow end to end.

**Step 1 — resolve the entity and get its canonical URI.**

```text
linked_entities { "name": "Acme Consulting Inc.", "type": "organization" }

→ {
    "entity": { "id": "ent_org_1", "uri": "quill://entity/ent_org_1", ... },
    "registries": [
      { "registry": "lobbying",    "count": 3, "modules": ["lobbying"], "firstDate": "2024-01-15", "lastDate": "2026-02-01" },
      { "registry": "committees",  "count": 1, "modules": ["committees"], ... },
      { "registry": "corporate",   "count": 1, "modules": ["corporate"], ... }
    ],
    "totalAppearances": 5,
    "connectionCount": 2,
    "claims": [
      { "claim": "Appearance in lobbying: Client", "sha256": "sha256:9f86d...", "sourceName": "lobbying", "sourceUrl": "https://lobbycanada.gc.ca/...", "license": "The publisher license was not declared in the metadata returned to Quill. Consult the publisher's terms.", "licenseBasis": "no-publisher-declaration", "transformations": ["entity-resolution", "registry-grouping"] }
      // one claim bundle per appearance — 5 appearances → 5 claims entries
    ]
  }
```

**Step 2 — store the canonical URI, not the name.** Save
`quill://entity/ent_org_1` as the entity's stable id in your own graph. Re-fetch
later via the resource template (`quill://entities/Acme%20Consulting%20Inc.` —
names are percent-encoded path segments) or the REST mirror
(`GET /v1/entities/ent_org_1` — same shape, no MCP client needed).

**Step 3 — verify every hash you relay.** Pick a claim from the response and
verify it three ways (any one is sufficient; local recompute is strongest):

```text
# 1. MCP — local recompute (doesn't trust Quill storage)
verify_claim { "sha256": "sha256:9f86d...", "data": { ...original appearance... } }
→ { "verified": true, "matches": true, "recomputedSha256": "sha256:9f86d..." }

# 2. MCP — store lookup
resources/read { "uri": "quill://citations/sha256:9f86d..." }
→ claim bundle { sha256, sourceName, sourceUrl, retrievedAt, license }

# 3. HTTP — independent of Quill uptime
GET https://api.maplespike.ca/v1/claims/verify/sha256:9f86d...
```

**Step 4 — link your vertical to the evidence.** Your server now owns its
vertical (say, campaign-finance filings) and Quill provides the connective
tissue: canonical `quill://entity/{id}` URIs for identity, per-registry evidence
buckets for context, and verifiable hashes for trust. Relay Quill's
`sha256` values (not just the human-readable claim) so downstream consumers can
re-verify independently of either server.

### Pattern A — Quill + CanLII MCP + Elections Canada

```text
1. resolve_entity "John Smith"           (Quill)  → canonicalId
2. search_canlii "John Smith"            (Quill)  → court appearances
3. search_elections "John Smith"         (Quill)  → third-party advertising
4. <your CanLII-only MCP> for full-text rulings using the resolved name
5. Re-verify any hash from Quill responses with verify_claim
```

### Pattern B — Quill + local RAG over your own documents

```text
1. Your RAG retrieves a doc mentioning "Acme Corp"
2. resolve_entity "Acme Corp"            (Quill)  → canonical identity
3. find_connections → committee + lobbying graph
4. Attach Quill claim hashes to your RAG citations for verifiability
```

### Pattern C — White-label / Quill Lite

- **Quill Lite**: the zero-config stdio mode **is** Quill Lite — no database
  file and no API server required. `resolve_entity`/`find_connections` return
  graceful stubs when the entity tables aren't populated, and the claim store
  falls back to in-memory — the server never crashes without a DB.
- **Read-replica**: run the SQLite-backed mode (`packages/database` +
  `maplespike.sqlite`) to persist the claim store + entity graph locally.

## 6. Schemas & versioning

- Module schemas: `quill://schemas` / `quill://schemas/{module}` (MCP
  resources), `qa_schema` (MCP tool), or `GET /v1/export` (REST). Read the
  schema resource before composing so your field names match.
- Registry of modules: `packages/pipeline-core/src/ingestion/registry.ts`
  (207 modules).
- SDK: `@maplespike/sdk` (TS) + `sdk-python` (PyPI) — typed clients with
  entity resolution built in. See `packages/sdk/examples/`.

## 7. Licensing & etiquette

- **Source data**: Terms vary by publisher and dataset. Quill does not grant reuse rights; consult the original publisher's terms for each use. Attribute the upstream source, not just Quill.
- **Rate limits**: 60 req/min on the hosted SSE endpoint; be polite — cache
  and reuse claim hashes instead of re-querying.
- **Identity**: stdio = self-hosted (uncounted); hosted = Bearer API key
  (1,000/mo then x402 per-call micropayments on paid tools).

## 8. Helping the ecosystem (what we publish)

- Reusable fetchers/parsers: `@maplespike/pipeline-core` ingestion modules —
  CKAN, Socrata, ArcGIS, XML patterns are all in there; don't reinvent them.
- This guide + `docs/ECOSYSTEM-EXECUTION-PLAN.md` + `docs/integrations/hermes.md`.
- Skills: `.agents/skills/quill-influence-mapping` and
  `.agents/skills/quill-provenance-briefing` (SKILL.md standard) — copy them
  into any agent runtime's skill directory.

## 9. Feedback loop

Found a gap (registry missing, schema wrong, hash not verifying)? Open an
issue at https://github.com/reverb256/quill or contact billing@maplespike.lan.
The free tier exists so the ecosystem can experiment without friction — abuse
it, and tell us what breaks.
