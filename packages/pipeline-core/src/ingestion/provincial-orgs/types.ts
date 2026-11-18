// SPDX-License-Identifier: AGPL-3.0-only
import type { ProvinceCode } from '../provincial-legislatures/types.js';

export { ProvinceCode };

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
