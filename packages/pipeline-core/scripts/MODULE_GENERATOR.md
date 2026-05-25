# Module Generator

Scaffolds a new ingestion module with all 5 standard files — `constants.ts`, `types.ts`, `fetcher.ts`, `parser.ts`, `index.ts` — matching MapleSpike's established patterns.

## Usage

```bash
node packages/pipeline-core/scripts/generate-module.mjs <module-name> [options]
```

### Interactive mode (recommended)

```bash
node packages/pipeline-core/scripts/generate-module.mjs my-new-module
```

Prompts for category, description, source details interactively.

### Non-interactive (all flags)

```bash
node packages/pipeline-core/scripts/generate-module.mjs my-module \
  --category government \
  --description "My data module" \
  --source-name "Source Name" \
  --source-url "https://example.com" \
  --source-format JSON \
  --frequency monthly
```

### Hierarchical modules

```bash
node packages/pipeline-core/scripts/generate-module.mjs renewable \
  --parent nrcan \
  --category environment \
  --description "Renewable energy capacity data"
```

Creates `src/ingestion/nrcan/renewable/` with all 5 files.

## Options

| Flag | Description |
|------|-------------|
| `--category` | Module category: `government`, `corporate`, `influence`, `legal`, `oversight`, `elections`, `provincial`, `science`, `social`, `health`, `defence`, `education`, `environment`, `infrastructure`, `culture`, `media`, `labour`, `indigenous`, `financial`, `rss` |
| `--description` | Module description (in quotes) |
| `--source-name` | Data source display name |
| `--source-url` | Data source URL |
| `--source-format` | Data format: `CSV`, `JSON`, `RSS`, `HTML`, `XML`, `CKAN`, `REST API` |
| `--frequency` | Update frequency: `daily`, `weekly`, `monthly`, `quarterly`, `annual`, `continuous` |
| `--parent` | Parent directory for hierarchical modules (e.g., `nrcan`, `isc`, `ircc`) |
| `--table` | Database table name (default: `<module>_records`) |
| `--record` | Record type name (default: PascalCase) |
| `--no-status` | Skip registry/ingest.ts snippet output |
| `--help` | Show help |

## Output

Creates in `src/ingestion/[<parent>/]<module>/`:

```
constants.ts    # URLs, DDL, error class, defaults
types.ts        # Record interface, raw type, options/result types
fetcher.ts      # HTTP fetch from source API
parser.ts       # Normalize raw → typed record, content hashing
index.ts        # Orchestrator: init table, upsert, search, ingest
```

Also prints copy-paste snippets for:
- `src/ingestion/registry.ts` — register module in catalog
- `src/cli/ingest.ts` — add pipeline alias

## Post-generation steps

1. **Add registry entry** — paste the snippet into `src/ingestion/registry.ts` (alphabetically by category)
2. **Add pipeline mapping** — paste the snippet into `src/cli/ingest.ts` `PIPELINE_CONFIG`
3. **Customize templates** — fill in actual fetch URL patterns, field mappings, and business logic
4. **Add tests** — create `__tests__/<module>.test.ts`
5. **Build** — `pnpm --filter @maplespike/pipeline-core build`

### If adding MCP tools

Create `packages/mcp-server/src/tools/search-<module>.ts`:

```typescript
import { searchMyModuleRecords } from '@maplespike/pipeline-core';
// Register as MCP tool with search_<module> name
```
