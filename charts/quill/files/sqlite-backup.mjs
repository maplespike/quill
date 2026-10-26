// Daily SQLite backup. VACUUM INTO uses SQLite's online backup API, so the
// API and the ingest jobs can keep the source file open.
import { backupSqliteFile } from './backup-lib.mjs';

const sourcePath = process.env.QUILL_DB_PATH;
const destDir = process.env.BACKUP_DIR || '/backups/sqlite';
const retentionDays = Number(process.env.RETENTION_DAYS || 14);
const label = process.env.BACKUP_LABEL || 'maplespike';

try {
  const result = backupSqliteFile({ sourcePath, destDir, retentionDays, label });
  const tables = Object.keys(result.counts).length;
  console.log(`sqlite backup: wrote ${result.dest} (${tables} tables)`);
  if (result.removed.length > 0) {
    console.log(`sqlite backup: pruned ${result.removed.join(', ')}`);
  }
} catch (err) {
  console.error(`sqlite backup: ${err.message}`);
  process.exit(1);
}
