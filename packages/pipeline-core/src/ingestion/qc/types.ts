export interface QCDataset {
  id: string;
  title: string;
  name: string;
  sector: string;
  url: string;
  format: string;
  description: string;
  organization: string;
  tags: string[];
  resourceCount: number;
  hash: string;
  ingestedAt: string;
}

export interface QCIngestionResult {
  datasets: QCDataset[];
  sectorsChecked: number;
  datasetsFound: number;
  errors: string[];
  durationMs: number;
}
