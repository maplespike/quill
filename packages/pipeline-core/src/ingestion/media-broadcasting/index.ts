// SPDX-License-Identifier: AGPL-3.0-only
import { fetchAllMedia } from './fetcher.js';
import { toMediaRecord, parseCrtcReports, parseCrtcOwnership, parseCmfData, parseTelefilm } from './parser.js';
import { MEDIA_SOURCES } from './constants.js';
import type { MediaRecord, MediaIngestionResult } from './types.js';

export async function ingestAllMedia(): Promise<MediaIngestionResult> {
  return fetchAllMedia();
}

export { MEDIA_SOURCES };
export { toMediaRecord, parseCrtcReports, parseCrtcOwnership, parseCmfData, parseTelefilm } from './parser.js';
export type { MediaRecord, MediaIngestionResult };
