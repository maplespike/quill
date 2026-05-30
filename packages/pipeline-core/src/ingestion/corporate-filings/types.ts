export type FilingTypeCategory =
  | 'annual-report' | 'management-discussion' | 'proxy-circular'
  | 'material-change' | 'financial-statement' | 'prospectus'
  | 'takeover-bid' | 'issuer-bid' | 'meeting-materials'
  | 'governance' | 'corporate-action' | 'acquisition'
  | 'press-release' | 'other';

export interface RawFilingRow {
  issuerName: string;
  issuerTicker?: string;
  filingType: string;
  filingDate: string;
  documentUrl: string;
  description?: string;
  formType?: string;
  sourceUrl?: string;
}

export interface CorporateFiling {
  id: string;
  issuerName: string;
  issuerTicker: string | null;
  filingType: string;
  filingTypeCategory: FilingTypeCategory;
  filingDate: string;
  documentUrl: string;
  description: string | null;
  formType: string | null;
  sourceUrl: string;
  ingestedAt: string;
}

export interface CorporateFilingsSearchParams {
  issuer?: string;
  ticker?: string;
  filingType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  page?: number;
}

export interface CorporateFilingsIngestionResult {
  records: CorporateFiling[];
  source: string;
  totalFetched: number;
  totalNew: number;
  errors: string[];
  durationMs: number;
}
