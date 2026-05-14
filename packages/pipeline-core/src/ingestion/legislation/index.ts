import { ingestAllLegislation } from './fetcher.js';
import { LEGISLATION_SOURCES } from './constants.js';
import type { LegislationRecord, LegislationIngestionResult } from './types.js';

export async function ingestAllLegislationData(): Promise<LegislationIngestionResult> {
  return ingestAllLegislation();
}

export { LEGISLATION_SOURCES };
export type { LegislationRecord, LegislationIngestionResult };
