// SPDX-License-Identifier: AGPL-3.0-only
export type LegislationSource = 'justice-canada-xml' | 'ontario-elaws' | 'bc-laws' | 'quebec-legislation' | 'provincial-ckan';

export interface LegislationRecord {
  source: LegislationSource;
  jurisdiction: string;
  title: string;
  actNumber?: string;
  chapter?: string;
  year: number;
  url: string;
  format: string;
  description: string;
  hash: string;
  ingestedAt: string;
}

export interface LegislationIngestionResult {
  records: LegislationRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: string[];
  durationMs: number;
}
