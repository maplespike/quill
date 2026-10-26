// Fail the Job when a required backup is missing or older than MAX_AGE_HOURS.
import path from 'node:path';
import { freshness } from './backup-lib.mjs';

const root = process.env.BACKUP_ROOT || '/backups';
const maxAgeHours = Number(process.env.MAX_AGE_HOURS || 26);
const checks = [];
if (process.env.REQUIRE_SQLITE === '1') checks.push(['sqlite', '.db']);
if (process.env.REQUIRE_SEARCH === '1') checks.push(['search', '.tar.gz']);
if (process.env.REQUIRE_POSTGRES === '1') checks.push(['postgres', '.dump']);

if (checks.length === 0) {
  console.error('freshness: no store is required');
  process.exit(1);
}

let failed = false;
for (const [dir, suffix] of checks) {
  const result = freshness(path.join(root, dir), suffix, maxAgeHours);
  if (result.ok) {
    console.log(`freshness: ${dir} ok (${result.newest.name}, ${result.ageHours.toFixed(1)}h)`);
  } else {
    failed = true;
    console.error(`freshness: ${dir} STALE: ${result.reason}`);
  }
}
process.exit(failed ? 1 : 0);
