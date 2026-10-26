// SPDX-License-Identifier: AGPL-3.0-only

import type { CountryCode2 } from '../../shared/country-codes.js';

export interface TradeFlow {
  id: string;
  reporterCode: string;
  partnerCode: string;
  year: number;
  period: number;
  commodityCode: string;
  commodity: string;
  tradeFlow: 'imports' | 'exports';
  value: number;
  netWeight?: number;
}

export interface HSCode {
  code: string;
  description: string;
}

export interface ComtradeRecord {
  rtCode?: string;
  rtTitle?: string;
  ptCode?: string;
  ptTitle?: string;
  yr?: string;
  period?: string;
  aggrLevel?: string;
  rgDesc?: string;
  cc?: string;
  TradeValue?: string;
  Netweight?: string;
  qty?: string;
  altQty?: string;
}

export interface ComtradeApiResponse {
  dataset: ComtradeRecord[];
  validation?: Record<string, unknown>;
}
