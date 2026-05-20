
---
last-reviewed: 2026-05-19
last-reviewed: 2026-05-19
status: active

||||||| parent of 940cc08 (feat: Add last-reviewed metadata to 50 documentation files #387)
 940cc08 (feat: Add last-reviewed metadata to 50 documentation files #387)
# Immigration & Borders Module

The immigration module ingests data from IRCC (Immigration, Refugees and Citizenship Canada), IRB (Immigration and Refugee Board), and CBSA (Canada Border Services Agency). It powers the `search_immigration` MCP tool.

## Source Data

### IRCC — Permanent Residents

- **CKAN Dataset**: `f7e5498e-0ad8-4417-85c9-9b8aff9b9eda`
- **Frequency**: Monthly
- **Data**: PR admissions by category, country, province, CMA, NOC code (20+ CSV variants)

### IRCC — Temporary Residents / Study Permits

- **CKAN Dataset**: `90115b00-f9b8-49e8-afa3-b4cff8facaee`
- **Frequency**: Monthly
- **Data**: Study permits by citizenship, institution, province, gender (15+ CSV variants)

### IRCC — TFWP / LMIA

- **CKAN Dataset**: `e8745429-21e7-4a73-b3f5-90a779b78d1e`
- **Frequency**: Quarterly
- **Data**: TFWP usage by employer, occupation, province, skill level

### IRB — Refugee Protection Division Decisions

- **CKAN Dataset**: `6e47f705-71ed-41f0-8fd5-d1a8508a3b63`
- **Frequency**: Quarterly
- **Data**: 100+ quarterly CSV files with claim grant/refusal rates by country, board member

### CBSA — Border Enforcement

- **Source**: CBSA proactive disclosure HTML tables
- **Data**: Detentions, removals, seizures, port of entry statistics

## Module Structure

```
packages/pipeline-core/src/ingestion/immigration/
  constants.ts  — CKAN dataset IDs, CBSA URLs, IRCC portal configs
  types.ts      — ImmigrationRecord, PRAdmission, RPDDecision, CBSARecord
  fetcher.ts    — CKAN/CSV fetchers + CBSA HTML scraper
  parser.ts     — CSV parsing + normalization
  db.ts         — SQLite persistence with upsert
  index.ts      — ingestAllImmigration(), searchImmigration()
```

## Key Functions

| Function | Description |
|----------|-------------|
| `ingestPermanentResidents()` | Fetch and parse IRCC PR admission CSVs |
| `ingestRpdDecisions()` | Fetch IRB refugee decision quarterly data |
| `ingestCbsaEnforcement()` | Scrape CBSA enforcement statistics |
| `ingestAllImmigration()` | Run all immigration ingestions |

## MCP Tool: search_immigration

```json
{
  "name": "search_immigration",
  "arguments": {
    "query": "India 2024",
    "source": "ircc",
    "year": 2024,
    "limit": 10
  }
}
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | (required) | Country, province, category, or year |
| `source` | string | `all` | `ircc`, `irb`, `cbsa`, `all` |
| `year` | number | — | Filter by year |
| `limit` | number | `10` | Max results (1-50) |

## Example Data Points

- Monthly PR admissions by province and immigration category
- Express Entry draws — CRS cutoffs, ITAs issued
- Refugee claim grant/refusal rates by country of origin
- Study permit approvals by institution and country
- CBSA removal statistics by type (voluntary, enforced)
- Asylum claimant locations and processing times
- Citizenship grants and ceremony statistics

## Example Queries for AI Agents

- *"Show me 2024 permanent resident admissions by province"*
- *"What are the refugee claim approval rates for Syria?"*
- *"How many study permits were issued to Indian students in 2024?"*
- *"Search for CBSA enforcement actions in 2024"*
- *"What are the latest Express Entry CRS score cutoffs?"*
