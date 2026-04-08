# CivicIntel — Features

## Feature 1: Monorepo Foundation
- Description: Set up the pnpm monorepo with all packages (core, pretext-civic, web), TypeScript configs, shared tooling (biome, turbo), and verify `pnpm install` + `pnpm build` works end-to-end. Includes base tsconfig, package.json for each workspace, and an empty Next.js app skeleton.
- Dependencies: none
- Status: done

## Feature 2: Core Data Layer — Entity Types & Schemas
- Description: Define all TypeScript types and Zod schemas for the core data model: Person, Organization, Role, Relationship, Contract, LobbyingFiling, Donation, Disclosure, GACProject, IntelligenceThread, Edge, SignalType. This is the shared vocabulary every other package imports. Also includes the Drizzle SQLite schema definitions for persistence.
- Dependencies: Feature 1
- Status: done

## Feature 3: Core Data Layer — Entity Resolution Engine
- Description: Build the entity resolution system that matches the same person/org across different government data silos. Includes: name normalization (fuzzy matching, alias tables), organization alias resolution (subsidiary→parent), confidence scoring, and a resolution cache in SQLite. This is the anti-compartmentalization engine.
- Dependencies: Feature 2
- Status: done

## Feature 4: Core Data Layer — Spending Parser (CanadaBuys + PSPC)
- Description: TypeScript ETL parser for federal spending data. Pulls from CanadaBuys proactive disclosures (CSV/XML) and PSPC tender notices. Normalizes into the Contract schema from Feature 2. Stores in SQLite via Drizzle. Includes sweep cycle support (incremental updates).
- Dependencies: Feature 2
- Status: done

## Feature 5: Core Data Layer — Lobbying Parser (Commissioner of Lobbying)
- Description: TypeScript ETL parser for lobbying data. Pulls registration data and monthly communication reports from the Office of the Commissioner of Lobbying (CSV format). Normalizes into LobbyingFiling schema. Links lobbyists to organizations and target institutions/individuals. Stores in SQLite.
- Dependencies: Feature 2
- Status: done

## Feature 6: Core Data Layer — GAC International Parser
- Description: TypeScript ETL parser for Global Affairs Canada international assistance data. Pulls from GAC Project Browser and IATI data. Normalizes into GACProject schema, capturing implementing partners (NGOs, UN agencies, corporate partners), flow amounts, and recipient countries.
- Dependencies: Feature 2
- Status: done

## Feature 7: Core Data Layer — CIEC + Elections Canada Parser
- Description: TypeScript ETL parser for (1) Conflict of Interest and Ethics Commissioner public summaries — including spousal/dependent interests, and (2) Elections Canada political contribution data. Normalizes into Disclosure and Donation schemas. Links disclosed interests to organizations.
- Dependencies: Feature 2
- Status: done

## Feature 8: Core Data Layer — Graph Builder & Signal Detectors
- Description: Build the connection graph from resolved entities and their relationships. Implements the signal detectors: procurement-lobbying overlap, revolving door detection, spousal interest proximity, sole-source + heavy lobbying, donation-proximity correlation, mandate divergence, and international layering. Each signal produces an IntelligenceThread with confidence scores and source citations.
- Dependencies: Feature 3, Feature 4, Feature 5, Feature 6, Feature 7
- Status: done

## Feature 9: Core Data Layer — Brief Generator
- Description: Generates structured daily intelligence briefs from detected signals. Assembles threads into a narrative with sections: What Changed, Active Signals, Connection Highlights, Mandate Watch. Outputs as JSON that the web app consumes for the Brief view.
- Dependencies: Feature 8
- Status: done

## Feature 10: Core Data Layer — Sweep Engine
- Description: Orchestrates the full data refresh cycle. Runs all parsers on configurable schedules (15min for spending/lobbying, daily for GAC/CIEC, weekly for provincial). Computes sweep deltas (what changed since last run). Triggers graph rebuild and signal detection. Emits events for the web app's live dashboard. This is the heartbeat.
- Dependencies: Feature 4, Feature 5, Feature 6, Feature 7, Feature 8, Feature 9
- Status: done

