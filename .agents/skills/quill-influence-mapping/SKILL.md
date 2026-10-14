---
last-reviewed: 2026-09-22
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

Maps the influence network of a Canadian person or organization across federal
registries, using the Quill MCP server (local stdio at
`packages/quill-mcp/dist/cli.js`, or `https://mcp.maplespike.ca/sse`).
`@maplespike/quill-mcp` is not published on npm. Every claim the skill surfaces must carry the
SHA-256 hash from the tool response so the trail is independently verifiable.

## When to use

- "Map this lobbyist's influence trail"
- "Who lobbied on this bill and who in committee has ties to them?"
- "What GIC appointments, contracts, or corporate roles is this person connected to?"

## Workflow

1. **Resolve identity** — call `resolve_entity` with the name (type auto).
   Record `canonicalName`, `confidence`, `aliases`, and every appearance's
   `module` + `sourceUrl`. If confidence is low (<0.6), ask the user to
   disambiguate before continuing.
2. **Cross-reference registries** — call `get_entity_profile` with the
   canonical name to pull MP, lobbying, and GIC records. Then
   `find_connections` (maxConnections up to 30) to get the relationship graph
   (employs, lobbies, directs, owns) with weights.
3. **Search parliamentary activity** — `search_committees` and `search_debates`
   with the name + relevant subject terms; `search_votes` for voting records.
4. **Financial + regulatory threads** — `search_financial_regulation`,
   `search_proactive_disclosure`, and `track_bill` when a specific bill is in play.
5. **Synthesize a timeline** — chronological events, each annotated with the
   `sha256` claim hash and `sourceUrl` from the tool response. Prefer the claim
   hashes over the raw text when the user asks "how do I know this is real?"
6. **Offer verification** — tell the user they can run
   `get_citation` / `verify_claim` on any hash, or `echo -n '<data>' | sha256sum`
   locally.

## Output format

```
## Influence Trail: <canonicalName>
### Identity
- aliases, confidence
### Timeline
| Date | Event | Source | sha256 |
### Relationships
- <target> (<relationship>, weight) — discovered via <module>
### Verification
- Hashes are verifiable via get_citation / verify_claim
```

## References

- See `references/tools.md` for the exact tool schemas.
