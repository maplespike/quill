export interface RealEstateRecord {
  id: string; title: string; description: string;
  url: string; date: string; sector: string; jurisdiction: string;
}
export interface RealEstateIngestionResult {
  source: string; recordsFound: number; records: RealEstateRecord[];
  errors: string[]; durationMs: number;
}
