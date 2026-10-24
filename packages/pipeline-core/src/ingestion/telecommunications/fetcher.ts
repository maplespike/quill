// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import {
  TELECOMMUNICATIONS_SOURCES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type { RawTelecommunicationsRecord } from './types.js';

export class TelecommunicationsFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'TelecommunicationsFetchError';
  }
}

const SOURCE_CONFIGS = [  { name: 'CRTC', url: 'https://crtc.gc.ca/eng/publications/reports.htm' },
  { name: 'ISED', url: 'https://ised-isde.canada.ca/site/spectrum-management/en' },
  { name: 'CIRA', url: 'https://www.cira.ca/resources/corporate/industry-data' },
];

export async function fetchTelecommunicationsRecords(
  options: { limit?: number; source?: string } = {},
): Promise<{ records: RawTelecommunicationsRecord[]; source: string; errors: string[] }> {
  const errors: string[] = [];
  const records: RawTelecommunicationsRecord[] = [];

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

  return { records, source: records.length > 0 ? 'telecommunications-api' : 'none', errors };
}
