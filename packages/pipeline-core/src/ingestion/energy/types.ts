export interface EnergyRecord {
  id: string;
  title: string;
  description: string;
  url: string;
  date: string;
  sector: string;
  category: string;
}

export interface EnergyIngestionResult {
  source: string;
  recordsFound: number;
  records: EnergyRecord[];
  errors: string[];
  durationMs: number;
}
