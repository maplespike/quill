import { fetchAllFilings } from './fetcher.js';
import type { CorporateFiling, CorporateFilingsIngestionResult } from './types.js';

export { fetchAllFilings };
export type { CorporateFiling, CorporateFilingsIngestionResult };
export const ingestAllFilings = fetchAllFilings;
