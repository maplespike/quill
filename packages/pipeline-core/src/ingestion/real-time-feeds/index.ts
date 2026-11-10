// SPDX-License-Identifier: AGPL-3.0-only
import { fetchAllRealtime } from './fetcher.js';
import { REALTIME_SOURCES } from './constants.js';
import type { RealtimeRecord, RealtimeIngestionResult } from './types.js';

export async function ingestAllRealtime(): Promise<RealtimeIngestionResult> {
  return fetchAllRealtime();
}

export { REALTIME_SOURCES };
export type { RealtimeRecord, RealtimeIngestionResult };
export { parseRealtimeRecord, parseRealtimeRecords, normalizeDate, parseNumeric } from './parser.js';
