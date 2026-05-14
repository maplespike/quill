export type ProvinceCode = 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

export type OversightBodyType =
  | 'auditor-general' | 'ombudsman' | 'human-rights-tribunal'
  | 'campaign-finance' | 'ethics-commissioner' | 'sunshine-list'
  | 'energy-utilities-regulator' | 'procurement-oversight'
  | 'securities-regulator' | 'financial-services-regulator' | 'insurance-regulator'
  | 'law-society' | 'legal-aid'
  | 'police-oversight' | 'police-complaint' | 'police-siu'
  | 'engineering-regulator' | 'accounting-regulator'
  | 'medical-regulator' | 'nursing-regulator' | 'teaching-regulator' | 'real-estate-regulator';

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

export interface ProvincialOrgRecord {
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

export interface ProvincialOrgIngestionResult {
  records: ProvincialOrgRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: { source: string; error: string }[];
  durationMs: number;
}
