# MapleSpike — Agent Memory (May 25 2026)

## Architecture
- **Standalone MCP server**: `npx @maplespike/mcp-server` — zero config, no DB, no API server
- **94 MCP tools**: cross-source, semantic, search, utility, signal, explorer
- **In-memory cache**: 5-min TTL (`tools/optimization/cache.ts`)
- **Upstream fetcher**: `tools/upstream-fetcher.ts` — all upstream functions
- **StatCan helper**: `tools/statcan-helper.ts` — ZIP/CSV table fetcher
- **CKAN (primary)**: `ouvert.canada.ca` (NOT `open.canada.ca`)

## Key Files
- `tools/upstream-fetcher.ts` — 17+ upstream fetch functions
- `tools/smart-search.ts` — intent-aware semantic search (17 sources, synonyms, time-series, citations, trends)
- `tools/signal-store.ts` — in-memory change detection
- `tools/explore-catalog.ts` — data catalog (25 categories)
- `tools/index.ts` — tool registry
- `tools/api-client.ts` — optional API server client (graceful fallback)
- `tools/statcan-helper.ts` — shared StatCan table fetcher
- `tools/optimization/zip-util.ts` — ZIP extraction for StatCan CSVs

## Tool Pattern
```typescript
export const definition: ToolDefinition = { name, description, inputSchema }
export const handler: ToolHandler = async (args) => { /* fetch + return */ }
```

## Cross-Source Tools
- `smart_search` — intent detection + synonym expansion + time-series + citations + trends
- `track_bill` — bills + debates + votes
- `get_politician_influence` — MP + lobbying + GIC
- `compare_regions` — StatCan + spending
- `get_entity_profile` — person cross-reference

## Testing
- `src/__tests__/upstream.test.ts` — 17 upstream reachability tests
- Run: `pnpm test` or `npx tsx --test src/__tests__/upstream.test.ts`

## Upstream Status
- ✅ CKAN (ouvert.canada.ca), Gazette RSS, StatCan WDS, Open Parliament API
- ⚠️ CanLII API (401, CKAN fallback)

## Provincial Gaps
- QC, YT: 0 dedicated modules
- 186 portals exist, 91 modules

## Issues Closed This Session (May 25)
- #408, #443, #488, #489, #252, #311-#314
- #567 (Open Parliament API)
- #568, #569, #571 (Research)
- #570 (Infrastructure tools)
- #549 (Updated quality gaps)
- #122 (Sprint-to-Live)

## Issues Created
- #548 (Parser mandate)
- #557 (International Sources)
- #558 (Innovation Roadmap)
- #562-#565 (Research sub-issues)
- #566 (Provincial CKAN URLs)
