# Fire Emergency Module

## Overview

Ingests fire department data from 4 Canadian cities.

## Data Sources

- Edmonton Fire Rescue
- Montreal Fire Department
- Quebec City Fire Department
- Sherbrooke Fire Department

## Data Types

- Fire incidents
- Response times
- Station locations

## MCP Tools

- `get_fire_by_city` - Fetch fire department data for a specific city
- `compare_fire_response` - Compare response times across cities
- `get_fire_trends` - Get trends over time

## Usage

```typescript
import { ingestFireData } from '@maplespike/pipeline-core/fire-emergency';

const edmontonData = await ingestFireData('Edmonton');
```

## License

Open Data License (varies by city)