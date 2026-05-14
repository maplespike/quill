# MapleSpike Portal — 2026 Design Modernization Plan

> **Created:** 2026-05-13
> **Status:** Planned — not started
> **Inspiration:** Anti-grid brutalism, neo-brutalist web design, AI readability layer (llms.txt/agents.json), interactive code demos

---

## Overview

Four parallel workstreams to modernize the MapleSpike portal based on 2026 startup design trends:

1. **Anti-grid brutalism** — replace card grids with raw, honest, code-first layouts
2. **AI readability layer** — llms.txt, agents.json, structured data for AI agent discovery
3. **Interactive code demos** — SDK tabstrip in hero + live API response display
4. **Data Explorer depth** — 20+ categories with action counts

---

## Task 1: Anti-Grid Brutalism — Landing Page Features Section

**Current state:** 6 bento-style feature cards in a 3x2 grid (committees, corporate, influence, gazette, gic, oversight). Each card has an icon (emoji), title, and description. This is the "generic SaaS template" pattern.

**Target state:** Replace the bento grid with a single full-width code demo section showing a live API call with real response data. Like Resend's code editor or Linear's product screenshot.

**Files to modify:**
- `packages/portal/index.html` — remove or replace the `.bento-grid` section (lines ~320-398)
- `packages/portal/styles.css` — remove `.bento-card`, `.span-2`, `.span-3`, `.highlight` classes

**Design:**
```
[02 / PIPELINE]
─────────────────────────────────────
$ curl https://api.maplespike.ca/v1/gov/releases \
  -H "X-API-Key: ms_..." \
  -G -d "source=committees" \
  -d "_limit=3" \
  -d "_format=compact"

{
  "success": true,
  "data": [
    { "source": "ourcommons.ca", "committee": "HUMA",
      "title": "Housing Committee Meeting #45",
      "date": "2026-05-13" },
    { "source": "lobbycanada.gc.ca", "registrant": "RBC",
      "subject": "National Housing Strategy" },
    { "source": "fja-cmf.gc.ca", "court": "FCA",
      "title": "Canada v. Smith" }
  ],
  "citation": {
    "source_name": "open.canada.ca",
    "data_hash": "sha256:e3b0...",
    "license": "OGL-C"
  }
}

// Try it yourself — pick a source:
[committees] [lobbying] [procurement] [gazette] [courts]
// Each button updates the API call and response inline
```

**Behavior:**
- Default shows a sample API response
- Category buttons below swap the query source param
- Animated: response content fades between selections
- No card grid anywhere on the page
- The code block IS the feature illustration

**CSS additions needed:**
```css
/* Raw terminal-style code feature */
.api-demo-section { ... }
.api-demo-response { background: var(--base00); border: 2px solid var(--base04); font-family: var(--font-mono); padding: 24px; }
.api-demo-tabs { display: flex; gap: 4px; }
.api-demo-tab { font-family: var(--font-mono); font-size: 0.75rem; padding: 6px 14px; border: 1px solid var(--base04); cursor: pointer; }
.api-demo-tab.active { background: var(--accent); color: white; border-color: var(--accent); }
```

**Removal:**
- Delete `.bento-grid`, `.bento-card`, `.span-2`, `.span-3`, `.card-icon`, `.card-content` classes from CSS (or keep for backward compat if other pages use them)

**Effort:** 2-3 hours

---

## Task 2: Anti-Grid Brutalism — Dashboard Activity Feed

**Current state:** Alert cards in a responsive grid + entity cards in a grid. Each card has rounded corners, icon, title, description, and tags.

**Target state:** Chronological activity feed. Raw, linear, no cards. Like a terminal log or git log.

**Files to modify:**
- `packages/portal/dashboard.html` — replace `.alert-grid` with a `.activity-feed`
- `packages/portal/styles.css` — remove card-specific styles

**Design:**
```
[01 / ACTIVITY FEED]
─────────────────────────────────
  13:42  🔴  Lobbying spike detected
          RBC lobbyists contacted 12 MPs on housing
          in the last 72 hours — 3× normal rate.
          └─ source: lobbycanada.gc.ca · hash: sha256:a1f...

  13:15  🟡  Committee goes in-camera
          PACP meeting #47 — international student
          program reforms discussed in closed session.
          └─ source: ourcommons.ca · hash: sha256:b2c...

  12:48  🟢  New contract awarded
          $2.4M sole-source contract to McKinsey
          for "strategic transformation" — Innovation
          Canada.
          └─ source: buyandsell.gc.ca · hash: sha256:c3d...
```

**CSS additions:**
```css
.activity-feed { ... }
.feed-item { border-left: 2px solid var(--base04); padding: 16px 20px; font-family: var(--font-mono); font-size: 0.82rem; }
.feed-item:hover { border-left-color: var(--accent); background: var(--base01); }
.feed-time { color: var(--text-muted); }
.feed-source { color: var(--text-muted); font-size: 0.72rem; }
```

**Effort:** 1-2 hours

---

## Task 3: AI Readability Layer

**Current state:** No structured data for AI agents. No llms.txt, agents.json, or schema markup on any page.

**Target state:** Every page has JSON-LD schema markup. llms.txt describes the API. agents.json declares MCP tools. The site is quotable by ChatGPT, Claude, Gemini, Perplexity, and Bing Copilot.

**Files to create:**
- `packages/portal/llms.txt` — LLM-readable summary of the API
- `packages/portal/agents.json` — MCP tool declarations for AI agents
- `packages/portal/agent-card.json` — WXT-style agent card

