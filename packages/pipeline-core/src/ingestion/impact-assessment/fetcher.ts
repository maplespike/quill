// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Impact Assessment Agency of Canada Fetcher — Quill
 *
 * Fetches federal project impact assessment records from IAAC (Impact Assessment
 * Agency of Canada) via the project registry and CKAN.
 *
 * Primary sources:
 *   - IAAC Project Search: https://iaac-aeic.gc.ca/050/evaluations/search
 *   - CKAN on open.canada.ca
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  IAAC_SOURCES,
  IAAC_DECISION_MAP,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type { RawImpactAssessmentRecord } from './types.js';
import type { HttpResponse } from '../../utils/http.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class IaacFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'IaacFetchError';
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
    throw new IaacFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/**
 * Fetch raw text (HTML) from a URL.
 */
async function fetchText(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new IaacFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}

/* ------------------------------------------------------------------ */
/*  IAAC Project Search                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch IAAC projects from the registry search page.
 * Parses the HTML to extract project listings.
 *
 * @returns Raw project records extracted from IAAC registry
 */
export async function fetchIaacProjects(
  options: {
    searchTerm?: string;
    province?: string;
    decision?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawImpactAssessmentRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  const records: RawImpactAssessmentRecord[] = [];

  try {
    // Search via CKAN for IAAC-related datasets
    const ckanUrl = `${IAAC_SOURCES.CKAN.PACKAGE_SEARCH}?q=${encodeURIComponent(IAAC_SOURCES.IAAC_CKAN_QUERY)}&rows=${options.limit ?? 50}&sort=metadata_modified desc`;
    const ckanResp = await fetchJson<{
      success: boolean;
      result: {
        results: Array<{
          id: string;
          name: string;
          title: string;
          notes: string | null;
          metadata_created: string;
          metadata_modified: string;
          resources: Array<{
            id: string;
            name: string;
            format: string;
            url: string;
          }>;
        }>;
      };
    }>(ckanUrl);

    if (ckanResp.success && ckanResp.result?.results) {
      for (const pkg of ckanResp.result.results) {
        const decision = extractDecisionFromText(pkg.title) || extractDecisionFromText(pkg.notes ?? '') || 'unknown';
        records.push({
          projectName: pkg.title,
          decision,
          sourceUrl: `${IAAC_SOURCES.CKAN.BASE}/dataset/${pkg.name}`,
          sourceSystem: 'open-canada-ckan',
          iaacReferenceNumber: pkg.id.substring(0, 8),
        });

        // Also check resources
        for (const resource of pkg.resources ?? []) {
          if (resource.format?.toUpperCase() === 'JSON' || resource.format?.toUpperCase() === 'CSV') {
            try {
              const text = await fetchText(resource.url);
              const parsed = parseIaacCsvToRaw(text, resource.url);
              records.push(...parsed);
            } catch (err) {
              errors.push(`IAAC resource fetch failed for ${resource.url}: ${(err as Error).message}`);
            }
          }
        }
      }
    }

    // Also try fetching the IAAC project registry HTML to supplement
    try {
      const html = await fetchText(IAAC_SOURCES.PROJECT_SEARCH);
      const htmlRecords = parseIaacSearchHtml(html);
      records.push(...htmlRecords);
    } catch (err) {
      errors.push(`IAAC registry page fetch failed: ${(err as Error).message}`);
    }
  } catch (err) {
    errors.push(`IAAC fetch failed: ${(err as Error).message}`);
  }

  return {
    records,
    source: records.length > 0 ? 'iaac-mixed' : 'none',
    errors,
  };
}

/**
 * Fetch a specific IAAC project assessment report by reference number.
 *
 * @param refNumber - IAAC or CEAA reference number
 * @returns Raw IAAC record or null
 */
export async function fetchIaacAssessmentDetail(
  refNumber: string,
): Promise<RawImpactAssessmentRecord | null> {
  const url = `${IAAC_SOURCES.PROJECT_DETAIL}/${refNumber}`;

  try {
    const html = await fetchText(url);
    return parseIaacDetailHtml(html, refNumber);
  } catch (err) {
    console.warn(`[IAAC] Detail fetch failed for ${refNumber}:`, (err as Error).message);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  HTML Parsing Helpers (within fetcher)                              */
/* ------------------------------------------------------------------ */

/**
 * Parse decision text from a project title or description.
 */
function extractDecisionFromText(text: string | null): string | undefined {
  if (!text) return undefined;

  const lower = text.toLowerCase();
  if (lower.includes('approved') && lower.includes('condition')) return 'approved-with-conditions';
  if (lower.includes('approved')) return 'approved';
  if (lower.includes('denied') || lower.includes('not approved')) return 'denied';
  if (lower.includes('pending') || lower.includes('in progress') || lower.includes('under review')) return 'pending';
  if (lower.includes('withdrawn')) return 'withdrawn';
  if (lower.includes('exempt')) return 'exempted';
  if (lower.includes('referred') || lower.includes('panel')) return 'referred';
  if (lower.includes('not required')) return 'not-required';

  return undefined;
}

/**
 * Parse IAAC search HTML to extract project records.
 */
function parseIaacSearchHtml(html: string): RawImpactAssessmentRecord[] {
  const records: RawImpactAssessmentRecord[] = [];

  // Match project entries in the IAAC registry HTML
  const projectPattern = /<div[^>]*class="[^"]*project-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = projectPattern.exec(html)) !== null) {
    const block = match[1];

    const nameMatch = block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    const proponentMatch = block.match(/Proponent[:\s]*<[^>]*>([^<]+)<\/[^>]*>/i);
    const locationMatch = block.match(/Location[:\s]*<[^>]*>([^<]+)<\/[^>]*>/i);
    const decisionMatch = block.match(/Decision[:\s]*<[^>]*>([^<]+)<\/[^>]*>/i);
    const refMatch = block.match(/Reference[:\s]*<[^>]*>(\d+)<\/[^>]*>/i);
    const linkMatch = block.match(/href="([^"]+)"/);

    if (nameMatch) {
      records.push({
        projectName: nameMatch[1].trim().replace(/<[^>]*>/g, ''),
        proponent: proponentMatch ? proponentMatch[1].trim() : undefined,
        location: locationMatch ? locationMatch[1].trim() : undefined,
        decision: decisionMatch ? decisionMatch[1].trim() : undefined,
        iaacReferenceNumber: refMatch ? refMatch[1] : undefined,
        sourceUrl: linkMatch ? new URL(linkMatch[1], IAAC_SOURCES.HOME).href : IAAC_SOURCES.PROJECT_SEARCH,
        sourceSystem: 'iaac-web',
      });
    }
  }

  return records;
}

