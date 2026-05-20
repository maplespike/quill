
---
last-reviewed: 2026-05-19
status: active

||||||| e980c07
 origin/main
# POST /v1/ai_ask

Ask a natural language question about Canadian government data. The AI searches across all pipeline sources (committees, lobbying, procurement, regulations, courts, oversight) and returns a cited, synthesized answer.

## Request

```bash
curl -X POST http://maplespike.lan/v1/ai_ask \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What did the Ethics Commissioner investigate in 2024?"}'
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | (required) | Natural language question about Canadian government data |
| `source_filter` | string | — | Narrow to specific source: `committees`, `lobbying`, `procurement`, `regulations`, `courts`, `oversight`, `gic`, `elections`, `corporate`, `influence`, `provincial_lobbying`, `lmia` |

### Source Filter Mappings

| Filter | Sources Searched |
|--------|-----------------|
| `committees` | House of Commons, Senate committee evidence |
| `lobbying` | Federal lobbying registry |
| `procurement` | Federal procurement contracts |
| `regulations` | Canada Gazette (Parts I, II, III) |
| `courts` | CanLII court decisions |
| `oversight` | OAG, PBO, Ethics, Competition Bureau, CRTC |
| `gic` | Governor-in-Council appointments |
| `elections` | Elections Canada third-party advertisers |
| `corporate` | Corporate registry data |
| `influence` | Influence actor records |
| `provincial_lobbying` | All 13 provinces/territories lobbying registries |
| `lmia` | LMIA quarterly data |

## Example Queries

```bash
# Query with source filter
curl -X POST http://maplespike.lan/v1/ai_ask \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the latest regulations on carbon pricing?", "source_filter": "regulations"}'

# Broad question across all sources
curl -X POST http://maplespike.lan/v1/ai_ask \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "How has immigration changed since 2020?"}'
```

## Response

```json
{
  "success": true,
  "data": {
    "answer": "According to the House of Commons Standing Committee...",
    "query": "What did the Ethics Commissioner investigate in 2024?",
    "sourceFilter": null,
    "citations": [
      {
        "source": "hoc",
        "title": "ETHI - Meeting 42",
        "url": "https://ourcommons.ca/..."
      }
    ],
    "totalPipelineRecordsFound": 5,
    "pipelineRecordsUsed": 5,
    "model": "claude-3.5-sonnet",
    "usage": {
      "promptTokens": 2542,
      "completionTokens": 512,
      "totalTokens": 3054
    }
  },
  "meta": {
    "creditsCharged": 1,
    ...
  }
}
```

## Also Available

```bash
POST /v1/ai/ask
```

This is an alias for the same endpoint.

## POST /v1/ai/analyze

Analyze a document, transcript, or data set using AI. Detects topics, sentiment, entities, and generates a structured summary.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | string | (required) | The text content to analyze (up to 50K chars) |
| `analysis_type` | string | `full` | Type: `summary`, `entities`, `sentiment`, `topics`, `full` |

### Analysis Types

| Type | Output |
|------|--------|
| `summary` | 2-3 paragraph summary with key points |
| `entities` | Extracted persons, organizations, locations, legislation |
| `sentiment` | Overall sentiment score, tone, emotional highlights |
| `topics` | Primary and secondary topics with relevance |
| `full` | All of the above combined |

### Example

```bash
curl -X POST http://maplespike.lan/v1/ai/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Full committee transcript text...", "analysis_type": "full"}'
```
