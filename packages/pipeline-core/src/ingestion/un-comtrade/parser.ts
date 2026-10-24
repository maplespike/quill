// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { ComtradeRecord, TradeFlow } from './types.js';

const TRADE_FLOW_MAP: Record<string, 'imports' | 'exports'> = {
  '1': 'imports',
  '2': 'exports',
};

function parseCommodityCode(raw: string): string {
  return raw?.trim() || '';
}

function parseTradeFlow(raw: string): 'imports' | 'exports' {
  return TRADE_FLOW_MAP[raw] ?? 'imports';
}

export function parseTradeRecord(record: ComtradeRecord): TradeFlow | null {
  const year = parseInt(record.yr ?? '0', 10);
  const period = parseInt(record.period ?? '0', 10);
  const value = parseFloat(record.TradeValue ?? '0');
  const netWeight = record.Netweight ? parseFloat(record.Netweight) : undefined;

  if (year === 0) return null;

  return {
    reporterCode: record.rtCode ?? '',
    partnerCode: record.ptCode ?? '',
    year,
    period,
    commodityCode: parseCommodityCode(record.cc ?? ''),
    commodity: record.aggrLevel ? `HS${record.aggrLevel}` : '',
    tradeFlow: parseTradeFlow(record.rgDesc ?? ''),
    value,
    netWeight,
    id: `${record.rtCode}:${record.ptCode}:${year}:${record.cc}:${record.rgDesc}`,
  };
}

export function parseTradeRecords(records: ComtradeRecord[]): TradeFlow[] {
  const results: TradeFlow[] = [];
  for (const record of records) {
    const parsed = parseTradeRecord(record);
    if (parsed) {
      results.push(parsed);
    }
  }
  return results;
}
