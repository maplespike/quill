# Mock Mode (`_mock=true`)

MapleSpike includes a mock data mode for development, testing, and demonstration purposes. Append `_mock=true` to any API endpoint to receive curated sample data instead of live queries.

## Usage

```bash
# Search with mock data
curl "http://maplespike.lan/v1/gov/search?q=housing&_mock=true"

# Releases with mock data
curl "http://maplespike.lan/v1/gov/releases?limit=3&_mock=true"

# Health with mock data
curl "http://maplespike.lan/v1/health?_mock=true"
```

## Benefits

- **No API key needed** — Mock endpoints work without authentication
- **Fast responses** — No upstream API calls, instant mock data
- **Consistent** — Same sample data every time, great for UI development
- **Network-independent** — Works offline
- **No quota consumption** — Mock requests don't count toward usage

## Available Mock Data Categories

| Category | Description |
|----------|-------------|
| `economy` | GDP, CPI, trade data, employment |
| `demographics` | Population, migration, diversity |
| `health` | Drug approvals, health stats |
| `justice` | Court cases, legal data |
| `environment` | Emissions, species, pollution |
| `education` | Schools, enrollment, funding |
| `social` | Social programs, benefits |
| `spending` | Government contracts, budgets |

## Mock Response Characteristics

Mock responses follow the same envelope format as real responses but with:

```
"meta": {
  "cacheStatus": "mock",
  ...
}
"quality": {
  "confidence": "simulated",
  "certainty_score": 0.75,
  ...
}
```

## Implementation

The mock data is served by the API server's `mock-data.ts` module, which returns curated sample data for each endpoint and category. Mock mode is processed before authentication, rate limiting, and caching, making it the fastest path through the request pipeline.

## Use Cases

| Scenario | Why Use Mock |
|----------|-------------|
| Frontend development | Test UI rendering without API dependency |
| Integration testing | Reliable, deterministic responses |
| CI/CD pipelines | No network dependency |
| Demo environments | Consistent demonstration data |
| SDK development | Test client logic without live data |
| Documentation examples | Guaranteed identical output |
