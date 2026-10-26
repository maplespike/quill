// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import {
  COMTRADE_BASE_URL,
  COMTRADE_TIMEOUT_MS,
  COMTRADE_USER_AGENT,
  DEFAULT_PERIOD,
} from './constants.js';
import type { ComtradeApiResponse, ComtradeRecord } from './types.js';

interface ComtradeQueryParams {
  reporterCode: string;
  partnerCode?: string;
  period: number;
  commodityCode?: string;
  flowCode?: 'M' | 'X';
  partner2Code?: string;
}

function buildComtradeUrl(params: ComtradeQueryParams): string {
  const base = `${COMTRADE_BASE_URL}/get`;
  const query = new URLSearchParams({
    type: 'C',
    freq: 'A',
    px: 'HS',
    ps: String(params.period),
    r: params.reporterCode,
    p: params.partnerCode ?? '0',
    rg: 'all',
    cc: params.commodityCode ?? 'AG1',
    fmt: 'json',
  });
  return `${base}?${query.toString()}`;
}

export interface ComtradeFetchResult {
  records: ComtradeRecord[];
  error?: string;
}

export async function fetchComtradeData(
  params: ComtradeQueryParams,
): Promise<ComtradeFetchResult> {
  const url = buildComtradeUrl(params);

  try {
    const resp = await httpGet(url, {
      timeoutMs: COMTRADE_TIMEOUT_MS,
      headers: { 'User-Agent': COMTRADE_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { records: [], error: `HTTP ${resp.statusCode}` };
    }

    const body = (await resp.json()) as ComtradeApiResponse;
    if (!body?.dataset) {
      return { records: [] };
    }

    return { records: body.dataset };
  } catch (err) {
    return { records: [], error: String(err) };
  }
}

export async function fetchCanadaTradeByPartner(
  partnerCode: string,
  year?: number,
): Promise<ComtradeFetchResult> {
  return fetchComtradeData({
    reporterCode: 'CAN',
    partnerCode,
    period: year ?? DEFAULT_PERIOD,
  });
}

export async function fetchCanadaTotalTrade(
  year?: number,
): Promise<ComtradeFetchResult> {
  return fetchComtradeData({
    reporterCode: 'CAN',
    period: year ?? DEFAULT_PERIOD,
  });
}