## Feature 11: Pretext-Civic Component Library
- Description: Build the React component library wrapping @chenglou/pretext for civic data storytelling. Components: BriefLayout (magazine-style editorial reflow), IntelChip (inline expandable semantic chips), FlowingSankey (spending flow with pretext-laid labels), ConnectionGraph (interactive network viz), PromiseTimeline (rhetoric vs reality with reflow), AnimatedMetric (number transitions). Includes hooks: usePretextLayout, useBrief, useConnections. Published as @civic-intel/pretext-civic.
- Dependencies: Feature 1, Feature 2
- Status: done

## Feature 11b: Civic Charts — Interactive Visualization Library
- Description: Build a chart component library using Apache ECharts (rich WebGL-accelerated charts) + D3.js (custom Sankey/flow diagrams) for stunning interactive data visualization. Every chart is animated, responsive, dark-theme native, and wraps cleanly as React components. Chart types: (1) SankeyFlow — animated money-flow diagrams (Treasury → departments → vendors) with hover tooltips showing amounts, percentages, and source links; (2) SpendingTreemap — zoomable treemap of budget breakdown by department/program/category with drill-down; (3) LobbyHeatmap — calendar heatmap of lobbying activity intensity by department, with click-to-filter; (4) TimelineTracker — animated timeline showing mandate promises vs actual spending/events over time, with gap highlighting; (5) NetworkRadial — radial connection graph for person-centered views (spouse, orgs, contracts, lobbying all radiating from a person); (6) SpendingAreaChart — stacked area chart of department spending over time with anomaly markers; (7) ComparisonBar — animated horizontal/vertical bars for side-by-side comparisons (promised vs actual, year-over-year, department vs department); (8) GaugeSignal — animated radial gauge for signal severity (procurement-lobbying overlap risk, revolving door index); (9) GeoCanada — map of Canada with choropleth layers for per-province/riding spending, lobbying density, contract concentration; (10) RingOfConnections — interactive donut showing entity's connection breakdown by type (contract, lobbying, donation, disclosure). All charts share a common theme config, tooltip system, and animation presets. Export chart as PNG/SVG. Published as part of @civic-intel/pretext-civic.
- Dependencies: Feature 1, Feature 2
- Status: done

## Feature 12: Web App — Monitor Dashboard (Ops Center)
- Description: Build the live monitoring dashboard tab — the citizen's operations center. Dark theme (5 variants: Nightwatch brass, Phosphor CRT, Arctic blue, Parchment cream, Solarized), IBM Plex Mono for data + serif for narrative. Layout: (1) Top bar — LIVE pulse indicator, sweep countdown timer, data freshness timestamp, theme switcher; (2) Tab strip — Spending / Lobbying / Contracts / Promises / International / Disclosures, each with new-item count badges; (3) Left panel — live anomaly feed (streaming event cards with severity badges, click to expand into Brief view); (4) Center panel — grid of Civic Charts: sweep delta sparklines, signal detection GaugeSignals, top-department SpendingAreaChart, LobbyHeatmap, spending Treemap with drill-down; (5) Right panel — active signal severity summary, entity watchlist with change indicators, quick-search; (6) Bottom bar — news ticker merging Hansard, lobbying filings, CanadaBuys, CIEC updates in a scrolling marquee. Auto-refreshes via SSE (Server-Sent Events). Charts are interactive — click any chart element to drill into Explorer or open Brief view. Responsive grid collapses to single-column on mobile. Feels like WorldMonitor meets Bloomberg Terminal meets ThreatWatch — but for Canadian government intelligence.
- Dependencies: Feature 10, Feature 11, Feature 11b
- Status: pending

## Feature 13: Web App — Brief View (Scrollytelling)
- Description: Build the editorial intelligence brief view. Uses pretext-civic components for magazine-style layout with scroll-driven narrative. Text flows around embedded Sankey diagrams and connection graphs. Inline IntelChips expand on hover to show entity details. Animated counters, staggered reveals, gesture interactions. CSS scroll-driven animations (animation-timeline: scroll()) for zero-JS scroll triggers. This is the reading experience.
- Dependencies: Feature 9, Feature 11
- Status: pending

