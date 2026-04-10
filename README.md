# CivicIntel — Systems Intelligence for Canadian Government

> Anti-compartmentalization engine: turns raw Canadian government data into citizen-facing systems intelligence.

## What It Does

CivicIntel traces money, influence, and connections across:

- **Federal spending** — CanadaBuys proactive disclosures, PSPC contracts
- **Lobbying** — Commissioner of Lobbying registrations & communication reports
- **Disclosures** — Conflict of Interest and Ethics Commissioner (including spousal interests)
- **Donations** — Elections Canada political contributions
- **International** — Global Affairs Canada project data
- **Signals** — 7 automated intelligence detectors

The platform connects these silos through **person-centered entity resolution** — the person is the connective tissue between organizations, not just org-to-org matching.

## Architecture

```
civic-intel/
├── packages/core/              # @civic-intel/core — Data layer
│   ├── src/types/              # TypeScript types (Person, Organization, Contract, etc.)
│   ├── src/schemas/            # Zod validation schemas
│   ├── src/entity/             # Entity resolution (Fuse.js + pre-seeded aliases)
│   ├── src/sources/            # Data parsers (spending, lobbying, GAC, CIEC)
│   ├── src/graph/              # Graph builder + 7 signal detectors
│   ├── src/briefs/             # Brief generator (6-section daily intelligence)
│   ├── src/sweep/              # Sweep engine (full + incremental)
│   └── src/seed/               # Seed data for demo
│
├── packages/pretext-civic/     # @civic-intel/pretext-civic — Components + Charts
│   ├── src/components/         # BriefLayout, IntelChip, AnimatedMetric, FlowText, etc.
│   ├── src/charts/             # 10 chart types (SankeyFlow, Treemap, Heatmap, etc.)
│   └── src/hooks/              # usePretextLayout, useChartTheme, useAnimatedCounter, etc.
│
└── packages/web/               # @civic-intel/web — Next.js App
    ├── app/                    # App shell + page
    ├── components/             # 7 views (Monitor, Brief, Explorer, Signals, Social, Sources, Timeline)
    └── lib/                    # Store (Zustand) + Pipeline
```

## Tech Stack

| Layer             | Technology                           |
| ----------------- | ------------------------------------ |
| Language          | TypeScript (strict)                  |
| Web Framework     | Next.js 16 (App Router, Turbopack)   |
| UI                | React 19, Tailwind CSS 4             |
| State             | Zustand 5                            |
| Text Layout       | @chenglou/pretext                    |
| Data Validation   | Zod                                  |
| Entity Resolution | Fuse.js (fuzzy matching)             |
| Database          | better-sqlite3 + Drizzle ORM         |
| Testing           | Vitest                               |
| Build             | pnpm workspaces + Turborepo          |

## Development Environment

This project uses [devenv](https://devenv.sh) for reproducible Nix-based development.

```bash
# Enter development shell
devenv shell

# Or with direnv (automatic on cd)
direnv allow

# Run scripts
pnpm install     # Install dependencies
pnpm test        # Run tests
pnpm dev         # Start dev server
pnpm build       # Build for production
```

## 7 Signal Detectors

| Signal                           | What It Detects                                                          |
| -------------------------------- | ------------------------------------------------------------------------ |
| `procurement_lobbying_overlap`   | Vendor holds government contracts AND lobbies same department            |
| `revolving_door`                 | Person moves between government and lobbying/industry                    |
| `spousal_interest_proximity`     | Official's spouse employed by entity they regulate                       |
| `sole_source_heavy_lobbying`     | Sole-source contract awarded during active lobbying                      |
| `donation_proximity_correlation` | Political donation near contract award date                              |
| `mandate_divergence`             | Government mandate promise vs actual spending pattern                    |
| `international_layering`         | International development funds connected to domestic contractors        |

## 7 Web Views

| View        | Description                                                                              |
| ----------- | ---------------------------------------------------------------------------------------- |
| **MONITOR** | Live ops center — anomaly feed, spending bars, severity gauge, entity watchlist, ticker |
| **BRIEF**   | Magazine-style scrollytelling editorial with scroll-triggered reveals                   |
| **EXPLORE** | Connection graph, entity profiles, chart deep dives (treemap, lobbying bars)            |
| **SIGNALS** | Filterable alert feed with signal severity badges                                        |
| **SOCIAL**  | Community leaderboard, investigations panel, annotations system (prototype)             |
| **SOURCES** | Data source coverage dashboard with real Canadian government data links                 |
| **TIMELINE**| Entity timeline showing events across contracts, lobbying, donations                     |

## Seed Data

The demo includes realistic Canadian government data producing connection threads:

1. **L3Harris Technologies** — holds DND contracts while lobbying DND via Navigator LLP
2. **Michael Chen** — DND Assistant Deputy Minister → Navigator LLP → lobbying DND (revolving door)
3. **Sarah Mitchell** — MP on Defence Committee, spouse employed at L3Harris (spousal interest)
4. **Sole-source F-35 contract** — $45M sole-source during active lobbying (procurement overlap)
5. **Plan International** — GAC funding + Lockheed Martin partnership (international layering)
6. **Robert Mitchell** — L3Harris VP donation to Conservatives near contract award
7. **Indigenous procurement gap** — 5% mandate vs defence spending reality (mandate divergence)

## Test Suite

```
8 test files · 135 tests · All passing
├── entity/test.test.ts      23 tests (entity resolution, aliases, fuzzy matching)
├── graph/test.test.ts       17 tests (graph building, path finding, signal detection)
├── briefs/test.test.ts       5 tests (brief generation, sections, confidence scoring)
├── seed/test.test.ts         6 tests (full pipeline: seed → graph → signals → brief)
├── sources/spending/        19 tests (spending parser, CSV parsing, mapping)
├── sources/lobbying/        20 tests (lobbying parser, registration data)
├── sources/ciec/            23 tests (CIEC + Elections Canada parser)
└── sources/gac/             22 tests (GAC international parser)
```

## Data Philosophy

- **Public data ONLY** — official government sources, no speculation
- **Every assertion links to a primary source**
- **Non-partisan** — the system is structurally complex and citizens deserve tools to navigate it
- **Person-centered** — people are the connective tissue, not organizations

## Project Status

| Layer            | Status      | Notes                                              |
| ---------------- | ----------- | -------------------------------------------------- |
| Core data layer  | ✅ Complete | Parsers, entity resolution, graph, signals, briefs |
| Web views        | ✅ Complete | 7 views, all functional with real data             |
| Charts library   | ✅ Complete | 10 chart types, all implemented                    |
| Social features  | ⚠️ Prototype| Types defined, UI shells exist, not production-ready |

See [features.md](./features.md) for detailed feature breakdown.

## License

MIT
