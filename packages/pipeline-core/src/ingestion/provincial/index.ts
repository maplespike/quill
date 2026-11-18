// SPDX-License-Identifier: AGPL-3.0-only
import { fetchAllProvincialDeep } from './fetcher.js';
import type { ProvincialDataset, ProvincialDeepIngestionResult } from './types.js';
export async function ingestAllProvincialDeep(): Promise<ProvincialDeepIngestionResult> { return fetchAllProvincialDeep(); }
export type { ProvincialDataset, ProvincialDeepIngestionResult };
export { parseProvincialDataset, parseProvincialDatasets, normalizeDate, parseNumeric } from './parser.js';
