# CivInt Canada — MVP Scope

> **Version:** v1
> **Status:** Draft
> **Owner:** j_kro
> **Target launch:** Q3 2026

---

## What's IN the MVP

### 1. Multi-Tenant API Gateway (Cloudflare Workers)

The public face of CivInt. Handles auth, rate limiting, usage tracking, and proxies requests to the data pipeline.

- [ ] API key authentication (Bearer token via Workers)
- [ ] Tenant isolation via JWT claims + row-level security in D1
- [ ] Rate limiting per tier (free: 1k/day, pro: 50k/day, business: 250k/day)
- [ ] Usage tracking (per-tenant request counters stored in D1)
- [ ] Consistent response envelope with citations, timestamps, and quality metadata

### 2. REST API Endpoints

Exposes the pipeline-core's data through a clean REST surface.

| Endpoint | Method | Description | Pipeline-core module |
|----------|--------|-------------|---------------------|
| `GET /v1/health` | GET | Health check | — |
| `GET /v1/gov/releases` | GET | Government data releases (StatCan/CKAN) | ingestion/gov-api |
| `GET /v1/gov/search` | GET | Search across all gov data sources | ingestion/gov-api |
| `GET /v1/citation/:id` | GET | SHA-256 citation verification | verification |
| `GET /v1/usage` | GET | View current usage and quota | — |
| `POST /v1/audit/query` | POST | Query audit log (Business tier+) | audit |

### 3. Hosted MCP Server (K8s cluster)

An MCP (Model Context Protocol) server deployed on the K8s cluster, exposing CivInt data as tools for AI agents.

- [ ] MCP stdio transport (for sidecar usage) + SSE transport (for hosted usage)
- [ ] MCP tools:
  - `query_gov_data` — Query government data by keyword/jurisdiction
  - `fact_check` — Check a claim against official government data
  - `get_citation` — Retrieve and verify citation hash
  - `latest_releases` — Latest government data releases
- [ ] MCP auth via API key (for hosted mode)
- [ ] Deployed as K8s Deployment on nexus with Caddy .lan route

### 4. Developer Portal (GitHub Pages)

A lightweight static site for developers to manage their account.

- [ ] Astro/React site deployed to GitHub Pages
- [ ] API key generation and management
- [ ] Usage dashboard (requests/day, remaining quota)
- [ ] Interactive API explorer (OpenAPI / Swagger UI)
- [ ] Quickstart guide and documentation
- [ ] Tier comparison and upgrade flow

### 5. BuildCanada Integration

Fork/enhance the CanadaSpends visualization as a CivInt data product.

- [ ] Contract/spending data via CivInt API
- [ ] Searchable, filterable spending records
- [ ] Cross-referenced with AI curation scores

### 6. Billing (Freemium)

Usage-based billing with Stripe or Paddle.

- [ ] Free tier (1,000 calls/month, no credit card)
- [ ] Pro tier ($49/mo, 50k calls) — Stripe subscription
- [ ] Business tier ($199/mo, 250k calls) — Stripe subscription
- [ ] Usage enforcement (block or warn when over limit)
- [ ] Billing portal (manage subscription, view invoices)

### 7. Frostbite Gazette Internal Integration

- [ ] FG gets an internal API key with Business-tier privileges
- [ ] Journalism mode (editorial override flag in requests)
- [ ] Migrate FG Worker's internal calls to CivInt API (dogfooding)

---

## What's NOT in the MVP (Phase 3+)

| Feature | Reason | Target |
|---------|--------|--------|
| Python SDK | Nice-to-have, TS first | Phase 3 |
| Real-time alerts / webhooks | Complex, not needed for MVP | Phase 3 |
| White-label self-hosted | Enterprise-only feature | Phase 4 |
| Katzilla bridge (US cross-border) | Requires integration work | Phase 4 |
| Mobile app | Not a developer tool | Phase 4 |
| Natural language "Ask" endpoint | Requires NL query engine | Phase 3 |
| Federal/provincial API compliance packages | Enterprise feature | Phase 4 |

---

## Prerequisites

### Infrastructure
- [ ] Cloudflare Workers account (free tier, existing)
- [ ] D1 database for usage tracking and tenant data (existing)
- [ ] KV namespace for caching (existing)
- [ ] K8s namespace for MCP server (nexus, existing)
- [ ] GitHub Pages for dev portal (free tier)
- [ ] Custom domain (civint.ca) — needs DNS + Cloudflare

### Code
- [ ] `@civint/pipeline-core` built and published (done, can stay as local dep for now)
- [ ] New `api-server` package in civint monorepo
- [ ] New `mcp-server` package wrapping pipeline-core
- [ ] New `portal` package (Astro/React static site)
- [ ] OpenAPI spec for API

### Business
- [ ] Stripe or Paddle account for billing
- [ ] Terms of Service + Privacy Policy
- [ ] civint.ca domain registration
- [ ] OGL-C attribution compliance (footer: "Contains information licensed under the Open Government Licence – Canada")
