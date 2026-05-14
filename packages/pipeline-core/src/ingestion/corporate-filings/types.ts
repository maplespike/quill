export interface CorporateFiling {
  id: string;
  company: string;
  filingType: string;
  filingDate: string;
  summary: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface CorporateFilingsIngestionResult {
  filings: CorporateFiling[];
  errors: string[];
  durationMs: number;
}
