# UN Comtrade Module

## Overview

Ingests international trade statistics from UN Comtrade API.

## Data Sources

- UN Comtrade API

## Data Types

- Bilateral trade flows
- Harmonized System (HS) commodity codes
- Import/export statistics

## MCP Tools

- `get_comtrade_by_partner` - Fetch trade data for a specific partner country
- `get_comtrade_by_commodity` - Fetch trade data for a specific commodity
- `get_comtrade_trends` - Get trade trends over time

## Usage

```typescript
import { ingestComtrade } from '@maplespike/pipeline-core/un-comtrade';

const usTrade = await ingestComtrade('US');
```

## Requirements

- `UN_COMMERCE_API_KEY` environment variable

## License

Open Access with Attribution