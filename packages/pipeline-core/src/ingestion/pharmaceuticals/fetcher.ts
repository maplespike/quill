// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import {
  PHARMACEUTICALS_SOURCES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type { RawPharmaceuticalsRecord } from './types.js';

export class PharmaceuticalsFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'PharmaceuticalsFetchError';
  }
}

const SOURCE_CONFIGS = [  { name: 'PMPRB', url: 'https://www.pmprb-cepmb.gc.ca/analytics' },
  { name: 'DPD', url: 'https://health-products.canada.ca/dpd-bdpp/index-eng.jsp' },
  { name: 'DrugShortages', url: 'https://www.drugshortagescanada.ca' },
  { name: 'CADTH', url: 'https://www.cadth.ca/reports' },
];

export async function fetchPharmaceuticalsRecords(
  options: { limit?: number; source?: string } = {},
): Promise<{ records: RawPharmaceuticalsRecord[]; source: string; errors: string[] }> {
  const errors: string[] = [];
  const records: RawPharmaceuticalsRecord[] = [];

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

  return { records, source: records.length > 0 ? 'pharmaceuticals-api' : 'none', errors };
}
