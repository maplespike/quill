/**
 * World Bank API Client — MapleSpike Pipeline
 *
 * Typed wrapper around the World Bank Indicators API V2.
 * No authentication required. 16,000+ indicators, 200+ countries.
 *
 * API Reference:
 *   Base:   https://api.worldbank.org/v2
 *   Format: REST (returns [metadata, data] JSON array)
 *   Auth:   None required
 *   Limits: None documented (fair use expected)
 *
 * Data License: World Bank Open License
 * https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets
 */

import { httpGet } from '../../utils/http.js';
import {
  WB_DEFAULT_TIMEOUT_MS,
  wbCountryIndicatorUrl,
  wbIndicatorUrl,
} from './constants.js';
import type {
  WbApiResponse,
  WbIndicatorMeta,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Custom Error Class                                                 */
/* ------------------------------------------------------------------ */

export class WorldBankApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly indicatorCode?: string,
  ) {
    super(message);
    this.name = 'WorldBankApiError';
  }
}

/* ------------------------------------------------------------------ */
/*  Data Fetching                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch indicator data for all countries.
 * Uses GET /indicator/{code}?format=json
 *
 * @param indicatorCode - World Bank indicator code (e.g. "NY.GDP.MKTP.CD")
 * @param options - Optional timeout, per_page override
 */
export async function fetchIndicatorAllCountries(
  indicatorCode: string,
  options: { timeoutMs?: number; perPage?: number } = {},
): Promise<WbApiResponse> {
  const timeoutMs = options.timeoutMs ?? WB_DEFAULT_TIMEOUT_MS;
  const perPage = options.perPage ?? 500;

  try {
    const url = wbIndicatorUrl(indicatorCode, { per_page: String(perPage) });
    const resp = await httpGet(url, {
      headers: { Accept: 'application/json' },
      timeoutMs,
    });

    if (resp.statusCode !== 200) {
      throw new WorldBankApiError(
        `World Bank API returned ${resp.statusCode} for indicator ${indicatorCode}`,
        resp.statusCode,
        indicatorCode,
      );
    }

    const bodyText = resp.body;
    if (!bodyText || bodyText.trim().length === 0) {
      return [{ page: 0, pages: 0, per_page: 0, total: 0, sourceid: '', sourcename: '', lastupdated: '' }, []];
    }

    const raw: unknown = await resp.json();

    if (!Array.isArray(raw) || raw.length < 2) {
      // World Bank returns [metadata, []] when no data
      return [{ page: 0, pages: 0, per_page: 0, total: 0, sourceid: '', sourcename: '', lastupdated: '' }, []];
    }

    const [metadata, records] = raw as WbApiResponse;
    return [metadata, Array.isArray(records) ? records : []];
  } catch (error) {
    if (error instanceof WorldBankApiError) throw error;
    throw new WorldBankApiError(
      `Failed to fetch indicator ${indicatorCode}: ${(error as Error).message}`,
      undefined,
      indicatorCode,
    );
  }
}

/**
 * Fetch indicator data for a specific country.
 * Uses GET /country/{code}/indicator/{indicator}?format=json
 *
 * @param countryCode - ISO-2 country code (e.g. "CA" for Canada)
 * @param indicatorCode - World Bank indicator code
 * @param options - Optional timeout
 */
export async function fetchIndicatorByCountry(
  countryCode: string,
  indicatorCode: string,
  options: { timeoutMs?: number } = {},
): Promise<WbApiResponse> {
  const timeoutMs = options.timeoutMs ?? WB_DEFAULT_TIMEOUT_MS;

  try {
    const url = wbCountryIndicatorUrl(countryCode, indicatorCode);
    const resp = await httpGet(url, {
      headers: { Accept: 'application/json' },
      timeoutMs,
    });

    if (resp.statusCode !== 200) {
      throw new WorldBankApiError(
        `World Bank API returned ${resp.statusCode} for ${countryCode}/${indicatorCode}`,
        resp.statusCode,
        indicatorCode,
      );
    }

    const raw: unknown = await resp.json();

    if (!Array.isArray(raw) || raw.length < 2) {
      return [{ page: 0, pages: 0, per_page: 0, total: 0, sourceid: '', sourcename: '', lastupdated: '' }, []];
    }

    const [metadata, records] = raw as WbApiResponse;
    return [metadata, Array.isArray(records) ? records : []];
  } catch (error) {
    if (error instanceof WorldBankApiError) throw error;
    throw new WorldBankApiError(
      `Failed to fetch ${countryCode}/${indicatorCode}: ${(error as Error).message}`,
      undefined,
      indicatorCode,
    );
  }
}

/**
 * Fetch indicator metadata (name, source, topics).
 * Uses GET /indicator/{code}?format=json&per_page=1
 */
export async function fetchIndicatorMetadata(
  indicatorCode: string,
  options: { timeoutMs?: number } = {},
): Promise<WbIndicatorMeta | null> {
  const timeoutMs = options.timeoutMs ?? WB_DEFAULT_TIMEOUT_MS;

  try {
    const url = wbIndicatorUrl(indicatorCode, { per_page: '1', date: '2020' });
    const resp = await httpGet(url, {
      headers: { Accept: 'application/json' },
      timeoutMs,
    });

    if (resp.statusCode !== 200) return null;

    const raw: unknown = await resp.json();
    if (!Array.isArray(raw) || raw.length < 2) return null;

    // The second element may contain metadata in the indicator field
    const records = raw[1];
    if (!Array.isArray(records) || records.length === 0) return null;

    const first = records[0] as Record<string, unknown>;
    if (first.indicator && typeof first.indicator === 'object') {
      const ind = first.indicator as Record<string, unknown>;
      return {
        id: String(ind.id ?? ''),
        name: String(ind.value ?? ''),
        unit: '',
        source: { id: '2', value: 'World Bank' },
        sourceNote: '',
        sourceOrganization: 'World Bank',
        topics: [],
      };
    }

    return null;
  } catch {
    return null;
  }
}
