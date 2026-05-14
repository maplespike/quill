# MapleSpike SDK · `@maplespike/sdk`

> **Canadian civic data, one import away.**  
> Typed TypeScript client for parliamentary committees, corporate registry, immigration stats, elections, gazette, LMIA, courts, oversight, and more.

```ts
import { MapleSpike } from '@maplespike/sdk';

const ms = new MapleSpike({ apiKey: 'ms_live_...' });

const pr = await ms.immigration.permanentResidents({ province: 'ON', year: 2025 });
console.log(pr.data); // → typed response
```

---

## Install

```bash
npm install @maplespike/sdk
# or
pnpm add @maplespike/sdk
# or
bun add @maplespike/sdk
```

## Quick Start

### 1. Get an API key

Sign up at [maplespike.ca](https://maplespike.ca) to get a free API key (1,000 requests/month).

### 2. Initialize the client

```ts
import { MapleSpike } from '@maplespike/sdk';

const ms = new MapleSpike({
  apiKey: process.env.MAPLESPIKE_API_KEY,
});
```

### 3. Query data

Domain methods are fully typed. Use `.agent().action()` for generic access.

```ts
// Immigration — permanent residents by province
const residents = await ms.immigration.permanentResidents({
  province: 'ON',
  year: 2025,
  limit: 100,
});

// Committees — current meetings
const meetings = await ms.committees.meetings({
  parliament: 44,
  chamber: 'commons',
});

// Corporate — lobbying activities
const lobbying = await ms.corporate.lobbying({
  subject: 'healthcare',
  dateFrom: '2024-01-01',
});

// LMIA — employer-specific records
const lmia = await ms.lmia.search({
  employer: 'MapleCorp',
  year: 2024,
});
```

### 4. Generic query (any endpoint)

For endpoints not covered by typed methods:

```ts
const data = await ms.query('regulations', 'regulatory-proposals', {
  status: 'open',
  limit: 50,
});
```

---

## API Reference

### Authentication

| Method | Description |
|--------|-------------|
| `new MapleSpike({ apiKey })` | Initialize with API key |
| `new MapleSpike({ jwtToken })` | Initialize with JWT |
| `ms.apiKey = 'msk_...'` | Set/update API key |
| `ms.isAuthenticated()` | Check if auth is configured |
| `ms.clearAuth()` | Reset credentials |

### Domain Methods

| Domain | Methods |
|--------|---------|
| **committees** | `.membership()`, `.meetings()`, `.reports()`, `.witnesses()` |
| **corporate** | `.profile()`, `.filings()`, `.directors()`, `.lobbying()` |
| **immigration** | `.permanentResidents()`, `.studyPermits()`, `.workPermits()`, `.refugeeDecisions()` |
| **elections** | `.results()`, `.contributions()`, `.thirdParty()` |
| **oversight** | `.auditorReports()`, `.watchdog()`, `.atip()`, `.conflictOfInterest()` |
| **gazette** | `.notices()`, `.regulations()` |
| **lmia** | `.search()`, `.stats()` |
| **courts** | `.decisions()`, `.tribunalRulings()` |
| **gic** | `.appointments()` |
| **provincial** | `.lobbying()` |
| **influence** | `.actors()`, `.funding()` |
| **regulations** | `.proposals()`, `.decisions()`, `.consultations()` |
| **science** | `.search()` |
| **health** | `.search()` |

### Response Structure

Every query returns:

```ts
interface MapleSpikeResponse<T> {
  data: T;                    // Typed response payload
  meta: ResponseMeta;          // Request metadata
  quality: ResponseQuality;    // Data quality signals
  citation: Citation;          // Source attribution
}
```

### Error Handling

```ts
import { MapleSpikeError } from '@maplespike/sdk';

try {
  await ms.immigration.permanentResidents();
} catch (err) {
  if (err instanceof MapleSpikeError) {
    console.error(err.status, err.code, err.message);
  }
}
```

### Query Options

Pass as the second argument to any method:

```ts
const data = await ms.immigration.permanentResidents(
  { province: 'ON' },
  {
    _mock: false,       // Use mock data
    _fields: 'year,count', // Field projection
    _format: 'compact',  // Output format
    _limit: 100,        // Max records
    _page: 2,           // Pagination
    _summary: true,     // Summary only
  },
);
```

---

## MCP Integration

For AI agent integration via the Model Context Protocol:

```ts
const config = ms.getMcpConfig();
// → { serverUrl: 'https://mcp.maplespike.ca', apiKey: 'msk_...' }
```

Configure your AI agent's MCP client with `config.serverUrl` and the API key.

---

## Development

```bash
pnpm install
pnpm build    # CJS + ESM + types via tsup
pnpm dev      # watch mode
pnpm test     # run tests
```

---

## License

MIT — see [LICENSE](LICENSE)

---

## Links

- [MapleSpike Portal](https://maplespike.ca)
- [API Docs](https://maplespike.ca/docs.html)
- [GitHub](https://github.com/reverb256/maplespike)
- [Issues](https://github.com/reverb256/maplespike/issues)
