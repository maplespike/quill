import { fetchAllMedia } from './fetcher.js';
import { MEDIA_SOURCES } from './constants.js';
import type { MediaRecord, MediaIngestionResult } from './types.js';

export async function ingestAllMedia(): Promise<MediaIngestionResult> {
  return fetchAllMedia();
}

export { MEDIA_SOURCES };
export type { MediaRecord, MediaIngestionResult };
