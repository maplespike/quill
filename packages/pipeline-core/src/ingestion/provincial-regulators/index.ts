import { ingestAllRegulators, getRegulatorCoverage } from './fetcher.js';
import type { ProvincialRegulatorRecord, ProvincialRegulatorsIngestionResult } from './types.js';

export { ingestAllRegulators, getRegulatorCoverage };
export type { ProvincialRegulatorRecord, ProvincialRegulatorsIngestionResult } from './types.js';
export { parseProvincialRegulatorRecord, parseProvincialRegulatorRecords, normalizeDate, parseNumeric } from './parser.js';
