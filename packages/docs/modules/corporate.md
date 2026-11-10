---
last-reviewed: 2026-11-10
status: active
---

# Corporate & Lobbying Module

The corporate module ingests federal lobbying registry data, procurement contracts, corporate filings, and executive statements. It powers the `search_corporate` MCP tool and cross-references with influence tracking.

## Module: corporate

### Sources

| Source | Format | Description | Frequency |
|--------|--------|-------------|-----------|
| **LobbyCanada Registry** | CSV | Federal lobbying registrations, communication reports, subject areas | weekly |
| **CanadaBuys Procurement** | RSS | Government of Canada procurement notices and awarded contracts | weekly |
| **GlobeNewswire (exec statements)** | RSS | Executive statements, company press releases | daily |

### Data Types

| Data | Description |
|------|-------------|
| **Lobbying Registrations** | Lobbyist name, organization, subject matter, government department targeted |
| **Communication Reports** | Date, public office holder contacted, topic, communication type |
| **Procurement Contracts** | Awarded contracts with value, vendor, department, sole-source flag |
| **Executive Statements** | CEO/executive public statements on policy matters |

### Functions

| Function | Description |
|----------|-------------|
| `ingestLobbying()` | Fetch and parse federal lobbying registry |
| `ingestProcurement()` | Fetch and parse CanadaBuys procurement notices |
| `ingestExecutiveStatements()` | Fetch executive statements from RSS |
| `ingestAllCorporate()` | Run all corporate ingestion |
| `searchCorporate(query)` | Search across all corporate data |

## Module: corporate-filings (SEDAR+)

| Source | Format | Description | Frequency |
|--------|--------|-------------|-----------|
| **SEDAR+** | HTML | Canadian public company regulatory filings | daily |

Data includes prospectuses, annual reports, management discussion, material change reports.

## Module: sedi (retired)

SEDI terms of use prohibit robots, spiders, and other automatic access. Quill does not fetch SEDI. Stored insider rows stay in the database. This module is not scheduled and has no health check.

## Module: crown-corporations

| Crown Corp | Data |
|------------|------|
| CBC/Radio-Canada | Financials, audience data, mandate reports |
| Canada Post | Service standards, financial performance |
| CMHC | Housing market data, insurance activity |
| EDC | Export financing, transaction volumes |
| VIA Rail | Ridership, on-time performance, capital projects |
| BDC | Lending activity, portfolio performance |

## Module: cra-charity

- **Source**: CRA Charity T3010 data
- **Frequency**: Annual
- **Coverage**: Every registered Canadian charity
- **Data**: Revenue, expenses, compensation, political spending

Functions track political spending, top compensated charities, and cross-reference with influence actors.

## Module: bank-of-canada

| Source | Format | Description | Frequency |
|--------|--------|-------------|-----------|
| **Bank of Canada RSS** | RSS | Rate decisions, monetary policy, financial system review | weekly |
| **VALA speeches** | HTML | Executive speeches by BoC officials | weekly |

## MCP Tool: search_corporate

```json
{
  "name": "search_corporate",
  "arguments": {
    "query": "Google",
    "dataset": "lobbying",
    "limit": 10
  }
}
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | (required) | Company name, executive, or keyword |
| `dataset` | string | `all` | `lobbying`, `procurement`, `statements`, `all` |
| `limit` | number | `10` | Max results (1-50) |

## MCP Tool: search_provincial_lobbying

```json
{
  "name": "search_provincial_lobbying",
  "arguments": {
    "query": "Ontario Power Generation",
    "province": "ontario",
    "limit": 10
  }
}
```

### Provincial Lobbying Coverage

| Province | Registry Status |
|----------|----------------|
| Ontario | ✅ Full |
| British Columbia | ✅ Full |
| Alberta | ✅ Full |
| Quebec | ✅ Full |
| Saskatchewan | ⬜ Planned |
| Manitoba | ⬜ Planned |
| Remaining provinces | ⬜ Planned |

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | (required) | Lobbyist, organization, or subject |
| `province` | string | `all` | `ontario`, `british-columbia`, `alberta`, `quebec`, `all` |
| `limit` | number | `10` | Max results (1-50) |

## Use Cases

- **Lobbying transparency**: Who is lobbying whom about what legislation
- **Procurement oversight**: Find sole-source contracts, top vendors by department
- **Insider trading**: Monitor executive stock transactions at TSX-listed companies
- **Corporate influence**: Cross-reference company data with lobbying and political contributions
- **Charity tracking**: Review charity financials, political spending, compensation
- **Crown corp oversight**: Monitor financial health and governance of federal Crown corporations

## Example Queries for AI Agents

- *"Find all lobbying records related to Bill C-27 on AI regulation"*
- *"Show me sole-source contracts awarded by DND in 2024"*
- *"Search for insider trading transactions at Shopify"*
- *"What lobbying has Google done with the Canadian government?"*
- *"Find CRA charity data for WE Charity"*
- *"Show procurement contracts for McKinsey by department"*
- *"What are the latest Bank of Canada rate decision highlights?"*
