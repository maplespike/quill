# MapleSpike Data Source Expansion — Priority Modules

Build new ingestion modules following the exact pattern of existing modules (committees/, corporate/, influence/).

Each module needs 5 files:
- types.ts — interfaces for the data
- constants.ts — URLs, known entities, config
- fetcher.ts — HTTP/CSV/RSS fetch functions
- parser.ts — parse raw data into typed records
- index.ts — orchestration: ingest function, barrel exports

Plus:
- Schema addition in packages/pipeline-core/schema/d1.sql
- Barrel exports in packages/pipeline-core/src/ingestion/index.ts
- Module directory under packages/pipeline-core/src/ingestion/

Tech: TypeScript, undici for HTTP, fast-xml-parser for XML, SHA-256 hashing from verification/hashing.ts
