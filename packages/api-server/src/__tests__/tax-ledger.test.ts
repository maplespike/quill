// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Tax Ledger Tests (#811 — GST/HST taxable-revenue tracker)
 *
 * Covers:
 *   1. Ledger semantics — charges, refunds, net computation (MemoryStorage + NodeSqliteStorage).
 *   2. Idempotency — replayed Stripe event IDs record exactly once.
 *   3. Windowing — entries outside the rolling window are excluded.
 *   4. Threshold assessment — ok / approaching (80%) / breached boundaries.
 *   5. Alert escalation — fires on ok→approaching→breached transitions only.
 *   6. computeHst — zero tax while unregistered; 13% ON HST once registered.
 *   7. recordTaxEvent — webhook capture mapping incl. skip/duplicate results.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { MemoryStorage } from '../storage.js';
import { NodeSqliteStorage } from '../node-sqlite-storage.js';
import {
  GST_HST_THRESHOLD_CENTS,
  GST_HST_ALERT_CENTS,
  assessTaxThreshold,
  assessAndAlert,
  resetTaxAlertState,
  computeHst,
  recordTaxEvent,
  taxWindowStartUnix,
} from '../tax-ledger.js';
import type { TaxLedgerSummary } from '../types.js';

function summaryOf(netCents: number): TaxLedgerSummary {
  return {
    grossCents: Math.max(netCents, 0),
    refundsCents: Math.max(-netCents, 0),
    netCents,
    netCad: netCents / 100,
    windowStartUnix: taxWindowStartUnix(),
    lastEventId: null,
    entryCount: 1,
  };
}

describe('tax-ledger (#811) — pure assessment', () => {
  it('threshold and alert constants match #811 acceptance', () => {
    assert.equal(GST_HST_THRESHOLD_CENTS, 3_000_000); // $30,000
    assert.equal(GST_HST_ALERT_CENTS, 2_400_000); // 80% checkpoint
  });

  it('status ok below the 80% checkpoint', () => {
    const a = assessTaxThreshold(summaryOf(100_000)); // $1,000
    assert.equal(a.status, 'ok');
    assert.equal(a.alert, false);
  });

  it('status approaching at exactly the 80% checkpoint', () => {
    const a = assessTaxThreshold(summaryOf(GST_HST_ALERT_CENTS));
    assert.equal(a.status, 'approaching');
  });

  it('status breached at the threshold', () => {
    const a = assessTaxThreshold(summaryOf(GST_HST_THRESHOLD_CENTS));
    assert.equal(a.status, 'breached');
    assert.match(a.message, /register/i);
  });

  describe('computeHst', () => {
    beforeEach(() => {
      delete process.env.GST_HST_REGISTERED;
    });

    it('adds NO tax while unregistered (#811 hard requirement)', () => {
      const r = computeHst(5000);
      assert.equal(r.taxCents, 0);
      assert.equal(r.totalCents, 5000);
      assert.equal(r.registered, false);
    });

    it('adds 13% ON HST when registered', () => {
      const r = computeHst(5000, { registered: true });
      assert.equal(r.taxCents, 650);
      assert.equal(r.totalCents, 5650);
    });
  });
});

describe('tax-ledger (#811) — storage-backed semantics', () => {
  beforeEach(() => {
    resetTaxAlertState();
    delete process.env.GST_HST_REGISTERED;
  });

  it('charges net against refunds; replayed event IDs record once (MemoryStorage)', async () => {
    const db = new MemoryStorage();
    assert.equal(await recordTaxEvent(db, { eventId: 'evt_1', entryType: 'charge', amountCents: 5000, currency: 'CAD' }), 'recorded');
    assert.equal(await recordTaxEvent(db, { eventId: 'evt_1', entryType: 'charge', amountCents: 5000, currency: 'CAD' }), 'duplicate');
    assert.equal(await recordTaxEvent(db, { eventId: 'evt_2', entryType: 'refund', amountCents: -2000, currency: 'CAD' }), 'recorded');
    assert.equal(await recordTaxEvent(db, { eventId: 'evt_3', entryType: 'charge', amountCents: 0, currency: 'CAD' }), 'skipped');

    const s = await db.getTaxLedgerSummary(taxWindowStartUnix());
    assert.equal(s.grossCents, 5000);
    assert.equal(s.refundsCents, 2000);
    assert.equal(s.netCents, 3000);
    assert.equal(s.entryCount, 2);
  });

  it('window excludes pre-window entries (NodeSqliteStorage)', async () => {
    const dbPath = path.join(os.tmpdir(), `quill-tax-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    const cleanup = () => {
      for (const suffix of ['', '-wal', '-shm']) {
        try { fs.unlinkSync(dbPath + suffix); } catch { /* ignore */ }
      }
    };
    try {
      const db = new NodeSqliteStorage(dbPath);
      const now = Math.floor(Date.now() / 1000);
      await db.insertTaxLedgerEntry({ id: 'old', entryType: 'charge', amountCents: 999999, currency: 'CAD', createdAt: now - 400 * 24 * 60 * 60 });
      await db.insertTaxLedgerEntry({ id: 'new', entryType: 'charge', amountCents: 10000, currency: 'CAD', createdAt: now });
      const s = await db.getTaxLedgerSummary(taxWindowStartUnix(now));
      assert.equal(s.netCents, 10000);
      assert.equal(s.entryCount, 1);
    } finally {
      cleanup();
    }
  });

  it('escalation alerts fire once per status transition', async () => {
    resetTaxAlertState();
    // Start below checkpoint.
    const s1 = summaryOf(1_000_000);
    const a1 = assessAndAlert(s1);
    assert.equal(a1.status, 'ok');
    assert.equal(a1.alert, false);
    // Cross 80%: alert fires once.
    const s2 = summaryOf(2_500_000);
    const a2 = assessAndAlert(s2);
    assert.equal(a2.status, 'approaching');
    assert.equal(a2.alert, true);
    // Same status again: no repeat alert.
    const a3 = assessAndAlert(summaryOf(2_600_000));
    assert.equal(a3.status, 'approaching');
    assert.equal(a3.alert, false);
    // Breach: alert fires again.
    const a4 = assessAndAlert(summaryOf(3_100_000));
    assert.equal(a4.status, 'breached');
    assert.equal(a4.alert, true);
  });

  it('adjustment entries contribute signed amounts (dedupe by id)', async () => {
    const db = new MemoryStorage();
    await db.insertTaxLedgerEntry({ id: 'adj-1', entryType: 'adjustment', amountCents: -1500, currency: 'CAD', note: 'manual refund reconciliation' });
    await db.insertTaxLedgerEntry({ id: 'adj-1', entryType: 'adjustment', amountCents: -1500, currency: 'CAD', note: 'retry' }).catch(() => {});
    const s = await db.getTaxLedgerSummary(taxWindowStartUnix());
    assert.equal(s.netCents, -1500);
  });
});
