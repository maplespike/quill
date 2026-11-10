// SPDX-License-Identifier: AGPL-3.0-only
export const OC_API_BASE = 'https://api.opencorporates.com/v0.4';
export const OC_TIMEOUT_MS = 15_000;
export const OC_UA = 'MapleSpike-OpenCorporates/1.0 (+https://maplespike.dev)';

export const OC_JURISDICTIONS: Record<string, string> = {
  ca: 'Canada (Federal)',
  ca_on: 'Ontario',
  ca_bc: 'British Columbia',
  ca_ab: 'Alberta',
  ca_qc: 'Quebec',
  ca_sk: 'Saskatchewan',
  ca_mb: 'Manitoba',
  ca_ns: 'Nova Scotia',
  ca_nb: 'New Brunswick',
  ca_nl: 'Newfoundland and Labrador',
  ca_pe: 'Prince Edward Island',
  ca_yt: 'Yukon',
  ca_nt: 'Northwest Territories',
  ca_nu: 'Nunavut',
};

export const OC_REQ_INTERVAL_MS = 30_000; // 30s between requests (free tier: 50/day)
export const OC_MAX_RETRIES = 2;
