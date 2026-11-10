# Parliamentary content stays free

Owner decision, 9 November 2026: House of Commons and Senate committee, debate, Hansard, and vote content is free. Full text stays in storage. Public responses carry a source link and a non-commercial reuse line, and excerpts stay at 300 characters or fewer.

## Affected packages

- `pipeline-core` — shared public helper
- `quill-mcp` — tool price, quota meter, tool responses
- `api-server` — free-tier gate, usage meter, export responses, plan copy
- `portal` — pricing page
- CI — `scripts/test-parliamentary-free.mts`

## Contracts

MCP tool prices for the parliamentary set become `free` / `$0`. Those calls do not increment the hosted quota. `GET /v1/export/committees` and `GET /v1/export/parliamentary-voting` are free-tier routes and do not increment paid-plan usage. Other export modules stay gated. Storage schemas do not change.
