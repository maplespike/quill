// SPDX-License-Identifier: AGPL-3.0-or-later

import type { LicenseMetadataBasis } from '../../shared/attribution.js';
import type { PortalType } from './constants.js';

export interface MunicipalRecord {
  id: string;
  municipality: string;
  municipalityId: string;
  province: string;
  dataset: string;
  title: string;
  url: string;
  format: string;
  lastModified: string | null;
  created: string | null;
  portalType: PortalType;
  license?: string;
  licenseUrl?: string;
  licenseBasis?: LicenseMetadataBasis;
  attributionText?: string;
}

export interface MunicipalSearchParams {
  municipality?: string;
  province?: string;
  dataset?: string;
  portalType?: PortalType;
  query?: string;
}

export interface MunicipalIngestionResult {
  records: MunicipalRecord[];
  municipality: string;
  source: string;
  totalFetched: number;
  errors: string[];
  durationMs: number;
}
