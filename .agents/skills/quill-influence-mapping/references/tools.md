# Quill MCP tools used by influence-mapping

| Tool | Purpose | Key args |
|------|---------|----------|
| `resolve_entity` | Canonical identity + all appearances | `name`, `type`, `threshold` |
| `get_entity_profile` | MP + lobbying + GIC cross-reference | `name` |
| `find_connections` | Relationship graph (employs, lobbies, directs, owns) | `name`, `maxConnections` |
| `search_committees` | Committee evidence + witnesses | `query` |
| `search_debates` | House of Commons debates | `query` |
| `search_votes` | Voting records | `query` |
| `search_financial_regulation` | OSFI/CDIC/FCAC/securities data | `query` |
| `search_proactive_disclosure` | Federal contracts over $10K | `query` |
| `track_bill` | Bill lifecycle end-to-end | `query` |
| `get_citation` / `verify_claim` | Verify a claim hash | `hash` / `sha256`+`data` |

Every response from the cross-reference tools (`resolve_entity`,
`find_connections`, `get_entity_profile`, `track_bill`, `signal_check`,
`fact_check`, `ai_ask`) carries a `claims` array — use those `sha256` hashes in
the output.
