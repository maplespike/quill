// SPDX-License-Identifier: AGPL-3.0-only
export interface A2ajCoverageItem {
  dataset: string;
  descriptionEn: string;
  descriptionFr: string;
  earliestDocumentDate: string | null;
  latestDocumentDate: string | null;
  numberOfDocuments: number;
}

export interface A2ajDocument {
  citation: string;
  title: string;
  text: string;
  dataset: string;
  language: string;
}

export interface A2ajSearchResult {
  citation: string;
  title: string;
  snippet: string;
  dataset: string;
  score: number;
}

export interface A2ajIngestionResult {
  coverage: A2ajCoverageItem[];
  documents: A2ajDocument[];
  searches: A2ajSearchResult[];
  errors: string[];
  durationMs: number;
}
