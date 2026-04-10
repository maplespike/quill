# CivicIntel — Features

## Implementation Status Legend

- ✅ **Complete** — Fully implemented, tested, production-ready
- ⚠️ **Prototype** — UI shell exists, needs backend integration
- 📋 **Planned** — Spec defined, not yet implemented

---

## CORE DATA LAYER

### Feature 1: Monorepo Foundation ✅
**Status:** Complete

pnpm monorepo with all packages (core, pretext-civic, web), TypeScript configs, Turborepo, and working build pipeline.

- Base tsconfig with project references
- Package.json for each workspace
- Next.js app skeleton with App Router
- Devenv configuration for Nix development environment

---

### Feature 2: Entity Types & Schemas ✅
**Status:** Complete

TypeScript types and Zod schemas for the core data model:

- `Person`, `Organization`, `Role`, `Relationship`
- `Contract`, `Tender`
- `LobbyingFiling`
- `Donation`, `Disclosure`
- `GACProject`
- `IntelligenceThread`, `Edge`, `SignalType`
- Drizzle SQLite schema definitions (13 tables)

---

### Feature 3: Entity Resolution Engine ✅
**Status:** Complete

Entity resolution matching same person/org across data silos:

- Name normalization with fuzzy matching (Fuse.js)
- Organization alias resolution (subsidiary→parent)
- Pre-seeded alias tables for Canadian government entities
- Confidence scoring
- Resolution cache in SQLite

**Tests:** 23 tests covering resolution, aliases, fuzzy matching

---

### Feature 4: Spending Parser (CanadaBuys + PSPC) ✅
**Status:** Complete

ETL parser for federal spending data:

- CanadaBuys proactive disclosures (CSV)
- PSPC tender notices
- Normalizes into Contract schema
- SQLite storage via Drizzle
- Sweep cycle support (incremental updates)

**Tests:** 19 tests

---

### Feature 5: Lobbying Parser (Commissioner of Lobbying) ✅
**Status:** Complete

ETL parser for lobbying data:

- Registration data
- Monthly communication reports
- Links lobbyists to organizations and targets
- SQLite storage

**Tests:** 20 tests

---

### Feature 6: GAC International Parser ✅
**Status:** Complete

ETL parser for Global Affairs Canada:

- GAC Project Browser data
- IATI format support
- Captures implementing partners, flow amounts, recipient countries

**Tests:** 22 tests

---

### Feature 7: CIEC + Elections Canada Parser ✅
**Status:** Complete

ETL parser for ethics and donation data:

- Conflict of Interest and Ethics Commissioner summaries
- Spousal/dependent interests
- Elections Canada political contributions

**Tests:** 23 tests

---

### Feature 8: Graph Builder & Signal Detectors ✅
**Status:** Complete

Connection graph from resolved entities:

- 7 signal detectors implemented
- Each signal produces IntelligenceThread with confidence scores
- Source citations embedded

| Signal                           | Implementation |
| -------------------------------- | -------------- |
| procurement_lobbying_overlap     | ✅             |
| revolving_door                   | ✅             |
| spousal_interest_proximity       | ✅             |
| sole_source_heavy_lobbying       | ✅             |
| donation_proximity_correlation   | ✅             |
| mandate_divergence               | ✅             |
| international_layering           | ✅             |

**Tests:** 17 tests

---

### Feature 9: Brief Generator ✅
**Status:** Complete

Structured daily intelligence briefs:

- 6-section format: What Changed, Active Signals, Connection Highlights, Mandate Watch, etc.
- JSON output for web app consumption
- Confidence scoring

**Tests:** 5 tests

---

### Feature 10: Sweep Engine ✅
**Status:** Complete

Data refresh orchestration:

- Configurable schedules (15min/daily/weekly)
- Sweep deltas (what changed)
- Graph rebuild triggers
- Event emission for live dashboard

---

## COMPONENT LIBRARY

### Feature 11: Pretext-Civic Components ✅
**Status:** Complete

React component library wrapping @chenglou/pretext:

| Component         | Description                              |
| ----------------- | ---------------------------------------- |
| BriefLayout       | Magazine-style editorial reflow          |
| IntelChip         | Inline expandable semantic chips         |
| FlowingSankey     | Spending flow with pretext-laid labels   |
| AnimatedMetric    | Number transitions                       |
| FlowText          | Pretext text layout wrapper              |
| AdaptiveHeadline  | Responsive headline with size adaptation |
| MultiColumnFlow   | Multi-column pretext layout              |
| PretextTooltip    | Tooltip that follows pretext layout      |
| RichInlineText    | Rich text with entity linking            |

**Hooks:** usePretextLayout, usePretext, usePretextFlow, usePretextLines, useChartTheme, useAnimatedCounter

---

### Feature 11b: Civic Charts ✅
**Status:** Complete

10 interactive chart components (ECharts + D3):

