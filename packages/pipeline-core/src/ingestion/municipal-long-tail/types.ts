export interface MunicipalDataset {
  id: string;
  municipality: string;
  province: string;
  title: string;
  url: string;
  format: string;
  category: string;
  hash: string;
  ingestedAt: string;
}

export interface MunicipalLongTailIngestionResult {
  datasets: MunicipalDataset[];
  portalsChecked: number;
  datasetsFound: number;
  errors: string[];
  durationMs: number;
}
