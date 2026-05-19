export interface BCDataset {
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

export interface BCIngestionResult {
  datasets: BCDataset[];
  sectorsChecked: number;
  datasetsFound: number;
  errors: string[];
  durationMs: number;
}
