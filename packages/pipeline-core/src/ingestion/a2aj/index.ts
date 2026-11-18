// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCoverage, fetchByCitation, searchA2aj, ingestAllA2aj } from './fetcher.js';
import { A2AJ_BASE, A2AJ_ENDPOINTS, TRACKED_DATASETS } from './constants.js';
import type { A2ajCoverageItem, A2ajDocument, A2ajSearchResult, A2ajIngestionResult } from './types.js';

export {
  fetchCoverage, fetchByCitation, searchA2aj, ingestAllA2aj,
  A2AJ_BASE, A2AJ_ENDPOINTS, TRACKED_DATASETS,
};
export type { A2ajCoverageItem, A2ajDocument, A2ajSearchResult, A2ajIngestionResult };
