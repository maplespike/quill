export interface ProvincialRegulatorRecord {
  id: string;
  province: string;
  regulator: string;
  decisionType: string;
  date: string;
  summary: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface ProvincialRegulatorsIngestionResult {
  records: ProvincialRegulatorRecord[];
  errors: string[];
}
