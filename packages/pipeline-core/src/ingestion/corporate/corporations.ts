/**
 * Corporations Canada Registry Connector — Quill
 *
 * Searches the Corporations Canada online registry for federal corporate
 * entity information.
 *
 * Corporations Canada is part of Innovation, Science and Economic
 * Development Canada (ISED). The registry provides access to federal
 * corporation data including legal name, status, jurisdiction,
 * incorporation date, and registered office address.
 *
 * Search URL: https://ised-isde.canada.ca/cc/lc/gcrecherche-recherche.html
 *
 * Pipeline:
 *   1. Search by entity name
 *   2. Parse HTML results tables
 *   3. Normalize to CorporateEntity schema
 *   4. Persist to database (or return structured data)
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import { CORPORATE_SOURCES } from './constants.js';
import type { HttpResponse } from '../../utils/http.js';
import type { CorporateEntity, CorporateIngestionResult } from './types.js';
import type { D1Database } from '../committees/db.js';


export class CorporationsCanadaFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'CorporationsCanadaFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
} as const;


/**
 * Raw result from a Corporations Canada lookup.
 */
export interface RawCorporateSearchResult {
  /** Federal corporation number */
  corporationNumber: string;
  /** Legal name */
  legalName: string;
  /** Operating/business names */
  operatingNames: string[];
  /** Jurisdiction code / governing act */
  jurisdiction: string;
  /** Status text (e.g. Active, Dissolved) */
  status: string;
  /** Type of corporation */
  corporationType: string;
  /** Incorporation (or continuance) date from the activity history */
  incorporationDate: string | null;
  /** Registered office address, flattened */
  officeAddress: string | null;
  /** Most recent annual-return year of filing */
  lastAnnualReturn: string | null;
  /** Source URL */
  sourceUrl: string;
}

/** Corporation ids fetched per run. */
export const CORPORATIONS_PAGE_LIMIT = 50;
/** First corporation id in the default sweep. */
export const CORPORATIONS_DEFAULT_START_ID = 1000;

/**
 * Fetch one federal corporation from the Corporations Canada JSON API.
 *
 * The HTML search page this module used to scrape is JS-driven and answers
 * 302 with no result table, so it yielded nothing. ISED publishes a documented
 * JSON API keyed by corporation number; verified 200 for id 1007.
 */
export async function fetchFederalCorporation(
  corporationId: string,
): Promise<RawCorporateSearchResult> {
  const url = CORPORATE_SOURCES.CORPORATIONS.API_TEMPLATE.replace(
    '{id}',
    encodeURIComponent(corporationId),
  );

  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS as Record<string, string>, Accept: 'application/json' },
    timeoutMs: 20_000,
  });

  if (resp.statusCode >= 400) {
    throw new CorporationsCanadaFetchError(
      `HTTP ${resp.statusCode} fetching corporation ${corporationId}`,
      resp.statusCode,
      url,
    );
  }

  const body: any = JSON.parse(resp.body);
  const record = Array.isArray(body) ? body[0] : body;
  if (!record || record.corporationId === undefined) {
    throw new CorporationsCanadaFetchError(
      `no corporation payload for id ${corporationId}`,
      undefined,
      url,
    );
  }

  return parseFederalCorporation(record, url);
}

/**
 * Map the ISED corporation JSON onto the internal raw shape.
 *
 * Payload fields (see Corporations Canada JSON dataset docs):
 *   corporationId, act, status, corporationNames[].CorporationName{name,nameType,current},
 *   adresses[].address{addressLine[],city,provinceCode,postalCode,current},
 *   annualReturns[].annualReturn{yearOfFiling}, activities[].activity{activity,date}
 */
export function parseFederalCorporation(
  record: any,
  sourceUrl: string,
): RawCorporateSearchResult {
  const corporationNumber = String(record.corporationId);

  const names: { name: string; nameType: string }[] = (record.corporationNames ?? [])
    .map((n: any) => n?.CorporationName)
    .filter((n: any) => n && typeof n.name === 'string')
    .map((n: any) => ({ name: n.name.trim(), nameType: String(n.nameType ?? '') }));

  const legalName =
    names.find(n => n.nameType.toLowerCase() === 'primary')?.name ??
    names[0]?.name ??
    `Corporation ${corporationNumber}`;
  const operatingNames = names
    .filter(n => n.name !== legalName)
    .map(n => n.name);

  const address: any = (record.adresses ?? [])
    .map((a: any) => a?.address)
    .find((a: any) => a && (a.current === undefined || a.current === true)) ??
    (record.adresses ?? [])[0]?.address;

  const officeAddress = address
    ? [
        ...(Array.isArray(address.addressLine) ? address.addressLine : [address.addressLine]),
        address.city,
        address.provinceCode,
        address.postalCode,
      ]
        .filter(Boolean)
        .join(', ')
    : null;

  const activities: any[] = (record.activities ?? []).map((a: any) => a?.activity).filter(Boolean);
  const incorporation =
    activities.find(a => /incorporation|continuance/i.test(String(a.activity))) ?? activities[0];

  const annualReturns: any[] = (record.annualReturns ?? [])
    .map((a: any) => a?.annualReturn)
    .filter(Boolean);

  return {
    corporationNumber,
    legalName,
    operatingNames,
    jurisdiction: record.act ?? 'Federal',
    status: record.status ?? 'Unknown',
    corporationType: record.act ?? '',
    incorporationDate: incorporation?.date ?? null,
    officeAddress,
    lastAnnualReturn: annualReturns[0]?.yearOfFiling ?? null,
    sourceUrl,
  };
}


