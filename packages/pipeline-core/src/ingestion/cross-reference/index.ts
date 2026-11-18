// SPDX-License-Identifier: AGPL-3.0-only
import { crossReferenceSearch } from './fetcher.js';
import { CROSS_REF_MODULES } from './constants.js';
import type { CrossReferenceResult, CrossReferenceMatch, CrossReferenceTimelineEntry, CrossReferenceQuery } from './types.js';

export async function searchCrossReference(query: CrossReferenceQuery): Promise<CrossReferenceResult> {
  return crossReferenceSearch(query);
}

export { CROSS_REF_MODULES };
export type { CrossReferenceResult, CrossReferenceMatch, CrossReferenceTimelineEntry, CrossReferenceQuery };
export { parseCrossReferenceResult, parseCrossReferenceResults, normalizeDate, parseNumeric } from './parser.js';
