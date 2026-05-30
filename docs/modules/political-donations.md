# Political Donations Module

## Overview

Ingests political donation data from all 13 Canadian provinces and territories.

## Data Sources

- Election BC
- Elections Ontario
- Elections Quebec
- Elections Alberta
- Elections Saskatchewan
- Elections Manitoba
- Elections New Brunswick
- Elections Nova Scotia
- Elections PEI
- Elections Newfoundland and Labrador
- Elections Yukon
- Elections Northwest Territories
- Elections Nunavut

## Data Types

- Individual donations
- Corporate donations
- Third-party advertising spending
- Leadership race donations

## MCP Tools

- `get_donations_by_jurisdiction` - Fetch donations for a specific jurisdiction
- `compare_donations_parties` - Compare donations across parties
- `get_donations_trends` - Get trends over time

## Usage

```typescript
import { ingestDonations } from '@maplespike/pipeline-core/political-donations';

const bcDonations = await ingestDonations('BC');
```

## License

Open Data License (varies by jurisdiction)