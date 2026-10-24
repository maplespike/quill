// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { DONATIONS_SOURCES, DONATIONS_TIMEOUT_MS, DONATIONS_USER_AGENT } from './constants.js';

export interface DonationFetchResult {
  jurisdiction: string;
  name: string;
  rawDonations: Record<string, unknown>[];
  error?: string;
}

export async function fetchDonations(jurisdiction: string): Promise<DonationFetchResult> {
  const source = DONATIONS_SOURCES.find(s => s.jurisdiction === jurisdiction);
  if (!source) {
    return { jurisdiction, name: '', rawDonations: [], error: `Unknown jurisdiction: ${jurisdiction}` };
  }

  try {
    const resp = await httpGet(source.url, {
      timeoutMs: DONATIONS_TIMEOUT_MS,
      headers: { 'User-Agent': DONATIONS_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { jurisdiction, name: source.name, rawDonations: [], error: `HTTP ${resp.statusCode}` };
    }

    const body = await resp.json() as Record<string, unknown>;
    const donations = (body?.contributions ?? body?.donations ?? body?.results ?? []) as Record<string, unknown>[];
    return { jurisdiction, name: source.name, rawDonations: donations };
  } catch (err) {
    return { jurisdiction, name: source.name, rawDonations: [], error: String(err) };
  }
}

export async function fetchAllDonations(): Promise<DonationFetchResult[]> {
  return Promise.all(DONATIONS_SOURCES.map(s => fetchDonations(s.jurisdiction)));
}
