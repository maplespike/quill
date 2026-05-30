# Police Data Module

## Overview

Ingests police statistics from 6 Canadian cities.

## Data Sources

- Edmonton Police Service
- Montreal Police
- Quebec City Police
- Sherbrooke Police
- Calgary Police Service
- Vancouver Police Department

## Data Types

- Crime statistics
- Response times
- Incident reports
- Use of force statistics

## MCP Tools

- `get_police_by_city` - Fetch police statistics for a specific city
- `compare_police_crime` - Compare crime statistics across cities
- `get_police_trends` - Get trends over time

## Usage

```typescript
import { ingestPoliceData } from '@maplespike/pipeline-core/police-data';

const edmontonData = await ingestPoliceData('Edmonton');
```

## License

Open Data License (varies by city)