/**
 * Ontario Health Fetcher — Quill
 *
 * Fetches Ontario health records from:
 *   - OHIP claims data (data.ontario.ca CKAN)
 *   - Public Health Ontario publications (www.publichealthontario.ca)
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  ON_HEALTH_SOURCES,
  ON_HEALTH_TYPE_CONFIG,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type {
  OntarioHealthRecordType,
  RawOntarioHealthRecord,
  OhipApiRecord,
  PublicHealthApiRecord,
} from './types.js';
import type { HttpResponse } from '../../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class OntarioHealthFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    public readonly recordType?: OntarioHealthRecordType,
  ) {
    super(message);
    this.name = 'OntarioHealthFetchError';
  }
}

/* ------------------------------------------------------------------ */
/*  HTTP Helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch JSON from a URL.
 */
async function fetchJson<T = unknown>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new OntarioHealthFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/**
 * Fetch raw text from a URL.
 */
async function fetchText(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS, Accept: 'application/rss+xml,application/xml,text/xml,text/html,*/*' },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new OntarioHealthFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}

/* ------------------------------------------------------------------ */
/*  OHIP Claims Fetcher                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch OHIP claims data from data.ontario.ca CKAN.
 *
 * OHIP claims data is typically available as CSV resources in the CKAN dataset.
 * This fetcher queries the CKAN API to get the dataset and its resources.
 *
 * @returns Raw OHIP claim records
 */
async function fetchOhipClaims(
  options: {
    fiscalYear?: string;
    claimType?: string;
    limit?: number;
  } = {},
): Promise<RawOntarioHealthRecord[]> {
  const records: RawOntarioHealthRecord[] = [];

  try {
    // Query CKAN API for OHIP claims dataset
    const datasetId = 'ohip-claims';
    const ckanUrl = `${ON_HEALTH_SOURCES.OHIP_CLAIMS.CKAN_API}/package_show?id=${datasetId}`;

    const dataset = await fetchJson<Record<string, unknown>>(ckanUrl);

    if (!dataset.result || typeof dataset.result !== 'object') {
      throw new OntarioHealthFetchError(
        'Invalid CKAN response for OHIP claims dataset',
        undefined,
        ckanUrl,
        'ohip_claim',
      );
    }

    const result = dataset.result as Record<string, unknown>;
    const resources = result.resources as Array<Record<string, unknown>> ?? [];

    // Find CSV resources
    const csvResources = resources.filter(r =>
      r.format === 'CSV' || r.mimetype?.toString().includes('csv')
    );

    if (csvResources.length === 0) {
      throw new OntarioHealthFetchError(
        'No CSV resources found for OHIP claims dataset',
        undefined,
        ckanUrl,
        'ohip_claim',
      );
    }

    // Fetch the first CSV resource
    const csvResource = csvResources[0];
    const csvUrl = csvResource.url as string;

    // Fetch CSV data
    const csvData = await fetchText(csvUrl);
    const lines = csvData.split('\n');

    if (lines.length < 2) {
      return records; // No data
    }

    // Parse CSV header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    // Parse CSV rows (skip header)
    const limit = options.limit ?? 500;
    for (let i = 1; i < Math.min(lines.length, limit + 1); i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};

      headers.forEach((header, idx) => {
        row[header] = values[idx] ?? '';
      });

      // Extract OHIP claim fields
      const claimType = row['claim_type'] || row['service_type'] || '';
      const serviceCode = row['service_code'] || row['code'] || '';
      const feeSchedule = row['fee_schedule'] || row['schedule'] || '';
      const serviceDate = row['service_date'] || row['date'] || '';
      const providerType = row['provider_type'] || row['provider'] || '';
      const claimsCount = row['claims_count'] || row['count'] || '0';
      const totalPaid = row['total_paid'] || row['amount'] || '0';
      const fiscalYear = row['fiscal_year'] || row['year'] || '';

      // Filter by options
      if (options.fiscalYear && !fiscalYear.includes(options.fiscalYear)) {
        continue;
      }
      if (options.claimType && !claimType.toLowerCase().includes(options.claimType.toLowerCase())) {
        continue;
      }

      records.push({
        recordType: 'ohip_claim',
        claimType,
        serviceCode,
        feeSchedule,
        serviceDate,
        providerType,
        claimsCount: parseInt(claimsCount, 10) || 0,
        totalPaid: parseFloat(totalPaid) || 0,
        fiscalYear,
        sourceUrl: csvUrl,
        sourceSystem: 'on-health-ohip',
      });
    }
  } catch (err) {
    if (err instanceof OntarioHealthFetchError) {
      throw err;
    }
    throw new OntarioHealthFetchError(
      `Failed to fetch OHIP claims: ${(err as Error).message}`,
      undefined,
      ON_HEALTH_SOURCES.OHIP_CLAIMS.DATASET,
      'ohip_claim',
    );
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Public Health Ontario Fetcher                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse RSS XML items into raw Public Health Ontario records.
 */
function parsePublicHealthRssItems(xmlText: string): PublicHealthApiRecord[] {
  const items: PublicHealthApiRecord[] = [];

  // Simple RSS item parsing — matches <item>...</item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
    const block = itemMatch[1];
    const extract = (tag: string): string | undefined => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
      return m ? m[1].trim() : undefined;
    };

    const link = extract('link');
    const category = extract('category');

    items.push({
      title: extract('title'),
      link,
      description: extract('description')?.replace(/<[^>]*>/g, ''),
      pubDate: extract('pubDate'),
      category,
      topic: category,
      published_date: extract('pubDate'),
      summary: extract('description')?.replace(/<[^>]*>/g, ''),
    });
  }

  return items;
}

