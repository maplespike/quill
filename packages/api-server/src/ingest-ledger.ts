/**
 * Quill — Ingestion freshness ledger
 *
 * Why this exists (#889 / production-readiness 2026-09-22):
 * `/v1/data/quality` computes freshness correctly, but its input came only from
 * the pipeline-core HealthMonitor singleton — which lives INSIDE the API
 * process, and the API never ingests. So every module reported
 * `freshnessStatus: 'unknown'` and the deployed endpoint showed
 * `fresh: 0, stale: 0`: the API could serve data with no way to say whether it
 * was current.
 *
 * The ledger is the missing shared state: an ingestion run records its outcome
 * here (success/failure, timestamp, record count, error) and the API reads it
 * back when reporting quality. One writer per run, one small JSON file, atomic
 * replace — no schema migration, and it survives pod restarts (unlike the
 * in-process singleton).
 */

import fs from 'node:fs';
import path from 'node:path';

export interface IngestEvent {
  /** Registry module name, e.g. "statcan-wds" */
  module: string;
  status: 'success' | 'failure';
  /** ISO timestamp; defaults to now */
  at?: string;
  /** Records written by this run */
  records?: number;
  /** Error message when status is 'failure' */
  error?: string;
}

export interface IngestLedgerEntry {
  lastSuccess: string | null;
  lastError: string | null;
  lastErrorMessage: string | null;
  records: number;
  runs: number;
  failures: number;
}

/**
 * Where the ledger lives: beside the SQLite database so it rides the same
 * volume the API already writes. Overridable for tests and for deployments
 * that keep data elsewhere.
 */
export function ledgerFilePath(override?: string): string {
  if (override) return override;
  if (process.env.QUILL_INGEST_LEDGER) return process.env.QUILL_INGEST_LEDGER;
  const dbPath = process.env.QUILL_DB_PATH || './quill.db';
  return path.join(path.dirname(dbPath), 'ingest-ledger.json');
}

/** Read the ledger. A missing or corrupt file yields {} — never a throw. */
export function readLedger(file?: string): Record<string, IngestLedgerEntry> {
  const target = ledgerFilePath(file);
  try {
    const raw = fs.readFileSync(target, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, IngestLedgerEntry>;
  } catch (err) {
    // ENOENT is the normal first-run case; anything else is worth a word.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[ingest-ledger] unreadable (${target}): ${(err as Error).message} — treating as empty`);
    }
    return {};
  }
}

/**
 * Record one ingestion outcome and persist atomically (temp file + rename), so
 * a crash mid-write can never leave a half-written ledger.
 */
export function recordIngest(event: IngestEvent, file?: string): IngestLedgerEntry {
  const target = ledgerFilePath(file);
  const ledger = readLedger(target);
  const at = event.at ?? new Date().toISOString();
  const prev: IngestLedgerEntry =
    ledger[event.module] ??
    { lastSuccess: null, lastError: null, lastErrorMessage: null, records: 0, runs: 0, failures: 0 };

  const next: IngestLedgerEntry = {
    lastSuccess: event.status === 'success' ? at : prev.lastSuccess,
    lastError: event.status === 'failure' ? at : prev.lastError,
    lastErrorMessage: event.status === 'failure' ? (event.error ?? 'unknown error') : prev.lastErrorMessage,
    records: event.status === 'success' ? (event.records ?? prev.records) : prev.records,
    runs: prev.runs + 1,
    failures: prev.failures + (event.status === 'failure' ? 1 : 0),
  };

  ledger[event.module] = next;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, target);
  return next;
}

/** One module's ledger entry, or null when it has never reported. */
export function getIngestRecord(moduleName: string, file?: string): IngestLedgerEntry | null {
  return readLedger(file)[moduleName] ?? null;
}
