---
last-reviewed: 2026-05-25
status: active
---

# Committee Evidence Module

The committees module ingests, parses, and indexes parliamentary committee evidence from the House of Commons and Senate. It powers the `search_committees` MCP tool.

## Source

- **House of Commons**: XML evidence API at `ourcommons.ca`
- **Senate**: XML evidence API at `sencanada.ca`
- **Coverage**: 50 committees (30 HoC + 20 Senate)

## Module Structure

```
packages/pipeline-core/src/ingestion/committees/
  constants.ts  — Committee codes, URL templates, lookup tables
  types.ts      — CommitteeRecord, Intervention, Speaker interfaces
  fetcher.ts    — HTTP fetch from ourcommons.ca XML API
  parser.ts     — XML to typed record parsing
  db.ts         — SQLite persistence and search
  index.ts      — ingestCommittee(), ingestAllCommittees(), searchCommittees()
```

## Key Functions

| Function | Description |
|----------|-------------|
| `ingestCommittee(committeeCode)` | Fetch and persist evidence for a single committee |
| `ingestAllCommittees()` | Run ingestion for all 50 committees |
| `ingestSenateCommittees()` | Senate-specific ingestion |
| `ingestInCameraMeetings()` | Detect and flag in-camera (secret) meetings |

## Committee Codes

Common House of Commons committees:

| Code | Committee |
|------|-----------|
| FINA | Finance |
| OGGO | Government Operations and Estimates |
| ETHI | Access to Information, Privacy and Ethics |
| SECU | Public Safety and National Security |
| JUST | Justice and Human Rights |
| INAN | Indigenous and Northern Affairs |
| FEWO | Status of Women |
| CIIT | International Trade |
| INTA | International Trade |
| ENVI | Environment and Sustainable Development |
| HESA | Health |
| INDU | Industry, Science and Technology |
| TRAN | Transport, Infrastructure and Communities |
| RNRN | Natural Resources |
| AANO | Aboriginal Affairs and Northern Development |

## Data Shape

```typescript
interface CommitteeRecord {
  id: string;
  chamber: 'house' | 'senate' | 'joint';
  committee: string;
  committeeName: string;
  meetingNumber: number;
  date: string;
  parliament: number;
  session: number;
  isInCamera: boolean;
  interventions: Intervention[];
}

interface Intervention {
  speaker: string;
  party: string;
  riding: string;
  role: string;
  text: string;
  timestamp: string;
  timecode: string;
}
```

## MCP Tool

The `search_committees` MCP tool provides full-text search over all ingested committee evidence:

```json
{
  "name": "search_committees",
  "arguments": {
    "query": "affordable housing",
    "chamber": "house",
    "committee": "FINA",
    "limit": 10
  }
}
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | (required) | Search terms |
| `chamber` | string | `all` | `house`, `senate`, `joint`, `all` |
| `committee` | string | — | Specific committee code |
| `limit` | number | `10` | Max results (1-50) |

### Example Queries for AI Agents

- *"Search committee transcripts for recent mentions of housing policy"*
- *"What did witnesses say about foreign interference in 2024?"*
- *"Find all interventions by [MP Name] on the topic of pharmacare"*
- *"Search Senate committees for discussions about Bill C-69"*

## Use Cases

- Track witness testimony on specific policy issues
- Monitor committee investigations and inquiries
- Find statements by specific MPs or ministers
- Identify recurring themes across committee hearings
- Research parliamentary oversight of government programs
