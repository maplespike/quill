---
last-reviewed: 2026-05-19
last-reviewed: 2026-05-19
status: active

# Quickstart

A 5-minute walkthrough to get data from MapleSpike using curl and MCP.

## 1. Check the Service is Running

```bash
curl http://maplespike.lan/v1/health
```

Expect a `200 OK` with `"status": "ok"`.

## 2. Search Committee Evidence

Search across all 50 House of Commons and Senate committees:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://maplespike.lan/v1/gov/search?q=foreign+interference&limit=3"
```

## 3. Find Lobbying Records

Search the federal lobbying registry:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://maplespike.lan/v1/gov/search?q=McKinsey&limit=5"
```

## 4. Verify a Citation

Every record has a SHA-256 citation hash. Verify one:

```bash
curl "http://maplespike.lan/v1/citation/sha256-abc123"
```

## 5. Check Your Usage

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://maplespike.lan/v1/usage"
```

## 6. Ask a Natural Language Question

```bash
curl -X POST http://maplespike.lan/v1/ai_ask \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the latest immigration numbers for 2024?"}'
```

## Using MCP Tools with an AI Agent

If you have the MCP server configured, you can use natural language:

> *"Search committee transcripts for recent mentions of housing policy"*
> Uses `search_committees` tool.

> *"Find sole-source contracts awarded by DND in the last quarter"*
> Uses `search_corporate` tool with `dataset=procurement`.

> *"Check the claim that unemployment rate rose to 6.5%"*
> Uses `fact_check` tool.

> *"Verify citation cit-001 and show the verification command"*
> Uses `get_citation` tool.

## What's Available

| Query Pattern | MCP Tool | What You Get |
|---------------|----------|--------------|
| "Find committee meetings on..." | `search_committees` | Witness testimony, speaker attributions, dates |
| "Search lobbying for..." | `search_corporate` | Registrations, communication reports, subjects |
| "Find regulations about..." | `search_gazette` | Proposed/enacted regulations, RIAS analysis |
| "Track GIC appointments to..." | `search_gic` | Appointee data, salary ranges, departments |
| "Search court decisions on..." | `search_canlii` | Case summaries, citations, parties |
| "Find LMIA data for..." | `search_lmia` | TFW program usage by employer/occupation |
| "Check immigration data for..." | `search_immigration` | PR admissions, refugee decisions, enforcement |
| "Search oversight reports on..." | `search_oversight` | OAG, PBO, Ethics, Competition Bureau |
| "Find provincial lobbying in..." | `search_provincial_lobbying` | All 13 provinces/territories registry records |
| "Search election advertising by..." | `search_elections` | Third-party advertiser spending |