/**
 * Parse an IAAC project detail page HTML.
 */
function parseIaacDetailHtml(
  html: string,
  refNumber: string,
): RawImpactAssessmentRecord {
  const record: RawImpactAssessmentRecord = {
    iaacReferenceNumber: refNumber,
    sourceUrl: `${IAAC_SOURCES.PROJECT_DETAIL}/${refNumber}`,
    sourceSystem: 'iaac-web',
  };

  const nameMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (nameMatch) record.projectName = nameMatch[1].trim().replace(/<[^>]*>/g, '');

  const proponentMatch = html.match(/Proponent[:\s]*<\/[^>]*>\s*<[^>]*>([^<]+)/i);
  if (proponentMatch) record.proponent = proponentMatch[1].trim();

  const decisionMatch = html.match(/Decision[:\s]*<\/[^>]*>\s*<[^>]*>([^<]+)/i);
  if (decisionMatch) record.decision = decisionMatch[1].trim();

  const dateMatch = html.match(/Decision\s*Date[:\s]*<\/[^>]*>\s*<[^>]*>([^<]+)/i);
  if (dateMatch) record.decisionDate = dateMatch[1].trim();

  const typeMatch = html.match(/Project\s*Type[:\s]*<\/[^>]*>\s*<[^>]*>([^<]+)/i);
  if (typeMatch) record.projectType = typeMatch[1].trim();

  const locationMatch = html.match(/Location[:\s]*<\/[^>]*>\s*<[^>]*>([^<]+)/i);
  if (locationMatch) record.location = locationMatch[1].trim();

  return record;
}

/**
 * Parse a CSV resource from an IAAC CKAN package into raw records.
 */
function parseIaacCsvToRaw(
  csvText: string,
  sourceUrl: string,
): RawImpactAssessmentRecord[] {
  const results: RawImpactAssessmentRecord[] = [];
  const lines = csvText.split('\n').filter(line => line.trim().length > 0);

  if (lines.length < 2) return results;

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const record: RawImpactAssessmentRecord = {
      sourceUrl,
      sourceSystem: 'ckan-csv',
    };

    headers.forEach((header, idx) => {
      const value = values[idx] ?? '';
      const normalizedHeader = header
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toLowerCase();

      switch (normalizedHeader) {
        case 'project_name':
        case 'projectname':
        case 'title':
          record.projectName = value;
          break;
        case 'proponent':
        case 'proponent_name':
        case 'company':
          record.proponent = value;
          break;
        case 'project_type':
        case 'type':
        case 'sector':
          record.projectType = value;
          break;
        case 'location':
          record.location = value;
          break;
        case 'province':
        case 'province_territory':
          record.province = value;
          break;
        case 'decision':
        case 'outcome':
        case 'status':
          record.decision = value;
          break;
        case 'decision_date':
        case 'date':
        case 'assessment_date':
          record.decisionDate = value;
          break;
        case 'conditions_url':
        case 'conditions':
          record.conditionsUrl = value;
          break;
        case 'assessment_report_url':
        case 'report_url':
          record.assessmentReportUrl = value;
          break;
        case 'iaac_reference':
        case 'reference_number':
        case 'ref_number':
          record.iaacReferenceNumber = value;
          break;
        default:
          record[normalizedHeader] = value;
          break;
      }
    });

    results.push(record);
  }

  return results;
}


