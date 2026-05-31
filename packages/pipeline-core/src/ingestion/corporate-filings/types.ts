export interface CorporateFiling {
  id: string;
  corporationName: string;
  corporationNumber: string;
  status: string;
  incorporationDate: string;
  dissolutionDate?: string;
  registeredOfficeAddress?: string;
  jurisdiction: string;
  source: string;
  category: string;
}

export interface CorporateFilingsIngestionResult {
  records: CorporateFiling[];
  totalFetched: number;
  errors: string[];
  durationMs: number;
}
