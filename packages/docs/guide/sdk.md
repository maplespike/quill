---
last-reviewed: 2026-07-07
status: active
---

# TypeScript SDK

The `@maplespike/sdk` package provides a typed client for all MapleSpike features. It ships as dual CJS/ESM and covers all 126 ingestion modules.

## Installation

```bash
npm install @maplespike/sdk
# or
pnpm add @maplespike/sdk
# or
yarn add @maplespike/sdk
```

## Quick Start

```typescript
import { QuillClient } from '@maplespike/sdk';

const client = new QuillClient({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'http://localhost/v1',
});

// Check health
const health = await client.health();
console.log(health.status); // 'ok'

// Search government data
const results = await client.searchGovData({
  query: 'housing starts',
  jurisdiction: 'federal',
  limit: 10,
});
console.log(results.results);

// Search committees
const committees = await client.searchCommittees({
  query: 'carbon tax',
  chamber: 'all',
  limit: 5,
});
```

## Client API

### Construction

```typescript
const client = new QuillClient({
  apiKey: string;        // Required: API key
  baseUrl?: string;      // Default: 'http://localhost/v1'
  timeout?: number;      // Default: 15000 (ms)
  retries?: number;      // Default: 3
  headers?: Record<string, string>; // Additional headers
});
```

### Methods

| Method | Description |
|--------|-------------|
| `health()` | Check API health and get usage stats |
| `searchGovData(params)` | Search across all government data sources |
| `searchCommittees(params)` | Search committee evidence and transcripts |
| `searchCorporate(params)` | Search corporate registry, lobbying, procurement |
| `searchInfluence(params)` | Search influence actor records |
| `searchGazette(params)` | Search Canada Gazette regulations |
| `searchGic(params)` | Search Governor-in-Council appointments |
| `searchElections(params)` | Search Elections Canada data |
| `searchProvincialLobbying(params)` | Search provincial lobbying registries |
| `searchOversight(params)` | Search oversight body reports |
| `searchCanlii(params)` | Search court decisions via CanLII |
| `searchLmia(params)` | Search LMIA quarterly data |
| `searchImmigration(params)` | Search IRCC/IRB/CBSA immigration data |
| `searchScience(params)` | Search science and research data |
| `searchTribunals(params)` | Search federal tribunal decisions |
| `searchLode(params)` | Search LODE geospatial databases |
| `getCitation(hash)` | Retrieve and verify a citation hash |
| `latestReleases(params)` | Get latest government data releases |
| `factCheck(claim)` | Check a claim against official data |
| `aiAsk(params)` | Ask a natural language question |
| `aiAnalyze(params)` | Analyze a document with AI |
| `getUsage()` | Get current API usage and quota |
| `listKeys()` | List API keys |
| `createKey(label)` | Create a new API key |
| `deleteKey(id)` | Delete an API key |
| `rotateKey(id)` | Rotate an API key |

### Response Types

All methods return typed responses matching the API response envelope:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
  meta: {
    requestId: string;
    timestamp: string;
    version: string;
    usage: { periodCalls: number; periodLimit: number; tier: string };
    creditsCharged: number;
    cacheStatus: 'hit' | 'miss';
    durationMs: number;
  };
  quality: {
    freshness_seconds: number;
    source_uptime_7d: number;
    confidence: string;
    certainty_score: number;
  };
  citation: Record<string, unknown> | null;
}
```

## Module API

For direct access to ingestion modules:

```typescript
import { getModule, runModule, getAllModules, getModulesByCategory } from '@maplespike/sdk';

// Get all module names
const allModules = getAllModules();

// Get modules by category
const healthModules = getModulesByCategory('health');

// Run a specific module
const results = await runModule('committees', { limit: 10 });
```

## Error Handling

```typescript
try {
  const result = await client.searchGovData({ query: 'GDP' });
  console.log(result);
} catch (error) {
  if (error.status === 401) {
    console.error('Invalid API key');
  } else if (error.status === 429) {
    console.error('Rate limited');
  } else if (error.status === 402) {
    console.error('Monthly quota exhausted');
  }
}
```

## TypeScript Support

The SDK includes full TypeScript declarations. Import types directly:

```typescript
import type {
  GovSearchParams,
  CommitteeSearchParams,
  ImmigrationSearchParams,
  LodeSearchParams,
  AiAskParams,
  ApiResponse,
  SearchResults,
} from '@maplespike/sdk';
```
