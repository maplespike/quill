/**
 * Child side of the WAL reader regression test.
 *
 * Protocol on stdout, one line each, flushed with writeSync so the parent
 * observes them before this process blocks inside the write retry:
 *   LOAD <json>
 *   BUSY
 *   SAVE <json>
 *
 * The parent holds a write transaction across LOAD. BUSY is the barrier:
 * the parent commits only after this process has observed the lock.
 */
import { writeSync } from 'node:fs';
import {
  loadMunicipalRecordCache,
  saveMunicipalRecordCache,
  setMunicipalCacheWriteLockHook,
} from '../municipal.ts';

const loaded = loadMunicipalRecordCache('toronto', 'budget');
writeSync(1, `LOAD ${JSON.stringify(loaded)}\n`);

setMunicipalCacheWriteLockHook(() => {
  writeSync(1, 'BUSY\n');
});

saveMunicipalRecordCache(
  'toronto',
  '311-calls',
  'https://open.toronto.ca',
  [{ id: '311a', title: 'Pothole complaint' }],
);

const saved = loadMunicipalRecordCache('toronto', '311-calls');
writeSync(1, `SAVE ${JSON.stringify(saved)}\n`);
