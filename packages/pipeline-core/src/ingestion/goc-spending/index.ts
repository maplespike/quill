/**
 * GoC-Spending Ingestion — MapleSpike Pipeline
 *
 * Orchestrates ingestion of Government of Canada contract spending data
 * from the GoC-Spending project (goc-spending.github.io).
 *
 * Sources:
 *   - Combined dataset CSVs (source, clean, by_year) — ZIP archives
 *   - Analysis aggregate CSVs (department, vendor breakdowns)
 *   - Raw proactive disclosure JSON archives from goc-spending-data repo
 *
 * Terms: preserve the original dataset's publisher declaration. A project mirror
 * does not establish a blanket license for all files or source datasets.
 *
 * Designed to run as a cron job alongside other pipeline modules.
 */

export { fetchContracts, listDataFiles, ingestAllGoCSpending } from './fetcher.js';
export { GOC_CONTRACTS_DDL, GOC_DEPT_SPENDING_DDL } from './constants.js';
export { toGoCContract, toGoCDeptSpending, toGoCVendorSpending, parseGoCContracts, parseGoCDeptSpending, parseGoCVendorSpending } from './parser.js';
export type { GoCContract, GoCDeptSpending, GoCVendorSpending, GoCIngestionResult } from './types.js';