**Files to modify:**
- All HTML pages — add JSON-LD structured data in `<head>`
- All HTML pages — add OpenGraph + Twitter Card meta (already done on some pages)

### llms.txt format
```
# MapleSpike — Canadian Government Data API
> Primary-source infrastructure for AI agents that cite.

## Docs
- Docs: https://maplespike.ca/docs
- API Reference: https://maplespike.ca/docs#api-reference
- Workspace: https://maplespike.ca/workspace
- Pricing: https://maplespike.ca/pricing

## API
Base URL: https://api.maplespike.ca/v1
Auth: X-API-Key header
Response format: { success, data, quality, citation, meta }

### Endpoints
- GET /v1/gov/releases — Latest government data releases
- GET /v1/gov/search?query= — Full-text search across all sources
- GET /v1/citation/:hash — Retrieve citation by SHA-256 hash
- GET /v1/usage — Current billing period usage

### Categories
- committees — House of Commons and Senate committee evidence
- lobbying — Federal lobbying registry communications
- procurement — CanadaBuys contract awards and tenders
- gazette — Canada Gazette Parts I, II, III
- elections — Third-party advertiser registry, election data

For the complete agent definition, see /agents.json
```

### agents.json format
```json
{
  "name": "MapleSpike",
  "description": "Canadian government data API with SHA-256 verified citations",
  "url": "https://maplespike.ca",
  "mcp_endpoints": ["https://api.maplespike.ca/mcp"],
  "tools": [
    {
      "name": "query_gov_data",
      "description": "Search across all Canadian government data sources",
      "parameters": { "query": "string", "source": "string", "limit": "number" }
    },
    {
      "name": "get_citation",
      "description": "Verify a data point by its SHA-256 citation hash",
      "parameters": { "hash": "string" }
    }
  ]
}
```

### JSON-LD schema (per page)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "MapleSpike",
  "url": "https://maplespike.ca",
  "description": "Canadian government data pipeline with verified citations",
  "applicationCategory": "Data API",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "CAD"
  }
}
</script>
```

**Effort:** 1-2 hours for all pages + files

---

## Task 4: SDK Tabstrip in Hero

**Current state:** Quickstart shows curl only. A single `curl-demo` block with a "Run" button for the curl example.

**Target state:** Tabbed interface with curl / SDK (TypeScript) / Python tabs. Like Resend's 13-language tabstrip or Vercel's AI SDK / Python / HTTP tabs.

**Files to modify:**
- `packages/portal/index.html` — hero quickstart section
- `packages/portal/styles.css` — tabbed content styles

**Design:**
```
// 30-SECOND QUICKSTART
─────────────────────────────────
[curl] [TypeScript SDK] [Python SDK]

$ curl https://api.maplespike.ca/v1/gov/releases \
  -H "X-API-Key: ms_..." \
  -G -d "source=committees" \
  -d "_limit=3" \
  -d "_format=compact"

{ "success": true, "data": [...], "citation": {...} }

        ▶ Run          // Response with verified citation
```

**Behavior:**
- Clicking a tab switches the code example
- Default tab: curl
- Second tab: `import { MapleSpike } from "@maplespike/sdk"`
- Third tab: `from maplespike import MapleSpike`
- The "Run" button only works on curl tab (or all three, with different JS handlers)
- Tabs use the same bracket-style as the nav

**Effort:** 1-2 hours

---

## Task 5: Data Explorer Depth

**Current state:** 5 category chip buttons (ALL, GOVERNMENT, CORPORATE, INFLUENCE, LEGAL). Each category shows a few basic cards with title, description, and stats.

**Target state:** 20+ category chip buttons, each showing cards with action count badges ("17 actions", "38 actions").

**Files to modify:**
- `packages/portal/explorer.html` — expand category chips and card data
- `packages/portal/styles.css` — action count badge styles

**Category expansion:**
```
ALL | PARLIAMENT | LOBBYING | PROCUREMENT | GAZETTE · GIC | ELECTIONS
COURTS · OVERSIGHT · PROVINCIAL · CORPORATE · INFLUENCE · TRADE
IMMIGRATION · DEFENCE · HEALTH · ENVIRONMENT · ENERGY · TRANSPORT
SCIENCE · EDUCATION · HOUSING · TELECOM · AGRICULTURE · META
```

**Card format:**
```
┌──────────────────────────────────────────────────────┐
│ PARLIAMENT                        14 actions +       │
│ Committees, Hansard, Senate — official parliamentary │
│ proceedings from ourcommons.ca + sencanada.ca        │
│                                                      │
│ search_transcripts · get_in_camera_meetings ·        │
│ track_speaker · search_senate · ...                  │
└──────────────────────────────────────────────────────┘
```

**Effort:** 2-3 hours

---

## Implementation Order

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | AI readability layer (llms.txt, agents.json, JSON-LD) | 1-2h | Very high — makes site quotable by AI |
| 2 | SDK tabstrip in hero | 1-2h | High — immediate landing page improvement |
| 3 | Anti-grid: replace bento cards with API code demo | 2-3h | High — removes template look |
| 4 | Anti-grid: dashboard activity feed | 1-2h | Medium — improves dashboard UX |
| 5 | Data Explorer depth | 2-3h | Medium — 20+ categories with action counts |

**Total:** ~8-12 hours of focused work.

Start with #1 (AI readability) because it's the most impactful for the least effort, then #2 (SDK tabstrip) for immediate visual change on the landing page, then tackle the card removal tasks.
