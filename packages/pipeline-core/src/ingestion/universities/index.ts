// SPDX-License-Identifier: AGPL-3.0-only
import { fetchAllUniversities } from './fetcher.js';
import type { UniversityRecord, UniversitiesIngestionResult } from './types.js';
export async function ingestAllUniversities(): Promise<UniversitiesIngestionResult> { return fetchAllUniversities(); }
export type { UniversityRecord, UniversitiesIngestionResult };
export { parseUniversityRecord, parseUniversityRecords, normalizeDate, parseNumeric } from './parser.js';
