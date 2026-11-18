// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('un-comtrade Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestComtrade, 'function');
    assert.equal(typeof mod.getTradeByCommodity, 'function');
  });

  it('parser parses trade records correctly', async () => {
    const { parseTradeRecord } = await import('../parser.js');
    const mockRecord = {
      rtCode: '124',
      rtTitle: 'Canada',
      ptCode: '842',
      ptTitle: 'USA',
      yr: '2022',
      period: '2022',
      aggrLevel: '2',
      rgDesc: '1',
      cc: '270900',
      TradeValue: '5000000',
      Netweight: '1000000',
    };
    const result = parseTradeRecord(mockRecord as any);
    assert.ok(result);
    assert.equal(result?.year, 2022);
    assert.equal(result?.tradeFlow, 'imports');
    assert.equal(result?.value, 5000000);
    assert.equal(result?.netWeight, 1000000);
    assert.ok(result?.id);
  });

  it('parser returns null for invalid record', async () => {
    const { parseTradeRecord } = await import('../parser.js');
    const result = parseTradeRecord({} as any);
    assert.equal(result, null);
  });
});
