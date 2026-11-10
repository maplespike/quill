# Placeholder Module Triage — Priority & Effort Ranking

Last-reviewed: 2026-06-11
Status: active

## Method

32 modules marked `status: 'placeholder'` in registry.ts. Ranked by:
- **Impact**: How much data/model coverage it adds (high/medium/low)
- **Effort**: Estimated work (1-3 days for parser.ts + tests)
- **Dependency**: Whether other modules or features depend on it

## Tier 1: High Priority (implement next)

| Module | Domain | Impact | Effort | Why now |
|--------|--------|--------|--------|---------|
| **defence** | Federal | High | 1d | DND data is a core federal dataset; already has tests |
| **fisheries** | Federal | High | 2d | DFO economic + environmental data; 691 lines already exist |
| **legislation** | Federal | High | 2d | Powers the legal search capability; 214 lines exist |
| **goc-spending** | Federal | High | 1d | Gov spending is a top user query; 350 lines exist |
| **worldbank-wdi** | International | High | 2d | 47 indicators already wired; needs expansion to 100+ |

## Tier 2: Medium Priority (next sprint)

| Module | Domain | Impact | Effort | Why later |
|--------|--------|--------|--------|-----------|
| **un-comtrade** | International | Med | 2d | Trade data complements statcan; 73 lines |
| **undp-hdi** | International | Med | 1d | Human Development Index; 0 lines — fresh build |
| **unhcr-refugees** | International | Med | 1d | Complements IRCC immigration data; 0 lines |
| **police-data** | Municipal/Emergency | Med | 2d | Police stats are commonly requested |
| **parliamentary-voting** | Federal | Med | 1d | Voting records complement committees |
| **political-donations** | Federal | Med | 1d | Elections + donations = influence tracking |

## Tier 3: Lower Priority (backlog)

| Module | Domain | Impact | Effort | Notes |
|--------|--------|--------|--------|-------|
| gtfs-transit | Infrastructure | Low | 3d | Complex GTFS parsing, 30+ agencies |
| ontario-provincial | Provincial | Low | 2d | Ontario already covered by provincial-ckan |
| oecd-stat | International | Low | 1d | OECD main module already exists |
| fire-emergency | Emergency | Low | 1d | Niche; 79 lines |
| public-accounts | Federal | Low | 1d | 59 lines |
| media-broadcasting | Federal | Low | 1d | 208 lines; CRTC module covers most |
| a2aj | Federal | Low | 1d | 134 lines; niche legal access tool |
| corporate-filings | Corporate | Low | 1d | 55 lines; SEDI insider ingest is retired |
| federal | Federal | Low | 2d | 92 lines; vague scope |
| municipal-long-tail | Municipal | Low | 2d | 79 lines; 100s of small municipalities |
| ngo-influence-rss | Civil Society | Low | 1d | 298 lines; RSS stubs |
| provincial | Provincial | Low | 2d | 76 lines; duplicates provincial-ckan |
| provincial-orgs | Provincial | Low | 2d | 525 lines |
| provincial-regulators | Provincial | Low | 2d | 425 lines |
| real-time-feeds | Monitoring | Low | 2d | 338 lines; depends on API gateway |
| regional-authorities | Municipal | Low | 1d | 288 lines |
| unions | Civil Society | Low | 1d | 80 lines |
| universities | Civil Society | Low | 1d | 100 lines |
| attestation | Infrastructure | Low | 1d | 331 lines; generic utility |
| gc-standards | Infrastructure | Low | 1d | 168 lines; reference data |
| templates | Infrastructure | Low | 0d | Scaffolding; 0 lines |

## Recommendation

**Implement Tier 1 first (5 modules, ~8 days total).** This covers the biggest gaps in federal data (defence, fisheries, legislation, spending) and the most-requested international dataset (World Bank WDI expansion). These 5 modules alone would boost real-parser coverage from 52/86 (60%) to 57/86 (66%).

Tier 2 adds meaningful but non-critical coverage. Tier 3 is backlog — most are either duplicate coverage or niche sources that only matter after the core is solid.
