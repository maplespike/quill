---
last-reviewed: 2026-09-29
status: active
---

# Quickstart

A short walkthrough to get data from MapleSpike using curl and MCP.

## 1. Check the Service is Running

```bash
curl http://localhost:8082/v1/health
```

Expect a successful response with service status and usage information.

## 2. Search Supported Records

The search route may return results from the sources configured for your deployment. Coverage and fields vary.

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:8082/v1/gov/search?q=foreign+interference&limit=3"
```

## 3. Search for Lobbying Records

Results depend on available modules and source records. Check citations against the original source.

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:8082/v1/gov/search?q=McKinsey&limit=5"
```

## 4. Verify a Claim Hash

Some claim records include a SHA-256 hash of Quill's canonical record value. A match checks that representation only; it does not authenticate the source or establish reuse rights. Acquisition and publisher-terms evidence may be included when recorded.

```bash
curl "http://localhost:8082/v1/claims/verify/<sha256>"
```

## 5. Check Your Usage

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:8082/v1/usage"
```

## 6. Ask a Natural Language Question

AI answers may summarize available records. Review source citations and verify important facts with the original publisher.

```bash
curl -X POST http://localhost:8082/v1/ai_ask \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the latest immigration numbers for 2024?"}'
```

## Using MCP Tools with an AI Agent

When the MCP server is configured, ask your agent to search supported sources, inspect available citation evidence, and check source terms with the original publisher before reuse.