## Feature 14: Web App — Explorer (Connection Graph + Chart Deep Dives)
- Description: Build the deep-dive exploration view with two modes. (A) Graph Mode: WebGL connection graph (Three.js + three-forcegraph) for interactive entity exploration. Click a node to expand connections, rest dims. Time slider to animate graph evolution. Pretext-laid text flows around expanded nodes. Glassmorphic detail panels. (B) Chart Mode: full-screen interactive charts for deep analysis — zoomable SpendingTreemap filtering by department → program → vendor, SankeyFlow with adjustable time ranges showing money movement, NetworkRadial centered on any person/org showing all connection types radiating outward, GeoCanada map with per-riding spending/lobbying overlays, ComparisonBar races (animated bar chart showing department spending ranking over time). Both modes share search/filter by entity type, department, signal type, time range. Entity profile pages with full thread history + all charts for that entity. Pretext editorial summary at the top of each profile page.
- Dependencies: Feature 8, Feature 11, Feature 11b
- Status: pending

## Feature 15: Web App — Signals (Personal Alert Feed)
- Description: Build the personal signals/alerts tab. Citizens configure what they care about (riding, issues, MP, departments). Push notifications for matching signals (PWA + Web Push API). Alert history with signal type badges. One-tap "Reality Gap" reports (promise vs spending comparison). Exportable briefs (PDF/JSON).
- Dependencies: Feature 10, Feature 12
- Status: pending

## Feature 16: Web App — App Shell & Navigation
- Description: The Next.js 16 app shell with App Router. Top-level navigation between BRIEF, MONITOR, EXPLORE, SIGNALS tabs. Streaming SSR with Suspense boundaries for progressive loading. Dark theme system with 5 theme variants (Nightwatch, Phosphor CRT, Arctic, Parchment, Solarized). Responsive layout. PWA manifest + service worker for installability. Global search. System tray notification support via PWA.
- Dependencies: Feature 11
- Status: pending

## Feature 17: Integration — Seed Data & End-to-End Demo
- Description: Create a seed data script that generates realistic Canadian government data (mock but structurally accurate) for all parsers. Wire the full pipeline: seed data → parsers → entity resolution → graph → signals → briefs → web app display. The demo should show at least 3 "holy shit" connection threads when you open the app. Verify all 4 tabs work with real (seeded) data flowing through the entire system.
- Dependencies: Feature 10, Feature 12, Feature 13, Feature 14, Feature 15, Feature 16
- Status: done

## SOCIAL LAYER — Collective Intelligence Features

## Feature 18: Social — Connection Verification System
- Description: Citizens verify or challenge detected intelligence threads. Any signal thread (e.g. procurement-lobbying overlap) can be: (1) Verified — citizen provides a primary source link confirming the connection, thread confidence increases; (2) Challenged — citizen provides evidence contradicting the connection, thread confidence decreases; (3) Extended — citizen adds a missing entity or edge to the thread with source. Verifications are attributed, timestamped, and reversible. Thread confidence becomes a blend of algorithmic score + community verification weight. Includes verification feed showing recent community activity, and a leaderboard of top verifiers. Types: Verification, Challenge, Extension — each with required fields (source URL, description, confidence vote). Stored in SQLite with full audit trail.
- Dependencies: Feature 2, Feature 8
- Status: pending

## Feature 19: Social — Collaborative Investigations
- Description: Citizens can open structured investigations around a thread or entity. Each investigation is a shared workspace with: (1) Timeline — chronological evidence entries with dates and sources; (2) Evidence Board — linked primary sources with entity tags, like a Trello board for government connections; (3) Thread Map — the connection subgraph relevant to this investigation; (4) Findings — collaboratively-edited summary (like a Google Doc). Investigations can be public (anyone can contribute) or invited (trusted group). Contributors get attribution. Completed investigations produce a Community Brief that surfaces in everyone's feed. Searchable, taggable by topic/department/entity. Like GitHub Issues meets investigative journalism.
- Dependencies: Feature 2, Feature 8, Feature 18
- Status: pending

