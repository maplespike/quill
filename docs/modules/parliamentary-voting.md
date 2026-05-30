# Parliamentary Voting Module

## Overview

Ingests House of Commons voting records from ourcommons.ca.

## Data Sources

- ourcommons.ca (Parliament of Canada)

## Data Types

- Division (vote) records
- MP votes
- Bill/motion context
- Party voting patterns

## MCP Tools

- `get_voting_record` - Fetch voting record for a specific division
- `get_mp_voting_pattern` - Get voting pattern for a specific MP
- `compare_party_voting` - Compare party voting patterns

## Usage

```typescript
import { ingestVotingRecords, getMPVotingPattern } from '@maplespike/pipeline-core/parliamentary-voting';

const allVotes = await ingestVotingRecords();
const mpPattern = await getMPVotingPattern('MP-ID');
```

## License

Open Data License