| Chart              | Description                                              |
| ------------------ | -------------------------------------------------------- |
| SankeyFlow         | Money-flow diagrams with tooltips                        |
| SpendingTreemap    | Zoomable budget breakdown                                |
| LobbyHeatmap       | Calendar heatmap of lobbying activity                    |
| TimelineTracker    | Mandate promises vs actual spending                      |
| NetworkRadial      | Person-centered connection graph                         |
| SpendingAreaChart  | Stacked area chart with anomaly markers                  |
| ComparisonBar      | Side-by-side comparisons                                 |
| GaugeSignal        | Signal severity gauge                                    |
| GeoCanada          | Choropleth map of Canada                                 |
| RingOfConnections  | Entity connection breakdown donut                        |

---

## WEB APP

### Feature 12: Monitor Dashboard ✅
**Status:** Complete

Live ops center with:

- Top bar: LIVE pulse, sweep countdown, data freshness, theme switcher
- Tab strip: Spending / Lobbying / Contracts / Promises / International / Disclosures
- Left panel: Anomaly feed with severity badges
- Center panel: Chart grid (gauge, area chart, heatmap, treemap)
- Right panel: Signal summary, entity watchlist, quick-search
- Bottom bar: News ticker

---

### Feature 13: Brief View ✅
**Status:** Complete

Magazine-style scrollytelling:

- Scroll-driven narrative
- Text flows around embedded charts
- Inline IntelChips with entity details
- Animated counters, staggered reveals

---

### Feature 14: Explorer View ✅
**Status:** Complete

Deep-dive exploration:

- Connection graph (SVG-based, interactive)
- Entity profile pages with full thread history
- Chart deep dives (treemap, sankey, radial)
- Search/filter by entity type, department, signal type

---

### Feature 15: Signals View ✅
**Status:** Complete

Personal alert feed:

- Filterable by signal type, severity, department
- Signal cards with source links
- Expandable details

---

### Feature 16: App Shell ✅
**Status:** Complete

Next.js 16 app shell:

- Top-level navigation (7 tabs)
- Dark theme system
- Responsive layout
- Static export for deployment

---

### Feature 17: Seed Data & Demo ✅
**Status:** Complete

Realistic Canadian government data producing verified connection threads.

---

## ADDITIONAL VIEWS

### Sources View ✅
**Status:** Complete

Data source coverage dashboard showing:
- Real Canadian government data links
- Coverage statistics per source
- Data freshness indicators

---

### Timeline View ✅
**Status:** Complete

Entity timeline showing events across:
- Contracts awarded
- Lobbying filings
- Donations made
- Disclosures filed

---

## SOCIAL LAYER — Prototype Status

The following features have **type definitions and UI shells** but are **not production-ready**. They require backend infrastructure (database tables, API routes, authentication).

### Feature 18: Connection Verification ⚠️
**Status:** Prototype

Types defined (`Verification`, `VerificationType`). UI shell in SocialView. Needs:
- Database table for verifications
- API routes for CRUD
- Confidence score aggregation logic

---

### Feature 19: Collaborative Investigations ⚠️
**Status:** Prototype

Types defined (`Investigation`, `Evidence`). UI shell exists. Needs:
- Investigation storage
- Real-time collaboration infrastructure
- Evidence board UI component

---

### Feature 20: Citizen Annotations ⚠️
**Status:** Prototype

Types defined (`Annotation`). UI shell exists. Needs:
- Annotation storage with threading
- Voting mechanism
- Moderation system

---

### Feature 21: Shareable Briefs ⚠️
**Status:** Prototype

Types defined (`ShareableBrief`). Needs:
- PDF/image export
- URL shortening
- Social media card generation

---

### Feature 22: Riding Networks ⚠️
**Status:** Prototype

Types defined (`RidingNetwork`). Needs:
- Riding boundary data
- MP profile aggregation
- Local data filtering

---

### Feature 23: Expertise & Reputation ⚠️
**Status:** Prototype

Types defined (`CitizenProfile`, `Badge`, `TrustLevel`). Leaderboard UI exists with seed data. Needs:
- Actual reputation calculation
- Badge awarding logic
- Trust level progression

---

### Feature 24: Live Analysis Sessions ⚠️
**Status:** Prototype

Types defined (`AnalysisSession`). Needs:
- WebSocket/SSE infrastructure
- Session scheduling
- Real-time collaboration
- Recording/playback system

---

## Summary

| Category        | Complete | Prototype | Planned |
| --------------- | -------- | --------- | ------- |
| Core Data Layer | 10       | 0         | 0       |
| Component Lib   | 2        | 0         | 0       |
| Web Views       | 7        | 0         | 0       |
| Social Layer    | 0        | 7         | 0       |
| **Total**       | **19**   | **7**     | **0**   |

**Production-ready:** Core data layer, all views, chart library
**Prototype only:** Social features (18-24)