## Feature 20: Social — Citizen Annotations
- Description: Any entity, contract, connection, or signal can have community annotations. Annotations are: sourced (must link to a primary government source or reputable publication), attributed (citizen name/handle), votable (upvote/downvote for quality), and threaded (replies to annotations). Examples: "This sole-source contract was the subject of an Auditor General report (link)", "This lobbying firm also represents these 3 other vendors bidding on the same tender (links)". Annotations surface inline on entity pages, in the Explorer view, and in Briefs. Rich-text with entity linking (mention @L3Harris to auto-link to that entity). Moderation via community voting — low-quality annotations sink, high-quality ones rise.
- Dependencies: Feature 2, Feature 8
- Status: pending

## Feature 21: Social — Shareable Reality Briefs
- Description: One-tap generation of a beautiful, shareable intelligence brief. Uses pretext to render a magazine-quality editorial page with: all connections visualized (Sankey + graph), every claim hyperlinked to primary source, citizen annotations integrated, investigation findings if applicable. Export as: (1) a unique public URL (hosted by the app), (2) a high-quality PDF, (3) a social media card image (OpenGraph optimized for Twitter/X/LinkedIn/Bluesky), (4) an embeddable iframe widget (like embedding a tweet). The sharing flow is: citizen finds a thread → clicks "Share Brief" → selects which sections to include → adds their commentary → generates and shares. Track share counts and referral traffic. This makes civic intelligence viral — sharing a beautiful, sourced brief is way more impactful than sharing a table screenshot.
- Dependencies: Feature 9, Feature 11, Feature 11b
- Status: pending

## Feature 22: Social — Riding & Community Networks
- Description: Citizens join based on their electoral riding or community. Each riding page shows: (1) Local spending — federal contracts and grants in this riding, mapped geographically; (2) Local lobbying — lobbying activity targeting this riding's MP or affecting local issues; (3) Local signals — connections between local organizations, contractors, and representatives; (4) Community feed — annotations and investigations from other citizens in this riding; (5) MP profile — voting record, committee assignments, disclosed interests, mandate progress, all auto-assembled from existing data. Riding networks create a local accountability loop — citizens see what's happening in THEIR community specifically. Department of Defence spending in Halifax. GAC projects affecting Winnipeg. First Nations financial statements for your community. Makes federal data feel personal.
- Dependencies: Feature 8, Feature 18, Feature 20
- Status: pending

## Feature 23: Social — Expertise & Reputation
- Description: Citizens build verifiable credibility over time through contributions. Expertise signals: (1) Verification Score — points for each verified contribution (source-backed annotations, confirmed verifications, completed investigations); (2) Domain Tags — earned through repeated quality contributions in specific areas ("Defence Procurement", "International Development", "Lobbying Analysis", "First Nations Finance"); (3) Trust Level — progressive levels (Newcomer → Contributor → Analyst → Expert) unlocking abilities (e.g. Experts can create invited investigations, moderate annotations); (4) Badge System — achievement badges for milestones ("First Verification", "10 Sources Linked", "Investigation Lead", "Cross-Referencer"). Not a popularity contest — it's verifiable contribution quality. Expert contributors' annotations and investigations surface higher in feeds. Visible on profile alongside contribution history. Like Stack Overflow reputation but for civic intelligence.
- Dependencies: Feature 18, Feature 19, Feature 20
- Status: pending

## Feature 24: Social — Live Analysis Sessions (Watch Parties)
- Description: When major government events happen (budget release, Auditor General report, committee hearing, throne speech), citizens can join a live analysis session. Features: (1) Real-time data streaming — new data from parsers appears instantly as it's ingested; (2) Live signal feed — signals fire in real-time as connections are detected in new data; (3) Collaborative annotation — participants highlight and annotate as the event unfolds; (4) Live chat — discussion alongside the data stream; (5) Session brief — at session end, all annotations and signals are compiled into a collaborative Community Brief. Schedule upcoming sessions (e.g. "Budget 2026 Analysis — April 15, 4pm ET"). Replay past sessions. Think of it as Twitch for government accountability — makes the dry process of oversight feel like a live event citizens participate in together.
- Dependencies: Feature 10, Feature 18, Feature 20, Feature 19
- Status: pending
