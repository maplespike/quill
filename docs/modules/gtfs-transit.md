# GTFS Transit Module

## Overview

Ingests GTFS (General Transit Feed Specification) data from 7 Canadian transit agencies.

## Data Sources

- BC Transit
- Barrie Transit
- Thunder Bay Transit
- STO (Gatineau)
- Exo
- STM
- CRT Lanaudiere

## Data Types

- Routes
- Stops
- Schedules
- Real-time vehicle positions (where available)

## MCP Tools

- `get_gtf_by_city` - Fetch GTFS data for a specific agency
- `get_gtfs_schedules` - Get schedules for a specific city and route
- `get_gtfs_trends` - Get trends over time

## Usage

```typescript
import { ingestGTFSAgency } from '@maplespike/pipeline-core/gtfs-transit';

const stmData = await ingestGTFSAgency('STM');
```

## License

Open Data License (varies by agency)