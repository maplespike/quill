import type { ProvincialRegulatorRecord, ProvincialRegulatorsIngestionResult } from './types.js';
import { computeHash } from '../../verification/hashing.js';

export async function ingestAllRegulators(): Promise<ProvincialRegulatorsIngestionResult> {
  return { records: [], errors: [] };
}

export type { ProvincialRegulatorRecord, ProvincialRegulatorsIngestionResult } from './types.js';
