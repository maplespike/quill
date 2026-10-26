// SPDX-License-Identifier: AGPL-3.0-only

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { createRateLimiter } from '../../shared/rate-limiter.js';
import { normalizeCountryCode } from '../../shared/country-codes.js';
import { fetchCanadaTradeByPartner, fetchCanadaTotalTrade } from './fetcher.js';
import { parseTradeRecords } from './parser.js';
import { DEFAULT_PARTNERS, DEFAULT_PERIOD } from './constants.js';
import type { TradeFlow } from './types.js';

const rateLimiter = createRateLimiter(100, 60000);

const COMTRADE_COUNTRY_CODES: Record<string, string> = {
  USA: '842',
  GBR: '826',
  CHN: '156',
  MEX: '484',
  JPN: '392',
  DEU: '276',
  FRA: '250',
  IND: '699',
  BRA: '76',
  AUS: '36',
};

function makeAttribution() {
  return buildAttribution('UN Comtrade', {
    sourceUrl: 'https://comtradeplus.un.org',
    attributionText: "No publisher license declaration is attached to this source configuration. Consult UN Comtrade terms for the specific dataset, subscription, and intended use.",
  });
}

function getComtradeCode(country: string): string {
  return COMTRADE_COUNTRY_CODES[country] ?? country;
}

export async function ingestComtrade(partner?: string, year?: number) {
  const { allowed } = rateLimiter.check('un-comtrade');
  if (!allowed) {
    throw new Error('Rate limit exceeded for UN Comtrade API');
  }

  const attribution = makeAttribution();
  const period = year ?? DEFAULT_PERIOD;

  if (partner) {
    const normalizedPartner = normalizeCountryCode(partner);
    if (!normalizedPartner) {
      throw new Error(`Invalid country code: ${partner}`);
    }
    const result = await fetchCanadaTradeByPartner(getComtradeCode(normalizedPartner), period);
    const flows: TradeFlow[] = parseTradeRecords(result.records);
    return withAttribution({ flows, period }, attribution);
  }

  const allFlows: TradeFlow[] = [];
  for (const partnerCode of DEFAULT_PARTNERS) {
    const result = await fetchCanadaTradeByPartner(getComtradeCode(partnerCode), period);
    const flows = parseTradeRecords(result.records);
    allFlows.push(...flows);
  }

  return withAttribution({ flows: allFlows, period }, attribution);
}

export async function getTradeByCommodity(commodityCode: string) {
  const { allowed } = rateLimiter.check('un-comtrade');
  if (!allowed) {
    throw new Error('Rate limit exceeded for UN Comtrade API');
  }

  const result = await fetchCanadaTotalTrade();
  const flows: TradeFlow[] = parseTradeRecords(result.records)
    .filter(f => f.commodityCode.startsWith(commodityCode));

  const attribution = makeAttribution();
  return withAttribution({ commodityCode, flows, period: DEFAULT_PERIOD }, attribution);
}

export type { TradeFlow, HSCode } from './types.js';
