// SPDX-License-Identifier: AGPL-3.0-only
import { fetchAllMunicipalLongTail } from './fetcher.js';
import type { MunicipalDataset, MunicipalLongTailIngestionResult } from './types.js';
export async function ingestMunicipalLongTail(): Promise<MunicipalLongTailIngestionResult> { return fetchAllMunicipalLongTail(); }
export type { MunicipalDataset, MunicipalLongTailIngestionResult };
export { parseMunicipalDataset, parseMunicipalDatasets, normalizeDate, parseNumeric } from './parser.js';
