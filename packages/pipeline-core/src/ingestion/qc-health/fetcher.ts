// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Quebec Health Fetcher — Quill
 *
 * Fetches health records from Quebec sources:
 *   - RAMQ medical claims statistics from Données Québec
 *   - INSPQ public health surveillance data from Données Québec
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  QC_HEALTH_SOURCES,
  QC_HEALTH_TYPE_CONFIG,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type {
  RAMQRecordType,
  RawRAMQRecord,
  RawQCHealthRecord,
} from './types.js';
import type { HttpResponse } from '../../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class QCHealthFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    public readonly recordType?: RAMQRecordType,
  ) {
    super(message);
    this.name = 'QCHealthFetchError';
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
    throw new QCHealthFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

async function fetchText(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new QCHealthFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}

/* ------------------------------------------------------------------ */
/*  RAMQ Data Fetcher                                                  */
/* ------------------------------------------------------------------ */

async function fetchRAMQData(
  options: {
    region?: string;
    fiscalYear?: string;
    limit?: number;
  } = {},
): Promise<RawRAMQRecord[]> {
  const records: RawRAMQRecord[] = [];
  const sourceUrl = QC_HEALTH_SOURCES.RAMQ.DATA;

  try {
    const data = await fetchJson<Record<string, unknown>>(sourceUrl);
    const results = (data.result ?? data.results ?? data.records ?? data) as unknown[];

    if (Array.isArray(results)) {
      for (const item of results.slice(0, options.limit ?? 500)) {
        const r = item as Record<string, unknown>;
        records.push({
          claim_type: String(r.claim_type ?? r.type_claim ?? ''),
          service_code: String(r.service_code ?? r.code_service ?? ''),
          service_date: String(r.service_date ?? r.date_service ?? ''),
          provider_type: String(r.provider_type ?? r.type_provider ?? ''),
          beneficiary_type: String(r.beneficiary_type ?? r.type_beneficiary ?? ''),
          region: String(r.region ?? ''),
          claims_count: typeof r.claims_count === 'number' ? r.claims_count : typeof r.claims_count === 'string' ? parseInt(r.claims_count, 10) : undefined,
          total_paid: typeof r.total_paid === 'number' ? r.total_paid : typeof r.total_paid === 'string' ? parseFloat(r.total_paid) : undefined,
          fiscal_year: String(r.fiscal_year ?? r.annee_fiscale ?? ''),
          source_url: String(r.url ?? r.source_url ?? sourceUrl),
        });
      }
    }
  } catch (err) {
    throw new QCHealthFetchError(
      `Failed to fetch RAMQ data: ${(err as Error).message}`,
      undefined,
      sourceUrl,
      'ramq',
    );
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  INSPQ Data Fetcher                                                 */
/* ------------------------------------------------------------------ */

async function fetchINSPQData(
  options: {
    topic?: string;
    limit?: number;
  } = {},
): Promise<RawQCHealthRecord[]> {
  const records: RawQCHealthRecord[] = [];
  const sourceUrl = QC_HEALTH_SOURCES.INSPQ.DATA;

  try {
    const data = await fetchJson<Record<string, unknown>>(sourceUrl);
    const results = (data.result ?? data.results ?? data.records ?? data) as unknown[];

    if (Array.isArray(results)) {
      for (const item of results.slice(0, options.limit ?? 300)) {
        const r = item as Record<string, unknown>;
        records.push({
          title: String(r.title ?? r.titre ?? ''),
          title_fr: String(r.title_fr ?? r.titre_fr ?? r.title ?? ''),
          topic: String(r.topic ?? r.sujet ?? ''),
          publication_date: String(r.publication_date ?? r.date_publication ?? ''),
          url: String(r.url ?? r.link ?? sourceUrl),
          summary: String(r.summary ?? r.resume ?? r.description ?? ''),
        });
      }
    }
  } catch (err) {
    throw new QCHealthFetchError(
      `Failed to fetch INSPQ data: ${(err as Error).message}`,
      undefined,
      sourceUrl,
      'inspq',
    );
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Record-Type Dispatcher                                             */
/* ------------------------------------------------------------------ */

export async function fetchQCHealthRecords(
  type: RAMQRecordType,
  options: {
    limit?: number;
    region?: string;
    fiscalYear?: string;
    topic?: string;
  } = {},
): Promise<{
  records: (RawRAMQRecord | RawQCHealthRecord)[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: (RawRAMQRecord | RawQCHealthRecord[]) = [];
  let source = 'none';

  try {
    const limit = options.limit ?? QC_HEALTH_TYPE_CONFIG[type].defaultLimit;

    switch (type) {
      case 'ramq':
        records = await fetchRAMQData({
          region: options.region,
          fiscalYear: options.fiscalYear,
          limit,
        });
        source = 'qc-ramq';
        break;

      case 'inspq':
        records = await fetchINSPQData({
          topic: options.topic,
          limit,
        });
        source = 'qc-inspq';
        break;
    }
  } catch (err) {
    errors.push(`QC health fetch failed for ${type}: ${(err as Error).message}`);
  }

  return { records, source, errors };
}

export async function fetchAllQCHealthRecords(
  options: {
    limit?: number;
  } = {},
): Promise<{
  records: (RawRAMQRecord | RawQCHealthRecord[])[];
  perType: Record<RAMQRecordType, (RawRAMQRecord | RawQCHealthRecord)[]>;
  errors: string[];
}> {
  const perType: Record<string, (RawRAMQRecord | RawQCHealthRecord)[]> = {};
  const allRecords: (RawRAMQRecord | RawQCHealthRecord)[] = [];
  const allErrors: string[] = [];

  const types: RAMQRecordType[] = ['ramq', 'inspq'];

  for (const type of types) {
    const { records, errors } = await fetchQCHealthRecords(type, options);
    perType[type] = records;
    allRecords.push(...records);
    allErrors.push(...errors);
  }

  return {
    records: allRecords,
    perType: perType as Record<RAMQRecordType, (RawRAMQRecord | RawQCHealthRecord)[]>,
    errors: allErrors,
  };
}