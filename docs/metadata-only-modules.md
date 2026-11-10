---
last-reviewed: 2026-07-07
status: active
---

# Module Parser Audit — 2026-05-29

**Source:** Issue #548  
**Total Modules:** 86 ingestion directories in `packages/pipeline-core/src/ingestion/`

## Classification

- **✅ Real Parser** — Has `parser.ts` with dedicated field extraction
- **⚡ Inline Parse** — No `parser.ts`, but deep extraction inline in domain files with structured types
- **❌ Metadata Only** — Has `fetcher.ts` but only surface-level extraction (minimal typed fields)
- **📁 Skeleton** — Barely started (no `fetcher.ts`, minimal or no types)

## ✅ Real Parser (36 modules)

| Module | Parser Lines | Tests |
|--------|-------------|-------|
| ati | 347 | |
| bank-of-canada | 486 | |
| canlii | 399 | |
| cipo | 196 | |
| cmhc | 217 | |
| committees | 336 | |
| cra-charity | 444 | |
| crown-corporations | 244 | |
| crtc | 643 | ✅ |
| elections | 566 | |
| emergency-management | 58 | ✅ |
| federal-budget | 610 | |
| gazette | 284 | |
| gic | 346 | |
| global-canada | 329 | |
| health-canada | 264 | |
| healthcanada | 127 | |
| impact-assessment | 185 | |
| indigenous-services-directory | 97 | ✅ |
| ircc | 398 (7 sub-modules) | |
| ircc-family-sponsorship | 107 | ✅ |
| isc | 454 (7 sub-modules) | |
| isc-programs | 85 | ✅ |
| lmia | 493 | |
| municipal | 520 | |
| npri | 225 | |
| nrcan | 506 (6 sub-modules) | ✅ |
| oversight | 822 | |
| pharmaceuticals | 51 | ✅ |
| policing-security | 96 | ✅ |
| proactive-disclosure | 443 | |
| provincial-legislatures | 485 | |
| provincial-lobbying | 1710 | |
| sedi | 340 | |
| species-at-risk | 184 | |
| telecommunications | 58 | ✅ |

## ⚡ Inline Parse (16 modules — structured extraction, no parser.ts)

| Module | Lines | Files | Domain Coverage |
|--------|-------|-------|-----------------|
| agriculture | 1,047 | 4 | AAFC, CFIA, Grain Commission, Dairy, Farm Credit |
| corporate | 2,843 | 11 | Lobbying, Procurement, Corporations, Statements. SEDI ingest is retired. |
| criminal-justice | 2,312 | 7 | CSC, Parole, RCMP, PPSC |
| culture | 742 | 3 | |
| education-research | 2,781 | 7 | CFI, CRC, Student Loans, Tri-Council |
| geospatial | 921 | 8 | CKAN geospatial datasets |
| health-data | 3,031 | 8 | PHAC, CFIA, CIHI, CADTH, PMPRB |
| immigration | 1,485 | 6 | CBSA, IRB, IRCC sub-modules |
| indigenous-relations | 1,934 | 7 | CIRNAC, ISC, TRC, FN Transparency |
| influence | 2,377 | 7 | Lobbying registry, influence tracking |
| science-research | 381 | 6 | CSA, MITACS, ONC |
| social-programs | 2,305 | 9 | CCB, CPP/OAS, EI, Food Security, Poverty |
| statcan | 2,721 | 9 | CPI, GDP, Labour, Population, Trade, WDS |
| transport-infrastructure | 2,825 | 8 | CIIB, CTA, Infrastructure Canada, TC, TSB |
| veterans | 935 | 5 | VAC, DND, OSISS, Suicide stats |

**Total with effective parsers: 52 modules (60%)**

## ❌ Metadata Only (17 modules — fetcher exists, shallow extraction)

| Module | Lines | Notes |
|--------|-------|-------|
| a2aj | 134 | |
| corporate-filings | 55 | |
| defence | 244 | has tests |
| federal | 92 | |
| fisheries | 691 | |
| goc-spending | 350 | |
| legislation | 214 | |
| media-broadcasting | 208 | |
| municipal-long-tail | 79 | |
| ngo-influence-rss | 298 | |
| provincial | 76 | |
| provincial-orgs | 525 | |
| provincial-regulators | 425 | |
| real-time-feeds | 338 | |
| regional-authorities | 288 | |
| unions | 80 | |
| universities | 100 | |
| veterans | 935 | has tests — borderline |

## 📁 Skeleton (15 modules — barely started)

| Module | Lines | Domain |
|--------|-------|--------|
| fire-emergency | 79 | Emergency services |
| gtfs-transit | 97 | Transit data |
| oecd-stat | 0 | International — OECD |
| ontario-provincial | 0 | Provincial — Ontario |
| parliamentary-voting | 59 | Federal parliament |
| police-data | 93 | Police data |
| political-donations | 80 | Political finance |
| public-accounts | 59 | Public accounts |
| un-comtrade | 73 | International — UN |
| undp-hdi | 0 | International — UNDP |
| unhcr-refugees | 0 | International — UNHCR |
| worldbank-wdi | 80 | International — World Bank |
| attestation | 331 | Generic attestation |
| gc-standards | 168 | GC standards |
| templates | 0 | Scaffolding |

## Summary

| Category | Count | % |
|----------|-------|---|
| ✅ Real Parser | 36 | 42% |
| ⚡ Inline Parse | 16 | 19% |
| ❌ Metadata Only | 17 | 20% |
| 📁 Skeleton | 15 | 17% |

**Need parsers filed:** 32 modules (metadata-only + skeletons) across 5 domains

## Per-Domain Issues To File

- [ ] Federal Departments (8 modules): a2aj, corporate-filings, defence, federal, fisheries, goc-spending, legislation, media-broadcasting
- [ ] Civil Society (5 modules): ngo-influence-rss, unions, universities, culture, science-research
- [ ] Provincial (5 modules): provincial, provincial-orgs, provincial-regulators, municipal-long-tail, regional-authorities
- [ ] New International (5 modules): oecd-stat, un-comtrade, undp-hdi, unhcr-refugees, worldbank-wdi
- [ ] New Municipal/Emergency (6 modules): fire-emergency, gtfs-transit, parliamentary-voting, police-data, political-donations, public-accounts
- [ ] Real-time and Monitoring (2 modules): real-time-feeds, attestation
