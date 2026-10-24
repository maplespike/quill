// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { ILO_API_BASE, ILO_TIMEOUT_MS, ILO_USER_AGENT } from './constants.js';

interface IloApiResponse {
  data?: Array<{
    indicator?: { label: string };
    source?: { label: string };
    geo?: { label: string; code?: string };
    time?: number;
    value?: number;
    unit?: { label: string };
  }>;
  error?: string;
}

export async function fetchIloIndicator(
  indicatorCode: string,
  country?: string,
): Promise<IloApiResponse> {
  const params = new URLSearchParams();
  if (country) params.set('countries', country);
  params.set('format', 'json');

  const url = `${ILO_API_BASE}/indicator/${indicatorCode}?${params.toString()}`;

  const resp = await httpGet(url, {
    timeoutMs: ILO_TIMEOUT_MS,
    headers: {
      Accept: 'application/json',
      'User-Agent': ILO_USER_AGENT,
    },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`ILO API returned ${resp.statusCode} for indicator ${indicatorCode}`);
  }

  return resp.body as unknown as IloApiResponse;
}
