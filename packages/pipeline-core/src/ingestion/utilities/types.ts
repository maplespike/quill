export interface UtilityRecord {
  id: string;
  name: string;
  province: string;
  type: string;
  serviceArea: string;
  url: string;
  outageUrl?: string;
  ratesUrl?: string;
}

export interface UtilityIngestionResult {
  providers: UtilityRecord[];
  errors: string[];
  durationMs: number;
}
