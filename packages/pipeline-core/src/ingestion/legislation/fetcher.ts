// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { parseJusticeCanadaXml, parseProvincialCkanPackages, parseProvincialWebHtml } from './parser.js';
import type { LegislationRecord, LegislationIngestionResult } from './types.js';
import { LEGISLATION_SOURCES, LEGISLATION_UA, LEGISLATION_TIMEOUT_MS, MAX_LEGISLATION_RECORDS, JUSTICE_CANADA_XML_MASTER } from './constants.js';

async function fetchText(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': LEGISLATION_UA }, timeoutMs: LEGISLATION_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : resp.body;
  } catch { return null; }
}

async function fetchJson(url: string): Promise<any> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': LEGISLATION_UA, Accept: 'application/json' }, timeoutMs: LEGISLATION_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : await resp.json();
  } catch { return null; }
}

async function fetchJusticeCanadaMaster(): Promise<LegislationRecord[]> {
  const xml = await fetchText(JUSTICE_CANADA_XML_MASTER);
  if (!xml) return [];
  return parseJusticeCanadaXml(xml, MAX_LEGISLATION_RECORDS);
}

async function fetchProvincialCkanLegislation(): Promise<LegislationRecord[]> {
  const data = await fetchJson('https://open.canada.ca/data/api/3/action/package_search?q=legislation+acts+regulations&rows=30');
  if (!data?.result?.results) return [];
  return parseProvincialCkanPackages(data.result.results, MAX_LEGISLATION_RECORDS);
}

async function fetchProvincialLegislationWeb(): Promise<LegislationRecord[]> {
  const records: LegislationRecord[] = [];

  const onHtml = await fetchText('https://www.ontario.ca/laws');
  if (onHtml) {
    records.push(...await parseProvincialWebHtml(onHtml, 'ontario-elaws', 'ON', 'https://www.ontario.ca', MAX_LEGISLATION_RECORDS));
  }

  const bcHtml = await fetchText('https://www.bclaws.gov.bc.ca/');
  if (bcHtml) {
    records.push(...await parseProvincialWebHtml(bcHtml, 'bc-laws', 'BC', 'https://www.bclaws.gov.bc.ca', MAX_LEGISLATION_RECORDS));
  }

  return records;
}

export async function ingestAllLegislation(): Promise<LegislationIngestionResult> {
  const start = Date.now();
  const records: LegislationRecord[] = [];
  const errors: string[] = [];

  const [fed, provCkan, provWeb] = await Promise.allSettled([
    fetchJusticeCanadaMaster().catch(e => { errors.push(`Justice Canada: ${e.message}`); return []; }),
    fetchProvincialCkanLegislation().catch(e => { errors.push(`Prov CKAN: ${e.message}`); return []; }),
    fetchProvincialLegislationWeb().catch(e => { errors.push(`Prov Web: ${e.message}`); return []; }),
  ]);

  if (fed.status === 'fulfilled') records.push(...fed.value);
  if (provCkan.status === 'fulfilled') records.push(...provCkan.value);
  if (provWeb.status === 'fulfilled') records.push(...provWeb.value);

  return {
    records, sourcesAttempted: LEGISLATION_SOURCES.length,
    sourcesSucceeded: records.length > 0 ? LEGISLATION_SOURCES.length : 0,
    errors, durationMs: Date.now() - start,
  };
}
