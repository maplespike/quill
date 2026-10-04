/**
 * Isc Ingestion Module — Quill
 *
 * Jordan Principle Requests data ingestion from open.canada.ca CKAN portal.
 * Fetches CSV, parses records, normalizes with SHA-256 citations.
 */

import { fetchIscCsv } from './fetcher.js';
import { parseJordanPrincipleRequest } from './parser.js';
import { ISC_PACKAGES } from './constants.js';
import type { JordanPrincipleRequest, IscIngestionResult } from './types.js';

export async function ingestJordanPrincipleRequest(
  options: { limit?: number } = {},
): Promise<IscIngestionResult & { records: JordanPrincipleRequest[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: JordanPrincipleRequest[] = [];

  try {
    const csv = await fetchIscCsv(ISC_PACKAGES.JORDAN_PRINCIPLE);
    records = await parseJordanPrincipleRequest(csv);
    recordsFound = records.length;
    recordsIngested = records.length;

    if (options.limit) {
      records = records.slice(0, options.limit);
      recordsIngested = records.length;
    }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    dataset: 'jordan-principle',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchJordanPrincipleByStatus(
  status: string,
  options: { limit?: number } = {},
): Promise<JordanPrincipleRequest[]> {
  const result = await ingestJordanPrincipleRequest(options);
  const normalized = status.toLowerCase();
  return result.records.filter(r => r.status.toString().toLowerCase().includes(normalized));
}

export async function searchJordanPrincipleByServiceType(
  serviceType: string,
  options: { limit?: number } = {},
): Promise<JordanPrincipleRequest[]> {
  const result = await ingestJordanPrincipleRequest(options);
  const normalized = serviceType.toLowerCase();
  return result.records.filter(r => r.serviceType.toString().toLowerCase().includes(normalized));
}

