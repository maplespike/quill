---
last-reviewed: 2026-07-07
status: active
---

# Getting Started

This guide walks you through getting access to MapleSpike and making your first query.

## Prerequisites

- An HTTP client (`curl`, httpie, or any programming language)
- A MapleSpike API key (see below)
- For MCP access: Claude Desktop, Cursor, or any MCP-compatible client

## Get an API Key

MapleSpike uses API keys for authentication. Keys are tied to a tenant (user/team) and a tier (Free, Pro, Business, Enterprise).

To get your first API key:

1. **Register via the API** (if you have access to the register endpoint):
   ```bash
   curl -X POST https://api.maplespike.ca/v1/register \
     -H "Content-Type: application/json" \
     -d '{"name": "My Account", "email": "user@example.com"}'
   ```

2. **Contact the team** for early-access keys at the MapleSpike GitHub repository.

3. **For local development**, use the dev key:
   ```
   QUILL_API_KEY=maplespike-dev-key
   ```

## Response Envelope

All API responses follow a standard envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "requestId": "maplespike-abc123...",
    "timestamp": "2026-05-14T11:36:00Z",
    "version": "0.1.0",
    "usage": { "periodCalls": 5, "periodLimit": 1000, "tier": "free" },
    "creditsCharged": 0,
    "cacheStatus": "hit|miss",
    "durationMs": 42
  },
  "quality": {
    "freshness_seconds": 3600,
    "source_uptime_7d": 0.98,
    "confidence": "high",
    "certainty_score": 0.95
  },
  "citation": {
    "source_name": "Statistics Canada",
    "license": "Publisher-declared terms when supplied; otherwise an explicit notice to consult the publisher's terms",
    "license_basis": "publisher-metadata or no-publisher-declaration",
    "retrieved_at": null,
    "provenance_evidence": null
  }
}
```

## Your First Query

### Check Health

```bash
curl https://api.maplespike.ca/v1/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "MapleSpike API",
    "version": "0.1.0",
    "tenant": { "id": "...", "tier": "free" },
    "usage": { "daily": 1, "monthly": 1 }
  }
}
```

### Search Government Data

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.maplespike.ca/v1/gov/search?q=housing+starts&jurisdiction=federal&limit=5"
```

### Ask a Question (AI)

```bash
curl -X POST https://api.maplespike.ca/v1/ai_ask \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What did the Ethics Commissioner investigate in 2024?"}'
```

### Via MCP (with Claude Desktop)

Configure your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "maplespike": {
      "url": "http://quill-mcp.lan:3001/sse"  <!-- internal for local dev; use public MCP endpoint when available -->
    }
  }
}
```

Then ask Claude: *"Search House of Commons committees for recent mentions of 'carbon tax'"*

## Next Steps

 - Read the [Quickstart](./quickstart) for a 5-minute walkthrough with curl examples
 - See the [API Endpoints](/api/endpoints) for the full API catalog
 - Browse the [MCP Tools](/mcp/tools) for all 129 available tools
 - Check [Authentication](./authentication) for all auth methods
 - Review [Billing & Limits](./billing) for tier information
