// Restore the newest backup into a scratch directory and check it.
// The scratch directory is an emptyDir on the drill Job. This file does not
// write to the production database or the search index.
import path from 'node:path';
import { checkSearchArchive, checkSqliteRestore, listFiles, newest } from './backup-lib.mjs';

const root = process.env.BACKUP_ROOT || '/backups';
const scratch = process.env.SCRATCH_DIR || '/scratch';
let failed = false;

function fail(message) {
  failed = true;
  console.error(`restore: ${message}`);
}

if (process.env.REQUIRE_SQLITE === '1') {
  const hit = newest(listFiles(path.join(root, 'sqlite'), '.db'));
  if (!hit) {
    fail('no sqlite backup to restore');
  } else {
    const result = checkSqliteRestore(hit.full, path.join(scratch, 'sqlite', 'restored.db'));
    if (!result.ok) {
      fail(`${hit.name}: ${result.problems.join('; ')}`);
    } else {
      const rows = Object.values(result.counts).reduce((sum, n) => sum + n, 0);
      console.log(`restore: sqlite ${hit.name} ok (${Object.keys(result.counts).length} tables, ${rows} rows)`);
    }
  }
}

if (process.env.REQUIRE_SEARCH === '1') {
  const hit = newest(listFiles(path.join(root, 'search'), '.tar.gz'));
  if (!hit) {
    fail('no search archive to restore');
  } else {
    const sidecar = hit.full.replace(/\.tar\.gz$/, '.meta.json');
    try {
      const meta = checkSearchArchive({
        archive: hit.full,
        scratchDir: path.join(scratch, 'search'),
        metaSidecar: sidecar,
      });
      console.log(`restore: search ${hit.name} ok (${meta.docs} docs)`);
    } catch (err) {
      fail(err.message);
    }
  }
}

if (process.env.REQUIRE_POSTGRES === '1') {
  const hit = newest(listFiles(path.join(root, 'postgres'), '.dump'));
  if (!hit) fail('no postgres dump to restore');
  else console.log(`restore: postgres dump present (${hit.name}). Load it with the steps in docs/ops/BACKUPS.md.`);
}

if (process.env.REQUIRE_SQLITE !== '1' && process.env.REQUIRE_SEARCH !== '1' && process.env.REQUIRE_POSTGRES !== '1') {
  fail('no store is required');
}

process.exit(failed ? 1 : 0);