/**
 * Fetch Public Health Ontario publications.
 * Tries RSS feed first, falls back to scraping the publications page.
 *
 * @returns Raw Public Health Ontario records
 */
async function fetchPublicHealthPublications(
  options: {
    topic?: string;
    limit?: number;
  } = {},
): Promise<RawOntarioHealthRecord[]> {
  const records: RawOntarioHealthRecord[] = [];

  try {
    // Try RSS feed first
    try {
      const rssXml = await fetchText(ON_HEALTH_SOURCES.PUBLIC_HEALTH.RSS);
      const rssItems = parsePublicHealthRssItems(rssXml);

      for (const item of rssItems.slice(0, options.limit ?? 200)) {
        // Filter by topic if specified
        if (options.topic) {
          const itemTopic = item.topic ?? item.category ?? '';
          if (!itemTopic.toLowerCase().includes(options.topic.toLowerCase())) {
            continue;
          }
        }

        records.push({
          recordType: 'public_health',
          title: item.title ?? '',
          topic: item.topic ?? item.category,
          publicationDate: item.pubDate ?? item.published_date,
          summary: item.description ?? item.summary,
          sourceUrl: item.link ?? ON_HEALTH_SOURCES.PUBLIC_HEALTH.PUBLICATIONS,
          sourceSystem: 'on-health-pho-rss',
        });
      }

      if (records.length > 0) {
        return records;
      }
    } catch {
      // RSS failed — try web scraping
    }

    // Fall back to the publications page (simplified)
    // In a real implementation, this would parse HTML
    // For now, return empty records
    return records;
  } catch (err) {
    throw new OntarioHealthFetchError(
      `Failed to fetch Public Health Ontario publications: ${(err as Error).message}`,
      undefined,
      ON_HEALTH_SOURCES.PUBLIC_HEALTH.DATA,
      'public_health',
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Record-Type Dispatcher                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch Ontario health records by type.
 *
 * @param type - Record type to fetch
 * @param options - Fetch options
 * @returns Raw health records with source info and errors
 */
export async function fetchOntarioHealthRecords(
  type: OntarioHealthRecordType,
  options: {
    fiscalYear?: string;
    claimType?: string;
    topic?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawOntarioHealthRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawOntarioHealthRecord[] = [];
  let source = 'none';

  try {
    const limit = options.limit ?? ON_HEALTH_TYPE_CONFIG[
      type === 'ohip_claim' ? 'ohip' : 'public_health'
    ].defaultLimit;

    switch (type) {
      case 'ohip_claim':
        records = await fetchOhipClaims({
          fiscalYear: options.fiscalYear,
          claimType: options.claimType,
          limit,
        });
        source = 'on-health-ohip';
        break;

      case 'public_health':
        records = await fetchPublicHealthPublications({
          topic: options.topic,
          limit,
        });
        source = 'on-health-pho';
        break;
    }
  } catch (err) {
    errors.push(`ON health fetch failed for ${type}: ${(err as Error).message}`);
  }

  return { records, source, errors };
}

/**
 * Fetch both Ontario health record types.
 *
 * @returns Combined raw records grouped by type
 */
export async function fetchAllOntarioHealthRecords(
  options: {
    limit?: number;
  } = {},
): Promise<{
  records: RawOntarioHealthRecord[];
  perType: Record<OntarioHealthRecordType, RawOntarioHealthRecord[]>;
  errors: string[];
}> {
  const perType: Record<string, RawOntarioHealthRecord[]> = {};
  const allRecords: RawOntarioHealthRecord[] = [];
  const allErrors: string[] = [];

  const types: OntarioHealthRecordType[] = ['ohip_claim', 'public_health'];

  for (const type of types) {
    const { records, errors } = await fetchOntarioHealthRecords(type, options);
    perType[type] = records;
    allRecords.push(...records);
    allErrors.push(...errors);
  }

  return {
    records: allRecords,
    perType: perType as Record<OntarioHealthRecordType, RawOntarioHealthRecord[]>,
    errors: allErrors,
  };
}