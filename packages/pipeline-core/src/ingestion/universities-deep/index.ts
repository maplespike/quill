import { fetchAllUniversities } from './fetcher.js';
import type { UniversityRecord, UniversitiesIngestionResult } from './types.js';
export async function ingestAllUniversities(): Promise<UniversitiesIngestionResult> { return fetchAllUniversities(); }
export type { UniversityRecord, UniversitiesIngestionResult };
