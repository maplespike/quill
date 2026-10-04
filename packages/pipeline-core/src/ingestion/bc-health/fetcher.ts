// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * BC Health Fetcher — Quill
 *
 * Fetches BC health data from:
 *   - BC PharmaCare — CKAN data portal
 *   - BC CDC — publications and disease data
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  BC_HEALTH_SOURCES,
  BC_HEALTH_SOURCE_CONFIG,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type {
  RawBCHealthRecord,
  PharmaCareApiRecord,
  BCCDCApiRecord,
} from './types.js';
import type { HttpResponse } from '../../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class BCHealthFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    public readonly source?: string,
  ) {
    super(message);
    this.name = 'BCHealthFetchError';
  }
}

/* ------------------------------------------------------------------ */
/*  HTTP Helpers                                                       */
/* ------------------------------------------------------------------ */

async function fetchJson<T = unknown>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new BCHealthFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/* ------------------------------------------------------------------ */
/*  PharmaCare Fetcher                                                 */
/* ------------------------------------------------------------------ */

/**
 * Fetch PharmaCare claims data from BC CKAN portal.
 *
 * BC CKAN API endpoints:
 *   /api/3/action/package_show?id={package-id} — package metadata
 *   /api/3/action/resource_show?id={resource-id} — resource metadata
 *
 * @returns Raw PharmaCare records
 */
