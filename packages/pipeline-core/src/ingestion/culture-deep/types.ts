export interface CultureGrant {
  program: string;
  recipient: string;
  province: string;
  amount: number;
  year: number;
  description: string;
  url: string;
  hash: string;
  ingestedAt: string;
}

export interface CultureDeepIngestionResult {
  grants: CultureGrant[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: string[];
  durationMs: number;
}
