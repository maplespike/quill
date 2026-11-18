// SPDX-License-Identifier: AGPL-3.0-only
import { fetchAllUnions } from './fetcher.js';
import type { UnionRecord, UnionsIngestionResult } from './types.js';
export async function ingestAllUnions(): Promise<UnionsIngestionResult> { return fetchAllUnions(); }
export type { UnionRecord, UnionsIngestionResult };
export { parseUnionRecord, parseUnionRecords, normalizeDate, parseNumeric } from './parser.js';
