---
last-reviewed: 2026-07-07
status: active
---

# LODE Geospatial Module

The LODE (Linkable Open Data Environment) module provides access to Statistics Canada's geospatial databases — 12 databases covering addresses, buildings, healthcare, recreation, education, culture, businesses, infrastructure, greenhouses, pedestrian networks, transit networks, and cycling networks.

Powered by the `search_lode` MCP tool.

## What is LODE?

LODE is Statistics Canada's initiative to link geospatial data across federal, provincial, and municipal sources. It compiles data from 530+ datasets across 107 government sources into a unified geospatial framework.

## The 12 LODE Databases

| ID | Name | Records | Version | Formats |
|----|------|---------|---------|---------|
| `oda` | Open Database of Addresses | ~10,000,000 | 1.0 | CSV |
| `odb` | Open Database of Buildings | ~14,400,000 | 3.0 | FGDB/GDB, ESRI REST, WMS |
| `odhf` | Open Database of Healthcare Facilities | ~7,000 | 1.1 | CSV, FGDB/GDB, ESRI REST, WMS |
| `odrsf` | Open Database of Recreational/Sport Facilities | ~182,000 | 1.0 | CSV |
| `odef` | Open Database of Educational Facilities | ~19,000 | 3.0 | CSV |
| `odcaf` | Open Database of Cultural/Art Facilities | ~8,000 | 1.0 | CSV |
| `odbusiness` | Open Database of Businesses | ~500,000 | 1.0 | CSV |
| `odi` | Open Database of Infrastructure | ~100,000 | 2.0 | ESRI REST, FGDB/GDB |
| `odg` | Open Database of Greenhouses | ~3,900 | 2.0 | GIS, GeoJSON |
| `cpnd` | Canadian Pedestrian Network Database | ~500,000 | 1.0 | ESRI REST, FGDB/GDB, GeoJSON |
| `cptnd` | Canadian Public Transit Network Database | ~1,000,000 | 1.0 | GTFS, GeoJSON, FGDB/GDB |
| `ccnd` | Canadian Cycling Network Database | ~250,000 | 1.0 | ESRI REST, FGDB/GDB, GeoJSON |

## Module Structure

```
packages/pipeline-core/src/ingestion/geospatial/
  constants.ts  — LODE database URLs, metadata, API endpoints
  types.ts      — LodeDatabase, GeospatialRecord interfaces
  fetcher.ts    — StatCan LODE metadata fetcher + CKAN geospatial search
  parser.ts     — Geospatial metadata parsing
  index.ts      — searchLode(), listLodeDatabases(), ingestLodeDatabaseById()
```

## MCP Tool: search_lode

```json
{
  "name": "search_lode",
  "arguments": {
    "query": "hospitals Toronto",
    "databaseId": "odhf",
    "province": "ON",
    "limit": 10
  }
}
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | — | Search terms (e.g., "hospitals Ottawa", "arena Toronto") |
| `databaseId` | string | — | Target specific LODE database |
| `province` | string | — | Filter by province code (e.g., ON, QC, BC) |
| `municipality` | string | — | Filter by municipality name |
| `list` | boolean | — | Set `true` to list all 12 databases with metadata |
| `limit` | number | `10` | Max results (1-100) |

### List Mode

Set `list: true` to get the full catalog:

```json
{
  "name": "search_lode",
  "arguments": {
    "list": true
  }
}
```

Returns all 12 databases with descriptions, record counts, versions, formats, and download URLs.

## Database Details

### Open Database of Addresses (ODA)
- 10M+ civic addresses with geo-locations
- Standardized address format with building, street, city, province, postal code
- Geocoded point locations

### Open Database of Buildings (ODB)
- 14.4M building features
- Compiled from 530 datasets across 107 government sources
- Building footprints, heights, and attributes

### Open Database of Healthcare Facilities (ODHF)
- ~7,000 healthcare facilities
- Hospitals, clinics, long-term care, mental health facilities
- Full address, facility type, operational status

### Open Database of Infrastructure (ODI)
- 11 infrastructure types: electric grid, oil/gas, low carbon, bridges/tunnels, airports, ports, railways, water, waste, wastewater, telecom
- ~100,000 infrastructure assets

## Data Access Notes

Most LODE databases are large (MB to GB) and require direct download from Statistics Canada. The MCP tool provides metadata and search integration. Direct CSV download is available for ODHF (healthcare). Other databases are accessible via ESRI REST services.

**Source portal:** https://www.statcan.gc.ca/eng/lode/databases

**Source terms:** The MCP catalog response does not establish reuse terms for each LODE dataset. Check the dataset's Statistics Canada page and applicable publisher terms before reuse. Public availability does not itself establish reuse rights.

## Use Cases

- **Address geocoding**: Use ODA for address-to-coordinate lookup
- **Urban planning**: Use ODB + CPND + CCND for infrastructure planning
- **Healthcare access**: Use ODHF for healthcare facility proximity analysis
- **Transit analysis**: Use CPTND for public transit network queries
- **Business intelligence**: Use ODBusiness for business density analysis
- **Environmental monitoring**: Use ODG for greenhouse detection and analysis

## Example Queries for AI Agents

- *"Find all hospitals in Ottawa from the LODE healthcare database"*
- *"List the LODE databases and show me the buildings database"*
- *"How many recreational facilities are in British Columbia?"*
- *"Search for elementary schools in Toronto using LODE education data"*
- *"Find business locations in Vancouver's downtown core"*
