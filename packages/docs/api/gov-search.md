# GET /v1/gov/search

Search across all Canadian government data sources. This is the primary data query endpoint, covering Statistics Canada cubes, open.canada.ca CKAN datasets, provincial data, federal spending, and more.

## Request

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://maplespike.lan/v1/gov/search?q=housing+starts&jurisdiction=federal&category=economy&limit=5"
```

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | (required) | Search keyword(s) |
| `jurisdiction` | string | `all` | Filter: `federal`, `ontario`, `british-columbia`, `alberta`, `quebec`, `all` |
| `category` | string | `all` | Data category: `economy`, `demographics`, `health`, `justice`, `environment`, `education`, `social`, `spending`, `all` |
| `limit` | number | `10` | Max results (1-50) |

## Example Queries

```bash
# Search federal spending data
curl "http://maplespike.lan/v1/gov/search?q=procurement&jurisdiction=federal&category=spending&limit=5"

# Search Ontario health data
curl "http://maplespike.lan/v1/gov/search?q=wait+times&jurisdiction=ontario&category=health&limit=5"

# Search environmental data across all jurisdictions
curl "http://maplespike.lan/v1/gov/search?q=carbon+emissions&category=environment&limit=10"
```

## Response

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "title": "Housing Starts, by Province",
        "source": "Statistics Canada",
        "type": "data_cube",
        "category": "economy",
        "jurisdiction": "federal",
        "summary": "Monthly housing starts by province and CMA",
        "url": "https://www150.statcan.gc.ca/...",
        "releasedAt": "2026-04-15",
        "_source": "statcan",
        "_citation": "sha256-abc123..."
      }
    ],
    "total": 42
  },
  "meta": { ... },
  "quality": { ... },
  "citation": {
    "source_name": "open.canada.ca",
    "license": "Open Government Licence – Canada",
    ...
  }
}
```

## GET /v1/gov/releases

Get the latest government data releases and economic indicators.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | `20` | Max results |
| `category` | string | — | Filter by category |

### Example

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://maplespike.lan/v1/gov/releases?limit=5&category=economy"
```

Response includes a `releases` array and `total` count.

## GET /v1/citation/:id

Retrieve and verify a SHA-256 citation hash. No authentication required.

### Example

```bash
curl "http://maplespike.lan/v1/citation/sha256-abc123def456"
```

Response returns the original data, timestamp, source attribution, and a shell command for independent hash verification.
