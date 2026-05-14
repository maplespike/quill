/** Province/territory code */
export type ProvinceCode =
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT'
  | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

/** Type of provincial oversight body */
export type OversightBodyType =
  | 'auditor-general'
  | 'ombudsman'
  | 'human-rights-tribunal'
  | 'campaign-finance'
  | 'ethics-commissioner'
  | 'sunshine-list'
  | 'energy-utilities-regulator'
  | 'procurement-oversight';

/** Configuration for a single provincial oversight body */
export interface ProvincialOrgConfig {
  code: string;
  name: string;
  province: ProvinceCode;
  bodyType: OversightBodyType;
  baseUrl: string;
  feedUrl?: string;
  ckanPackageId?: string;
  ckanBaseUrl?: string;
  description: string;
  enabled: boolean;
}

/** A record fetched from a provincial oversight body */
export interface ProvincialRecord {
  bodyCode: string;
  bodyName: string;
  bodyType: OversightBodyType;
  province: ProvinceCode;
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  hash: string;
  ingestedAt: string;
}

/** Result of a provincial-orgs ingestion run */
export interface ProvincialOrgIngestionResult {
  records: ProvincialRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: { source: string; error: string }[];
  durationMs: number;
}
