// Daily SQLite backup. VACUUM INTO uses SQLite's online backup API, so the
// API and the ingest jobs can keep the source file open. The snapshot is
// written to emptyDir scratch, verified (PRAGMA integrity_check + sha256),
// then copied to the backups mount.
import { backupSqliteFile } from './backup-lib.mjs';

const sourcePath = process.env.QUILL_DB_PATH;
const destDir = process.env.BACKUP_DIR || '/backups/sqlite';
const scratchDir = process.env.SCRATCH_DIR || '/scratch';
const backupsMount = process.env.BACKUPS_MOUNT || '/backups';
const retentionDays = Number(process.env.RETENTION_DAYS || 14);
const label = process.env.BACKUP_LABEL || 'maplespike';

try {
  const result = backupSqliteFile({
    sourcePath,
    destDir,
    scratchDir,
    backupsMount,
    retentionDays,
    label,
  });
  const tables = Object.keys(result.counts).length;
  console.log(`sqlite backup: wrote ${result.dest} (${tables} tables, sha256 ${result.sha256})`);
  if (result.removed.length > 0) {
    console.log(`sqlite backup: pruned ${result.removed.join(', ')}`);
  }
} catch (err) {
  console.error(`sqlite backup: ${err.message}`);
  process.exit(1);
}
