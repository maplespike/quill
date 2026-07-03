> ⚠️ **Historical artifact** — This document is preserved for context. The single source of truth for the active backlog is [`ROADMAP.md`](./ROADMAP.md). Do not edit without also updating ROADMAP.md.


# Plan: Implement 22 Missing Modules (Registry → Disk)

**Problem**: 22 modules are registered in `registry.ts` but their source directories don't exist on disk. These are planned modules that were registered but never implemented.

---

## Batch 1 — NRCan Sub-modules (5)
These are registered as sub-modules of `nrcan/` but don't exist:
| Module | Path | Functions |
|--------|------|-----------|
| `nrcan-renewable` | `./nrcan/renewable/index.js` | ingestRenewableCapacity, searchRenewableByType, searchRenewableByProvince |
| `nrcan-fires` | `./nrcan/fires/index.js` | ingestForestFire, searchFiresByProvince, searchFiresByYear |
| `nrcan-energy` | `./nrcan/energy/index.js` | ingestEnergyStat, searchEnergyByProvince, searchEnergyBySource |
| `nrcan-forests` | `./nrcan/forests/index.js` | ingestForestInventory, searchForestsByEcozone, searchForestsBySpecies |
| `nrcan-minerals` | `./nrcan/minerals/index.js` | ingestMineralProduction, searchMineralsByCommodity, searchMineralsByProvince |

**Implement all 5** as lightweight CKAN-search wrappers (open.canada.ca).

## Batch 2 — ISC Sub-modules (7)
| Module | Path | Functions |
|--------|------|-----------|
| `isc-health-funding` | `./isc/health-funding/index.js` | ingestIndigenousHealthFunding, searchHealthFundingByCommunity, searchHealthFundingByProgram |
| `isc-education` | `./isc/education/index.js` | ingestEducationFunding, searchEducationBySchool, searchEducationByProvince |
| `isc-housing` | `./isc/housing/index.js` | ingestHousingProgram, searchHousingByCommunity, searchHousingByProgram |
| `isc-water` | `./isc/water/index.js` | ingestWaterInfrastructure, searchWaterByCommunity, searchWaterByStatus |
| `isc-jordan-principle` | `./isc/jordan-principle/index.js` | ingestJordanPrincipleRequest, searchJordanPrincipleByStatus, searchJordanPrincipleByServiceType |
| `isc-land-claims` | `./isc/land-claims/index.js` | ingestLandClaim, searchLandClaimsByGroup, searchLandClaimsByProvince |
| `isc-communities` | `./isc/communities/index.js` | ingestFirstNationCommunity, searchCommunitiesByProvince, searchCommunitiesByName |

## Batch 3 — IRCC Sub-modules (7)
| Module | Path | Functions |
|--------|------|-----------|
| `ircc-processing-times` | `./ircc/processing-times/index.js` | ingestProcessingTime, searchByVisaOffice, searchByApplicationType |
| `ircc-entry-exit` | `./ircc/entry-exit/index.js` | ingestEntryExit, searchByNationality, searchByQuarter |
| `ircc-pr-admissions` | `./ircc/pr-admissions/index.js` | ingestPermanentResidentAdmission, searchByProvince, searchByCategory |
| `ircc-citizenship` | `./ircc/citizenship/index.js` | ingestCitizenshipGrant, searchCitizenshipByProvince, searchCitizenshipByYear |
| `ircc-work-permits` | `./ircc/work-permits/index.js` | ingestWorkPermit, searchWorkPermitsByProvince, searchWorkPermitsByNoc |
| `ircc-study-permits` | `./ircc/study-permits/index.js` | ingestStudyPermit, searchStudyPermitsByProvince, searchStudyPermitsByInstitution |
| `ircc-express-entry` | `./ircc/express-entry/index.js` | ingestExpressEntryRound, searchByProgram, searchByCrsCutoff |

## Batch 4 — Standalone Modules (3)
| Module | Path | Functions |
|--------|------|-----------|
| `ontario-provincial` | `./ontario-provincial/index.js` | ingestOntarioProvincial, searchOntarioProvincial |
| `un-data` | `./un-data/index.js` | ingestUnDataset, ingestByDatabase, ingestAllUn |

## Implementation Pattern
Each module follows this structure:
```
module/
├── index.ts      # Main entry, exports all functions
├── constants.ts  # Source URLs, API endpoints
├── types.ts      # TypeScript interfaces
└── __tests__/module.test.ts
```

All modules use CKAN API at `open.canada.ca` for data fetching. Pattern: 
```ts
const resp = await fetch(`https://open.canada.ca/data/api/3/action/package_search?q=${query}`);
const data = await resp.json();
```

## Execution Order
```
Phase 1: NRCan batch (5 modules) — most data available via CKAN
Phase 2: ISC batch (7 modules) — multiple ISC datasets on open.canada.ca
Phase 3: IRCC batch (7 modules) — well-documented IRCC datasets
Phase 4: ontario-provincial + un-data (2 modules)
```

## Verification
```bash
pnpm --filter @maplespike/pipeline-core run build
cd packages/pipeline-core && pnpm exec tsx --test 'src/ingestion/module/__tests__/*.test.ts'
cd packages/pipeline-core && pnpm exec tsx --test 'src/ingestion/__tests__/module-coverage.test.ts'
```
