---
last-reviewed: 2026-07-07
status: active
---

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

---

## Quick Start

### 1. Get an API key

Sign up at [maplespike.ca](https://maplespike.ca) to get a free API key (1,000 requests/month).

### 2. Initialize the client

```ts
import { MapleSpike } from '@maplespike/sdk';

const ms = new MapleSpike({
  apiKey: process.env.QUILL_API_KEY,
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

## Features

### Cross-Domain Search

Search across all MapleSpike datasets with relevance scoring:

```ts
// Global search
const results = await ms.search.search({
  query: 'healthcare lobbying',
  limit: 10,
  sort: 'relevance',
});

// Domain-specific search
const corporateResults = await ms.search.searchDomain('corporate', {
  query: 'pharmaceutical',
  limit: 5,
});

// Get suggestions
const suggestions = await ms.search.suggestions('lobb', 5);
```

### Entity Resolution

Resolve entities (people, companies, organizations) across all datasets:

```ts
// Resolve an entity
const resolution = await ms.entityResolution.resolve({
  name: 'Bell Canada',
  type: 'company',
  minConfidence: 'medium',
});

// Get entity details
const entity = await ms.entityResolution.getEntity(entityId);

// Get entity graph (relationships)
const graph = await ms.entityResolution.getGraph(entityId, 2);

// Find similar entities
const similar = await ms.entityResolution.findSimilar(entityId, 5);

// Search for entities
const entities = await ms.entityResolution.searchEntities('bank', {
  type: 'company',
  limit: 10,
});

// Bulk resolve
const bulk = await ms.entityResolution.bulkResolve([
  { name: 'Rogers Communications', type: 'company' },
  { name: 'TD Bank', type: 'company' },
]);
```

### Data Ingestion

Upload and manage data ingestion jobs:

```ts
// Validate data before ingestion
const validation = await ms.ingestion.validate({
  sourceType: 'url',
  sourceUrl: 'https://example.com/data.csv',
  domain: 'immigration',
  validate: true,
  deduplicate: true,
});

// Submit ingestion job
const job = await ms.ingestion.ingest({
  sourceType: 'url',
  sourceUrl: 'https://example.com/data.csv',
  domain: 'immigration',
  validate: true,
  deduplicate: true,
  metadata: {
    source: 'custom-import',
    uploadedBy: 'user@example.com',
  },
});

// Get job status
const status = await ms.ingestion.getJob(job.data.jobId);

// List recent jobs
const jobs = await ms.ingestion.listJobs({
  limit: 10,
  status: 'completed',
});

// Get ingestion statistics
const stats = await ms.ingestion.stats();
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
| **indigenous** | `.landClaims()`, `.iscSpending()`, `.fnTransparency()`, `.trcProgress()` |
| **criminalJustice** | `.corrections()`, `.parole()`, `.rcmpCrimeStats()`, `.prosecutions()` |
| **defence** | `.personnel()`, `.procurement()` |
| **municipal** | `.meetings()`, `.budgets()`, `.openData()` |
| **transport** | `.tsbOccurrences()`, `.tcRecalls()`, `.ctaRulings()` |
| **realtime** | `.weatherAlerts()`, `.borderWaits()`, `.paroleRegistry()` |
| **media** | `.crtcMarketReports()`, `.ownershipCharts()`, `.cmfData()` |
| **education** | `.triCouncilGrants()`, `.researchChairs()`, `.studentLoans()`, `.cudoData()` |
| **socialPrograms** | `.ccbData()`, `.cppOas()`, `.eiStatistics()`, `.povertyData()` |
| **bankOfCanada** | `.rateDecisions()`, `.monetaryPolicy()` |
| **sedi** | `.insiderTransactions()` |
| **unions** | `.reports()` |
| **universities** | `.data()` |
| **crtc** | `.decisions()`, `.ownership()` |
| **craCharity** | `.search()`, `.politicalSpending()` |
| **provincialRegulators** | `.search()`, `.coverage()` |
| **a2aj** | `.search()`, `.fetchByCitation()`, `.coverage()` |
| **legislation** | `.federalActs()`, `.federalRegulations()`, `.provincialLegislation()` |
| **gocSpending** | `.contracts()`, `.spendingSummary()` |
| **financialRegulation** | `.data()`, `.crossReference()` |
| **energy** | `.data()` |
| **realEstate** | `.data()` |
| **watcher** | `.status()`, `.events()` |

### Advanced Clients

| Client | Methods |
|--------|---------|
| **search** | `.search()`, `.searchDomain()`, `.suggestions()`, `.stats()` |
| **entityResolution** | `.resolve()`, `.getEntity()`, `.searchEntities()`, `.getGraph()`, `.findSimilar()`, `.bulkResolve()`, `.stats()` |
| **ingestion** | `.ingest()`, `.getJob()`, `.listJobs()`, `.cancelJob()`, `.deleteJob()`, `.validate()`, `.stats()` |

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
    console.error(err.status, err.code, err.message, err.requestId);
  }
}
```

### Query Options

Pass as the second argument to `.query()`:

```ts
const data = await ms.query('immigration', 'permanent-residents',
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

## Examples

See the [`examples/`](./examples) directory for complete working examples:

- [`basic-usage.ts`](./examples/basic-usage.ts) - Getting started with basic queries
- [`search.ts`](./examples/search.ts) - Cross-domain search functionality
- [`entity-resolution.ts`](./examples/entity-resolution.ts) - Entity resolution and graphs
- [`ingestion.ts`](./examples/ingestion.ts) - Data ingestion workflow
- [`advanced-usage.ts`](./examples/advanced-usage.ts) - Error handling and advanced features

Run examples:

```bash
pnpm build
node --loader tsx examples/basic-usage.ts
```

---

## Testing

### Unit Tests

```bash
pnpm test
```

### Integration Tests

Integration tests run against live/local API endpoints:

```bash
# Set environment variables
export TEST_API_URL=http://127.0.0.1:8082
export TEST_API_KEY=maplespike-dev-key

# Run integration tests
pnpm test:watch
```

Or run specific integration test suite:

```bash
tsx tests/integration/sdk.test.ts
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
pnpm test:coverage  # coverage report
```

---

## License status

`package.json` declares MIT, but this repository's root `LICENSE` is AGPL-3.0 and the published package's license/copyright files have not been verified in the packed artifact. See [`LICENSE.md`](../../LICENSE.md) and the [open-source audit](../../docs/open-source-audit.md). Do not use this README as a final distribution grant until the rights holder resolves package scope and confirms the published archive contents.

---

## Links

- [MapleSpike Portal](https://maplespike.ca)
- [API Docs](https://quill.maplespike.ca/docs)
- [GitHub](https://github.com/reverb256/quill)
- [Issues](https://github.com/reverb256/quill/issues)