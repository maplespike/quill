# Pipeline Core Specification

## Purpose
This spec describes the core data pipeline — ingestion, processing, and indexing of Canadian public data.

## Requirements

### Requirement: Data Ingestion
The pipeline SHALL ingest data from 198+ Canadian public data sources across federal, provincial, territorial, and municipal levels.

#### Scenario: Module architecture
- GIVEN a new data source needs to be added
- THEN it SHALL be implemented as a module under packages/pipeline-core/src/sources/
- AND the module SHALL follow the existing fetcher/parser pattern
- AND it SHALL register via the module registry

#### Scenario: Multi-level coverage
- GIVEN the Canadian data landscape
- THEN modules SHALL cover federal sources (Parliament, Gazette, CIHR, etc.)
- AND provincial sources (legislatures, health, procurement)
- AND territorial and municipal sources

### Requirement: MCP Tool Exposure
Pipeline modules SHALL expose their capabilities through MCP tools.

#### Scenario: Tool generation
- GIVEN a pipeline module exists
- THEN it SHALL be accessible as an MCP tool through packages/quill-mcp
- AND the tool count SHALL be reflected in docs/metrics.json

### Requirement: Vector Search
The pipeline SHALL support vector search via Qdrant.

#### Scenario: Qdrant integration
- GIVEN a pipeline module produces structured data
- THEN it MAY be indexed in Qdrant for semantic search
- AND the collection SHALL be `brain_wiki` (not `maplespike`)
- AND the search endpoint SHALL be at localhost:6333
- AND the RAG route SHALL be in packages/api-server/src/routes/ai.ts
