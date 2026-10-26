// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import {
  EMERGENCY_MANAGEMENT_SOURCES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type { RawEmergencyManagementRecord } from './types.js';

export class EmergencyManagementFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'EmergencyManagementFetchError';
  }
}

const SOURCE_CONFIGS = [  { name: 'CDD', url: 'https://www.publicsafety.gc.ca/cnt/rsrcs/cndn-dsstr-dtbs/index-en.aspx' },
  { name: 'ECCC', url: 'https://weather.gc.ca/alerts/index_e.html' },
  { name: 'NRCan', url: 'https://www.earthquakescanada.nrcan.gc.ca/index-en.php' },
];

export async function fetchEmergencyManagementRecords(
  options: { limit?: number; source?: string } = {},
): Promise<{ records: RawEmergencyManagementRecord[]; source: string; errors: string[] }> {
  const errors: string[] = [];
  const records: RawEmergencyManagementRecord[] = [];

  const sources = options.source
    ? SOURCE_CONFIGS.filter(s => s.name === options.source)
    : SOURCE_CONFIGS;

  for (const src of sources) {
    try {
      const resp = await httpGet(src.url, {
        headers: { ...DEFAULT_HEADERS },
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });

      if (resp.statusCode >= 400) {
        errors.push(`${src.name} HTTP ${resp.statusCode}`);
        continue;
      }

      records.push({
        title: `${src.name} data`,
        url: src.url,
        sourceSystem: src.name.toLowerCase(),
        publishedAt: new Date().toISOString(),
      });
    } catch (err) {
      errors.push(`${src.name} fetch failed: ${(err as Error).message}`);
    }
  }

  return { records, source: records.length > 0 ? 'emergencyManagement-api' : 'none', errors };
}
