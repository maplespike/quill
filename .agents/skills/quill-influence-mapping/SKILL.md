---
last-reviewed: 2026-11-09
name: quill-influence-mapping
description: Map a lobbyist, politician, or organization influence trail across Canadian federal data (lobbying registry, parliamentary committees, GIC appointments, corporate records, procurement) using Quill MCP tools, and produce a dated timeline with verifiable claim hashes.
version: 1.0.0
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [canada, influence, lobbying, parliament, mcp, quill]
    category: research
    requires_toolsets: [mcp]
---

# Quill Influence Mapping

Maps the influence network of a Canadian person or organization with the Quill
MCP server. Use local stdio at `packages/quill-mcp/dist/cli.js` (build first;
`@maplespike/quill-mcp` is not on npm) or the hosted endpoint
`https://mcp.maplespike.ca/sse`.

Attach a `sha256` only when the tool response includes a `claims` array.
Search tools in step 4 do not. Do not invent a hash for those rows.

## When to use

- "Map this lobbyist's influence trail"
- "Who lobbied on this bill and who in committee has ties to them?"
- "What GIC appointments, contracts, or corporate roles is this person connected to?"

## Workflow

1. **Resolve identity** — call `resolve_entity` with `name`. Optional `type`
   is `person`, `organization`, or `auto` (default `auto`). Optional
   `threshold` is 0.5–1.0 (default 0.7). Record `canonicalName`,
   `confidence`, `aliases`, and each appearance's `module`, `role`, `date`,
   and `sourceUrl`. If `confidence` is below 0.6, ask the user to
   disambiguate before you continue. An empty result means the local entity
   graph has no linked row. It does not prove the person is absent from a
   federal registry.
2. **Read the entity graph** — call `linked_entities` with the same name
   (`type` and `threshold` match `resolve_entity`). It returns per-registry
   buckets (lobbying, GIC, committees, corporate, and others) and a
   `claims` array. Then call `find_connections`. Pass `maxConnections` from
   1 to 50 (default 20). The handler ignores `type`. Each connection has
   `relationship`, `weight`, `source`, `target`, and `discoveredBy`.
   The graph writer (`linkTypeFor` in
   `packages/pipeline-core/src/entity/graph-builder.ts`) stores
   `affiliation`, `employs`, `co-mentioned`, `collaborates`, `based-in`,
   `location-of`, `located-in`, `headquartered`, or `co-occurs-with`.
   Report the `relationship` value on the response. Do not rename it to
   `lobbies`, `directs`, or `owns`.
3. **Live MP probe** — `get_entity_profile` takes only `name`. It returns
   `mpFound` / `mpDetails` when the name appears in the first five Open
   Parliament politician objects, plus `lobbyingRecords` and
   `gicAppointments`. Those two fields are CKAN package-search totals, not
   lobbying communications or appointment rows. The response includes
   `claims`. Use `search_gic` for appointment search and `search_corporate`
   for a lobbying keyword search. Do not treat step 3 counts as records.
4. **Keyword searches (no `claims` array)** — cite the tool name and any URL
   on the result. Do not attach a `sha256`.
   - `search_gic` — Infobase GC search (`query`, optional `department`,
     `limit` default 10, max 50).
   - `search_corporate` — open.canada.ca CKAN search of `query` plus the
     word `lobbying`. `dataset` is echoed and not applied. This is not a
     corporations-registry extract and not a contract list.
   - `search_corporate_registry` — CKAN search of `query` plus
     `corporate registry`. Same limit: not a registry extract.
   - `search_committees` — CKAN search of `query` plus `committees`.
     Required `query`. Optional `committee` filters the page. `chamber` is
     echoed and not applied. Results are discovery-only: content bodies are
     stripped. This is not a witness-testimony search.
   - `search_debates` and `search_votes` — the first Open Parliament page
     (`/debates/` or `/votes/`, `limit` default 10, max 50), then a
     client-side text filter. A miss on that page is not a corpus miss.
     Debate rows are dates, numbers, and frequent words, not the debate text.
   - `search_proactive_disclosure` — CKAN package search of the raw `query`
     (`limit` default 20). It does not filter to contracts over $10K.
   - `search_financial_regulation` — CKAN search of `query` plus
     `financial regulation banking` (`query` max 500 characters, `limit`
     default 20). It does not call OSFI, CDIC, or FCAC APIs.
5. **Bill thread** — when a bill number or title is in play, call
   `track_bill` with `query`. It reads the first Open Parliament page of
   bills, debates, and votes, filters that page, and returns `claims`. It
   does not assemble a LEGISinfo lifecycle or a regulatory-impact analysis.
   `search_bills` is the same bills page without claims.
6. **Synthesize a timeline** — chronological events. For graph and profile
   tools, copy `sha256`, `sourceName`, and `sourceUrl` from `claims`. For
   step 4, name the tool and quote URL fields that are actually present.
   Say when a search only covered the first page.
7. **Offer verification** — `get_citation` takes `hash` (`sha256:` prefix or
   64 hex characters). `verify_claim` takes `sha256` and optional `data`.
   A claim hash is the SHA-256 of `canonicalJson(value)` (object keys sorted
   at every depth) in `packages/pipeline-core/src/claims/index.ts`. Reproduce
   it with `echo -n '<canonical json>' | sha256sum`. Do not hash the claim
   sentence. The public `claims` array omits `value`. You cannot recompute
   the digest from the claim text alone.

## Output format

```
## Influence Trail: <canonicalName>
### Identity
- aliases, confidence, graph coverage (linked row vs empty graph)
### Timeline
| Date | Event | Source | sha256 or "no claim hash" |
### Relationships
- <target> (<relationship>, weight) — discoveredBy <module>
### Verification
- Hashes come from claims[].sha256 (64 hex characters)
- Check with get_citation or verify_claim
```

## References

- See `references/tools.md` for the tool arguments and which responses carry `claims`.