async function fetchPharmaCareData(
  options: {
    fiscalYear?: string;
    drugName?: string;
    manufacturer?: string;
    limit?: number;
  } = {},
): Promise<RawBCHealthRecord[]> {
  let records: RawBCHealthRecord[] = [];

  try {
    const url = new URL(BC_HEALTH_SOURCES.PHARMACARE.CKAN_API);
    url.searchParams.set('id', '66d219d3-4625-4260-8207-bb7c9d685088');

    const packageData = await fetchJson<{
      result?: {
        resources?: Array<{
          id: string;
          url: string;
          format: string;
          name: string;
        }>;
      };
    }>(url.toString());

    const resources = packageData.result?.resources ?? [];
    const csvResources = resources.filter(r =>
      r.format?.toLowerCase().includes('csv') ||
      r.name?.toLowerCase().includes('claims'),
    );

    for (const resource of csvResources.slice(0, 3)) {
      try {
        const csvResp: HttpResponse = await httpGet(resource.url, {
          headers: { ...DEFAULT_HEADERS },
          timeoutMs: DEFAULT_TIMEOUT_MS,
        });

        if (csvResp.statusCode >= 400) continue;

        const csvData = csvResp.body;
        const lines = csvData.split('\n');
        const headers = lines[0]?.split(',') ?? [];

        for (let i = 1; i < lines.length && records.length < (options.limit ?? 500); i++) {
          const line = lines[i].trim();
          if (!line || line.startsWith('#')) continue;

          const values = line.split(',');
          if (values.length !== headers.length) continue;

          const record: RawBCHealthRecord = {
            drugName: headers.includes('drug_name') ? values[headers.indexOf('drug_name')]?.trim() : '',
            manufacturer: headers.includes('manufacturer') ? values[headers.indexOf('manufacturer')]?.trim() : '',
            formularyStatus: headers.includes('formulary_status') ? values[headers.indexOf('formulary_status')]?.trim() : '',
            atcCode: headers.includes('atc_code') ? values[headers.indexOf('atc_code')]?.trim() : '',
            therapeuticCategory: headers.includes('therapeutic_category') ? values[headers.indexOf('therapeutic_category')]?.trim() : '',
            claimCount: headers.includes('claim_count') ? Number.parseInt(values[headers.indexOf('claim_count')] ?? '0', 10) : 0,
            totalCost: headers.includes('total_cost') ? Number.parseFloat(values[headers.indexOf('total_cost')] ?? '0') : 0,
            fiscalYear: headers.includes('fiscal_year') ? values[headers.indexOf('fiscal_year')]?.trim() : '',
            sourceUrl: resource.url,
          };

          if (record.drugName) {
            records.push(record);
          }
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    throw new BCHealthFetchError(
      `Failed to fetch PharmaCare data: ${(err as Error).message}`,
      undefined,
      BC_HEALTH_SOURCES.PHARMACARE.CKAN_API,
      'pharmacare',
    );
  }

  if (options.fiscalYear) {
    records = records.filter(r => r.fiscalYear === options.fiscalYear);
  }
  const drugName = options.drugName;
  if (drugName) {
    records = records.filter(r => r.drugName?.toLowerCase().includes(drugName.toLowerCase()));
  }
  const manufacturer = options.manufacturer;
  if (manufacturer) {
    records = records.filter(r => r.manufacturer?.toLowerCase().includes(manufacturer.toLowerCase()));
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  BC CDC Fetcher                                                     */
/* ------------------------------------------------------------------ */

/**
 * Fetch BC CDC publications.
 * Uses the BC CDC website as a source.
 *
 * @returns Raw BC CDC records
 */
async function fetchBCCDCData(
  options: {
    topic?: string;
    diseaseFocus?: string;
    limit?: number;
  } = {},
): Promise<RawBCHealthRecord[]> {
  let records: RawBCHealthRecord[] = [];

  try {
    const url = BC_HEALTH_SOURCES.BC_CDC.PUBLICATIONS;
    const resp: HttpResponse = await httpGet(url, {
      headers: { ...DEFAULT_HEADERS, Accept: 'text/html,*/*' },
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new BCHealthFetchError(
        `HTTP ${resp.statusCode} fetching BC CDC`,
        resp.statusCode,
        url,
        'bccdc',
      );
    }

    const html = resp.body;

    const titleRegex = /<h2[^>]*>(.*?)<\/h2>/gi;
    const urlRegex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
    const dateRegex = /(\d{4}-\d{2}-\d{2})/g;

    const titles: string[] = [];
    let titleMatch: RegExpExecArray | null;
    while ((titleMatch = titleRegex.exec(html)) !== null && titles.length < (options.limit ?? 200)) {
      titles.push(titleMatch[1].trim());
    }

    const links: string[] = [];
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = urlRegex.exec(html)) !== null && links.length < titles.length) {
      const href = linkMatch[1];
      if (href.startsWith('/') || href.includes('bccdc.ca')) {
        links.push(href.startsWith('http') ? href : `${BC_HEALTH_SOURCES.BC_CDC.BASE}${href}`);
      }
    }

    for (let i = 0; i < Math.min(titles.length, links.length); i++) {
      const dateMatch = dateRegex.exec(html);
      records.push({
        title: titles[i],
        url: links[i],
        publicationDate: dateMatch ? dateMatch[1] : undefined,
        sourceUrl: links[i],
      });
    }
  } catch (err) {
    throw new BCHealthFetchError(
      `Failed to fetch BC CDC data: ${(err as Error).message}`,
      undefined,
      BC_HEALTH_SOURCES.BC_CDC.PUBLICATIONS,
      'bccdc',
    );
  }

  const topic = options.topic;
  if (topic) {
    records = records.filter(r => r.title?.toLowerCase().includes(topic.toLowerCase()));
  }
  const diseaseFocus = options.diseaseFocus;
  if (diseaseFocus) {
    records = records.filter(r => r.title?.toLowerCase().includes(diseaseFocus.toLowerCase()));
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function fetchPharmaCareClaims(
  options: {
    fiscalYear?: string;
    drugName?: string;
    manufacturer?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawBCHealthRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const records = await fetchPharmaCareData(options);
    return {
      records,
      source: 'bc-pharmacare',
      errors,
    };
  } catch (err) {
    errors.push(`PharmaCare fetch failed: ${(err as Error).message}`);
    return { records: [], source: 'bc-pharmacare', errors };
  }
}

export async function fetchBCCDCPublications(
  options: {
    topic?: string;
    diseaseFocus?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawBCHealthRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const records = await fetchBCCDCData(options);
    return {
      records,
      source: 'bc-cdc',
      errors,
    };
  } catch (err) {
    errors.push(`BC CDC fetch failed: ${(err as Error).message}`);
    return { records: [], source: 'bc-cdc', errors };
  }
}

export async function fetchAllBCHealthData(
  options: {
    limit?: number;
  } = {},
): Promise<{
  records: RawBCHealthRecord[];
  perSource: Record<string, RawBCHealthRecord[]>;
  errors: string[];
}> {
  const perSource: Record<string, RawBCHealthRecord[]> = {};
  const allRecords: RawBCHealthRecord[] = [];
  const allErrors: string[] = [];

  const { records: pcRecords, errors: pcErrors } = await fetchPharmaCareClaims(options);
  perSource.pharmacare = pcRecords;
  allRecords.push(...pcRecords);
  allErrors.push(...pcErrors);

  const { records: cdcRecords, errors: cdcErrors } = await fetchBCCDCPublications(options);
  perSource.bccdc = cdcRecords;
  allRecords.push(...cdcRecords);
  allErrors.push(...cdcErrors);

  return {
    records: allRecords,
    perSource,
    errors: allErrors,
  };
}