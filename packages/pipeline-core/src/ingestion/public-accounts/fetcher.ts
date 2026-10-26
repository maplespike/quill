// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { PUBLIC_ACCOUNTS_SOURCES, PUBLIC_ACCOUNTS_TIMEOUT_MS, PUBLIC_ACCOUNTS_USER_AGENT } from './constants.js';

export interface PublicAccountsFetchResult {
  level: string;
  name: string;
  rawRecords: Record<string, unknown>[];
  error?: string;
}

export async function fetchPublicAccounts(level: string): Promise<PublicAccountsFetchResult> {
  const source = PUBLIC_ACCOUNTS_SOURCES.find(s => s.level === level);
  if (!source) {
    return { level, name: '', rawRecords: [], error: `Unknown level: ${level}` };
  }

  try {
    const resp = await httpGet(source.url, {
      timeoutMs: PUBLIC_ACCOUNTS_TIMEOUT_MS,
      headers: { 'User-Agent': PUBLIC_ACCOUNTS_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { level, name: source.name, rawRecords: [], error: `HTTP ${resp.statusCode}` };
    }

    const body = await resp.json() as Record<string, unknown>;
    const records = (body?.accounts ?? body?.records ?? body?.results ?? []) as Record<string, unknown>[];
    return { level, name: source.name, rawRecords: records };
  } catch (err) {
    return { level, name: source.name, rawRecords: [], error: String(err) };
  }
}

export async function fetchAllPublicAccounts(): Promise<PublicAccountsFetchResult[]> {
  return Promise.all(PUBLIC_ACCOUNTS_SOURCES.map(s => fetchPublicAccounts(s.level)));
}
