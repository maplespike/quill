// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import {
  POLICING_SECURITY_SOURCES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type { RawPolicingSecurityRecord } from './types.js';

export class PolicingSecurityFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'PolicingSecurityFetchError';
  }
}

const SOURCE_CONFIGS = [  { name: 'RCMP', url: 'https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownload/CSV/35100178' },
  { name: 'CSIS', url: 'https://www.canada.ca/en/security-intelligence-service/corporate/publications.html' },
  { name: 'CSE', url: 'https://www.cyber.gc.ca/en/alerts-advisories' },
  { name: 'CSC', url: 'https://www.csc-scc.gc.ca/research/005007-eng.shtml' },
];

export async function fetchPolicingSecurityRecords(
  options: { limit?: number; source?: string } = {},
): Promise<{ records: RawPolicingSecurityRecord[]; source: string; errors: string[] }> {
  const errors: string[] = [];
  const records: RawPolicingSecurityRecord[] = [];

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

  return { records, source: records.length > 0 ? 'policingSecurity-api' : 'none', errors };
}
