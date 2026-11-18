// SPDX-License-Identifier: AGPL-3.0-only
import { ingestAllLegislation } from './fetcher.js';
import { toLegislationRecord, parseJusticeCanadaXml, parseProvincialCkanPackages, parseProvincialWebHtml } from './parser.js';
import { LEGISLATION_SOURCES } from './constants.js';
import type { LegislationRecord, LegislationIngestionResult } from './types.js';

export async function ingestAllLegislationData(): Promise<LegislationIngestionResult> {
  return ingestAllLegislation();
}

export { LEGISLATION_SOURCES };
export { toLegislationRecord, parseJusticeCanadaXml, parseProvincialCkanPackages, parseProvincialWebHtml } from './parser.js';
export type { LegislationRecord, LegislationIngestionResult };
