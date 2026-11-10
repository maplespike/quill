// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — National Defence Data Ingestion
 *
 * Real CKAN-based ingestion for DND/CAF personnel and procurement data.
 */

import { DND_DDL } from './constants.js';
import { fetchRegularForcePersonnel, fetchDefenceProcurement } from './fetcher.js';
import type { DefenceIngestionResult } from './types.js';
import type { D1Database } from '../committees/db.js';

export async function ingestAllDefence(
  db: D1Database | null,
  options: { onProgress?: (msg: string) => void } = {},
): Promise<DefenceIngestionResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let total = 0;
  const log = options.onProgress || (() => {});

  if (db) try { await db.exec(DND_DDL); log('Defence table ready'); } catch (err) {
    console.warn(`[Defence] Failed to init table: ${(err as Error).message}`);
  }

  try {
    log('Fetching DND Regular Force personnel...');
    const records = await fetchRegularForcePersonnel();
    log(`  → ${records.length} personnel records`);
    total += records.length;
    if (db && records.length > 0) {
      for (const r of records.slice(0, 500)) {
        await db.prepare(`INSERT INTO defence_records (source, record_date, category, value) VALUES (?, ?, ?, ?)`)
          .bind('dnd-personnel', `${r.year}-${String(r.month).padStart(2,'0')}`, `rank:${r.rank}:${r.component}`, r.count)
          .run();
      }
    }
  } catch (err) { errors.push(`Personnel: ${err instanceof Error ? err.message : 'unknown'}`); }

  try {
    log('Fetching defence procurement...');
    const records = await fetchDefenceProcurement();
    log(`  → ${records.length} procurement records`);
    total += records.length;
  } catch (err) { errors.push(`Procurement: ${err instanceof Error ? err.message : 'unknown'}`); }

  return { source: 'defence', recordsIngested: total, errors, durationMs: Date.now() - startTime };
}

export type { DndPersonnelRecord, DndProcurementRecord, DefenceIngestionResult } from './types.js';
