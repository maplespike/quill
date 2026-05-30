# World Bank WDI Module

## Overview

Ingests World Bank development indicators.

## Data Sources

- World Bank Open Data API

## Data Types

- Economic indicators (GDP, population, etc.)
- Health indicators
- Education indicators
- Military spending
- R&D expenditure
- Trade indicators
- FDI
- ODA

## MCP Tools

- `get_wdi_indicator` - Fetch specific indicator data
- `compare_wdi_countries` - Compare indicator across multiple countries
- `get_country_wdi_profile` - Get full indicator profile for a country

## Usage

```typescript
import { ingestWDIIndicator, getCountryProfile } from '@maplespike/pipeline-core/worldbank-wdi';

const gdp = await ingestWDIIndicator('NY.GDP.MKTP.CD', ['CA']);
const canadaProfile = await getCountryProfile('CA');
```

## License

CC BY 4.0