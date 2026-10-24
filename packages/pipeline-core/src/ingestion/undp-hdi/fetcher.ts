// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { UNDP_BASE_URL, UNDP_TIMEOUT_MS, UNDP_USER_AGENT } from './constants.js';

export interface HdiFetchResult {
  hdiValue: number | null;
  rank: number | null;
  error?: string;
}

interface HdiApiRanking {
  country: string;
  country_code: string;
  hdi_2022: number;
  rank_2022: number;
  rank_change?: number;
}

export async function fetchHDIRanking(countryCode = 'CAN'): Promise<HdiFetchResult> {
  try {
    const url = `${UNDP_BASE_URL}/data-center/country/${countryCode}`;
    const resp = await httpGet(url, {
      timeoutMs: UNDP_TIMEOUT_MS,
      headers: { 'User-Agent': UNDP_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { hdiValue: null, rank: null, error: `HTTP ${resp.statusCode}` };
    }

    const html = resp.body;
    const hdiMatch = html.match(/HDI.*?(\d+\.\d{3})/i);
    const rankMatch = html.match(/Rank.*?(\d+)/i);
    const hdiValue = hdiMatch ? parseFloat(hdiMatch[1]) : null;
    const rank = rankMatch ? parseInt(rankMatch[1], 10) : null;

    return { hdiValue, rank };
  } catch (err) {
    return { hdiValue: null, rank: null, error: String(err) };
  }
}

export async function fetchAllHDIRankings(): Promise<HdiApiRanking[]> {
  try {
    const url = `${UNDP_BASE_URL}/api/v1/hdi-rankings`;
    const resp = await httpGet(url, {
      timeoutMs: UNDP_TIMEOUT_MS,
      headers: { 'User-Agent': UNDP_USER_AGENT },
    });

    if (resp.statusCode >= 400) return [];
    const data = (await resp.json()) as HdiApiRanking[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
