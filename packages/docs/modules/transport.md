---
last-reviewed: 2026-05-25
status: active
---

# Transport & Infrastructure Module

The transport-infrastructure module ingests data from the Transportation Safety Board (TSB), Transport Canada, the Canadian Transportation Agency (CTA), the Canada Infrastructure Bank (CIB), and Infrastructure Canada. It powers the `query_gov_data` MCP tool.

## Module: transport-infrastructure

### Sources

| Source | Format | Description | Frequency |
|--------|--------|-------------|-----------|
| **TSB Occurrences** | CSV | Transportation Safety Board — air, rail, marine, pipeline occurrences | monthly |
| **Transport Canada Safety Recalls** | CSV | Vehicle recalls, compliance violations, enforcement actions | weekly |
| **CTA Rulings** | HTML | Canadian Transportation Agency decisions and rulings | weekly |
| **CIB Projects** | HTML | Canada Infrastructure Bank — investments, projects ($35B+ mandate) | quarterly |
| **Infrastructure Canada** | CSV | Federal infrastructure funding programs, project data | monthly |

### TSB Occurrence Data

The TSB tracks all transportation occurrences in Canada:

| Mode | Data |
|------|------|
| **Air** | Aircraft accidents, incidents by type, location, operator, severity |
| **Rail** | Train derailments, crossings accidents, dangerous goods releases |
| **Marine** | Shipping accidents, groundings, collisions, fires |
| **Pipeline** | Pipeline ruptures, leaks, failures, dangerous commodity releases |

Each occurrence includes: date, location, operator, occurrence type, consequences (injuries, fatalities, damage), investigation classification, and safety recommendations.

### Transport Canada Safety Data

- Vehicle recalls by make, model, year, component
- Compliance and enforcement actions
- Motor carrier safety ratings
- Dangerous goods incident reports

### Canada Infrastructure Bank

The CIB has a $35B+ mandate to invest in Canadian infrastructure:

| Sector | Types |
|--------|-------|
| **Green Infrastructure** | Renewable energy, energy storage, smart grids |
| **Transport** | Transit, rail, highways, bridges |
| **Water/Wastewater** | Treatment plants, distribution systems |
| **Trade/Transport** | Ports, airports, logistics hubs |

Data includes project name, location, investment amount, sector, status, and expected outcomes.

## Module Structure

```
packages/pipeline-core/src/ingestion/transport-infrastructure/
  constants.ts  — TSB URLs, TC API configs, CIB URL templates
  types.ts      — TransportRecord, TsbOccurrence, TcRecall, CIBProject
  fetcher.ts    — CSV fetchers + HTML scrapers
  parser.ts     — CSV parsing + normalization
  index.ts      — ingestAllTransport(), searchTransport()
```

## Key Functions

| Function | Description |
|----------|-------------|
| `ingestTsbOccurrences()` | Fetch and parse TSB occurrence CSVs |
| `ingestTcSafety()` | Fetch Transport Canada recall data |
| `ingestCtaRulings()` | Scrape CTA decision registry |
| `ingestAllTransport()` | Run all transport ingestion |

## Use Cases

- **Transportation safety**: Track plane crashes, train derailments, and pipeline incidents
- **Infrastructure monitoring**: Follow CIB investments and project status
- **Vehicle safety**: Monitor TC recalls by make/model
- **Regulatory oversight**: Review CTA rulings on passenger rights, accessibility
- **Government spending**: Track federal infrastructure funding to ridings

## Example Queries for AI Agents

- *"Find TSB rail derailments involving dangerous goods in 2024"*
- *"What are the latest Transport Canada vehicle recalls?"*
- *"Show me Canada Infrastructure Bank projects in Ontario"*
- *"Search for CTA rulings on airline passenger compensation"*
- *"Find TSB air accident investigation reports from 2024"*
- *"What federal infrastructure projects are funded in British Columbia?"*
