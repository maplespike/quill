
---
last-reviewed: 2026-05-19
last-reviewed: 2026-05-19
status: active

||||||| parent of 940cc08 (feat: Add last-reviewed metadata to 50 documentation files #387)
 940cc08 (feat: Add last-reviewed metadata to 50 documentation files #387)
# Health Data Modules

MapleSpike ingests health data from multiple Canadian federal health agencies. Two primary modules handle health data: `health-canada` and `health-data`.

## Module: health-canada

Ingests data from Health Canada — drug approvals, medical device licenses, natural product licenses, and recalls.

### Sources

| Source | Format | Frequency |
|--------|--------|-----------|
| Health Canada Drug Product Database | CSV | weekly |
| Health Canada Medical Devices Active License Listing (MDALL) | CSV | weekly |
| Health Canada Licensed Natural Health Products | CSV | weekly |
| Health Canada Recalls and Safety Alerts | RSS | continuous |

### Data Types

- **Drug Product Database**: All approved drugs with DIN, active ingredients, manufacturer, therapeutic class
- **MDALL**: Medical device licenses with class, manufacturer, intent
- **Natural Health Products**: Licensed NHPs with NPN, ingredients, uses
- **Recalls & Alerts**: Recalls by severity (Type I, II, III), product type, reason

### Functions

| Function | Description |
|----------|-------------|
| `ingestHealthCanada()` | Run all Health Canada ingestion |
| `searchHealthCanadaRecords(query)` | Search across all Health Canada data |
| `getHealthCanadaRecallsBySeverity(severity)` | Filter recalls by severity level |

## Module: health-data

Ingests from broader health data sources — CIHI, CADTH, CFIA, PMPRB, and PHAC.

### Sources

| Source | Format | Description | Frequency |
|--------|--------|-------------|-----------|
| **CIHI** | XLSX | Canadian Institute for Health Information — hospital wait times, ED visits, health spending, surgical volumes | monthly |
| **CADTH** | HTML | Canadian Agency for Drugs and Technologies in Health — drug approval recommendations, cost-effectiveness reports | weekly |
| **CFIA** | RSS | Canadian Food Inspection Agency — food recalls, import refusals, inspection results | continuous |
| **PMPRB** | HTML/CSV | Patented Medicine Prices Review Board — drug pricing reviews, excessive price findings | monthly |
| **PHAC** | CSV | Public Health Agency of Canada — disease surveillance, pandemic data, opioid deaths | monthly |

### Data Types

| Data | Description |
|------|-------------|
| CIHI Wait Times | Emergency department wait times, surgical wait times by procedure/province |
| CIHI Health Spending | Total health expenditure by category, province, source of funding |
| CIHI NACRS | National Ambulatory Care Reporting System — ED visit statistics |
| CADTH Reports | Drug reimbursement recommendations, Health Technology Assessments |
| CFIA Recalls | Food recalls by classification (I/II/III), product, company, reason |
| PMPRB Pricing | Patented drug price reviews, excessive price findings |
| PHAC Surveillance | Opioid-related deaths and hospitalizations, infectious disease outbreaks |
| PMPRB Reports | Annual reports on patented drug prices |

### Functions

| Function | Description |
|----------|-------------|
| `ingestHealthData()` | Run all health data ingestion |
| `searchHealthDataRecords(query)` | Search across all health data sources |

## Use Cases

- **Drug safety**: Track drug recalls, safety alerts, adverse reactions
- **Health policy**: Access CIHI wait times data for policy research
- **Food safety**: Monitor CFIA food recalls by product category
- **Drug pricing**: Review PMPRB findings on excessive drug pricing
- **Public health**: Access PHAC surveillance data on opioids, infectious diseases
- **Medical devices**: Search approved/licensed medical devices and recalls

## Example Queries for AI Agents

- *"Find CFIA food recalls classified as Type I in 2024"*
- *"What are the average emergency department wait times in Ontario?"*
- *"Search for PMPRB decisions on excessive drug pricing"*
- *"Show me opioid-related deaths by province from PHAC data"*
- *"What CADTH drug reimbursement recommendations were issued recently?"*

## MCP Tool Mapping

Health data is accessible via `query_gov_data` with jurisdiction and category filters:

```json
{
  "name": "query_gov_data",
  "arguments": {
    "query": "drug recalls",
    "category": "health",
    "limit": 10
  }
}
```

Direct semantic search is also available via `ai_search_semantic`.
