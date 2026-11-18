// SPDX-License-Identifier: AGPL-3.0-only
import { fetchAllFilings } from './fetcher.js';
import type { CorporateFiling, CorporateFilingsIngestionResult } from './types.js';

export { fetchAllFilings };
export type { CorporateFiling, CorporateFilingsIngestionResult };
export const ingestAllFilings = fetchAllFilings;
