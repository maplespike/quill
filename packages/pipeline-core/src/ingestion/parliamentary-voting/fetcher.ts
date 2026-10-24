// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { PARLIAMENT_SOURCES, PARLIAMENT_TIMEOUT_MS, PARLIAMENT_USER_AGENT } from './constants.js';

export interface VoteFetchResult {
  chamber: 'house' | 'senate';
  rawVotes: Record<string, unknown>[];
  error?: string;
}

export async function fetchVotes(chamber: 'house' | 'senate'): Promise<VoteFetchResult> {
  const source = PARLIAMENT_SOURCES[chamber];
  try {
    const resp = await httpGet(source.dataEndpoint, {
      timeoutMs: PARLIAMENT_TIMEOUT_MS,
      headers: { 'User-Agent': PARLIAMENT_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { chamber, rawVotes: [], error: `HTTP ${resp.statusCode}` };
    }

    const body = await resp.json() as Record<string, unknown>;
    const votes = (body?.votes ?? body?.results ?? []) as Record<string, unknown>[];
    return { chamber, rawVotes: votes };
  } catch (err) {
    return { chamber, rawVotes: [], error: String(err) };
  }
}

export async function fetchAllVotes(): Promise<VoteFetchResult[]> {
  const [house, senate] = await Promise.all([
    fetchVotes('house'),
    fetchVotes('senate'),
  ]);
  return [house, senate];
}