/**
 * Normalize a raw corporate search result into a CorporateEntity.
 */
async function normalizeCorporateEntity(
  raw: RawCorporateSearchResult,
): Promise<CorporateEntity> {
  const contentForHash = JSON.stringify({
    corporationNumber: raw.corporationNumber,
    legalName: raw.legalName,
    jurisdiction: raw.jurisdiction,
    status: raw.status,
    sourceUrl: raw.sourceUrl,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    corporationNumber: raw.corporationNumber,
    legalName: raw.legalName,
    operatingNames: raw.operatingNames,
    jurisdiction: raw.jurisdiction,
    status: raw.status,
    incorporationDate: raw.incorporationDate ?? null,
    officeAddress: raw.officeAddress ?? null,
    directors: [],
    lastAnnualReturn: raw.lastAnnualReturn ?? null,
    sourceUrl: raw.sourceUrl,
    ingestedAt: new Date().toISOString(),
  };
}


/**
 * Ingest corporate entity data from Corporations Canada.
 */
export async function ingestCorporationsCanada(
  db: D1Database | null,
  options: {
    /** Search query */
    query?: string;
    /** Limit results */
    limit?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<CorporateIngestionResult> {
  const startTime = Date.now();
  const result: CorporateIngestionResult = {
    source: 'corporations-canada',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // The JSON API is keyed by corporation number, so the "search" is a sweep
    // over a bounded id range. Ids without a record are 404s and are counted,
    // not treated as an outage.
    const startId = options.query ? parseInt(options.query, 10) : CORPORATIONS_DEFAULT_START_ID;
    const count = options.limit ?? CORPORATIONS_PAGE_LIMIT;
    const firstId = isNaN(startId) ? CORPORATIONS_DEFAULT_START_ID : startId;
    log(`[CorporationsCanada] Fetching ${count} corporation(s) from id ${firstId}...`);

    const searchResults: RawCorporateSearchResult[] = [];
    let missing = 0;

    for (let i = 0; i < count; i++) {
      const id = String(firstId + i);
      try {
        searchResults.push(await fetchFederalCorporation(id));
      } catch (err) {
        const status = err instanceof CorporationsCanadaFetchError ? err.statusCode : undefined;
        if (status === 404) {
          missing++;
          continue;
        }
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Corporation ${id}: ${msg}`);
      }
    }

    result.recordsFound = searchResults.length;
    log(`[CorporationsCanada] Found ${searchResults.length} corporate entities (${missing} id(s) not in the registry)`);

    if (searchResults.length === 0) {
      log('[CorporationsCanada] No results found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Normalize records
    const entities: CorporateEntity[] = [];
    for (const raw of searchResults) {
      try {
        const entity = await normalizeCorporateEntity(raw);
        entities.push(entity);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Normalize ${raw.corporationNumber}: ${msg}`);
      }
    }

    log(`[CorporationsCanada] Normalized ${entities.length} entities`);

    // Apply limit
    const limited = options.limit ? entities.slice(0, options.limit) : entities;
    result.recordsFound = limited.length;

    // Persist or return
    if (db) {
      let ingested = 0;
      for (const entity of limited) {
        try {
          await db.prepare(`
            INSERT OR REPLACE INTO corporate_entities
              (corporation_number, legal_name, operating_names, jurisdiction,
               status, incorporation_date, office_address, directors,
               last_annual_return, source_url, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            entity.corporationNumber,
            entity.legalName,
            Array.isArray(entity.operatingNames) ? entity.operatingNames.join('; ') : entity.operatingNames,
            entity.jurisdiction,
            entity.status,
            entity.incorporationDate,
            entity.officeAddress,
            Array.isArray(entity.directors) ? entity.directors.join('; ') : entity.directors,
            entity.lastAnnualReturn,
            entity.sourceUrl,
            entity.ingestedAt,
          ).run();
          ingested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${entity.corporationNumber}: ${msg}`);
        }
      }
      result.recordsIngested = ingested;
      log(`[CorporationsCanada] Persisted ${ingested} entities`);
    } else {
      result.recordsIngested = limited.length;
      result.records = limited;
      log(`[CorporationsCanada] Dry-run — ${limited.length} entities available`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[CorporationsCanada] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}
