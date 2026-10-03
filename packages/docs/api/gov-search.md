---
last-reviewed: 2026-07-07
status: active
---

# GET /v1/gov/search

Search records from sources configured for this endpoint, including supported Statistics Canada, CKAN, provincial, and federal spending data. Coverage, fields, and availability vary by source and deployment.

## Request

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:8082/v1/gov/search?q=housing+starts&jurisdiction=federal&category=economy&limit=5"
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
curl "http://localhost:8082/v1/gov/search?q=procurement&jurisdiction=federal&category=spending&limit=5"

# Search Ontario health data
curl "http://localhost:8082/v1/gov/search?q=wait+times&jurisdiction=ontario&category=health&limit=5"

# Search for environmental records across configured jurisdictions
curl "http://localhost:8082/v1/gov/search?q=carbon+emissions&category=environment&limit=10"
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
    "license": "Publisher-provided metadata when supplied, or a notice to consult source terms",
    "license_basis": "publisher-metadata or no-publisher-declaration",
    "retrieved_at": null,
    "provenance_evidence": null,
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
  "http://localhost:8082/v1/gov/releases?limit=5&category=economy"
```

Response includes a `releases` array and `total` count.

## GET /v1/citation/:id

Look up a record by its canonical SHA-256 hash. A matching Quill record hash checks that representation only; it does not authenticate the source or establish reuse rights. No authentication required.

### Example

```bash
curl "http://localhost:8082/v1/citation/sha256-abc123def456"
```

The response may include the matching record, available source metadata, and a command to reproduce the canonical-record hash. Source retrieval time and provenance evidence may be unavailable.
