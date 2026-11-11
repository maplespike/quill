// SPDX-License-Identifier: AGPL-3.0-only

import { LOG_TTL_MS, METADATA_TTL_MS } from './constants.js';
import type { AdmittedSchedule13dgRecord, LogReason, OperationalLog, RecordLineage, Tombstone } from './types.js';

export interface MetadataRow {
  id: string;
  storedAt: number;
  payload: AdmittedSchedule13dgRecord;
}

/**
 * Sanitized operational logs expire at the 7-day boundary.
 * A log whose age is equal to the TTL is deleted.
 */
export function applyLogRetention(logs: readonly OperationalLog[], now: number): OperationalLog[] {
  return logs.filter((log) => now - log.at < LOG_TTL_MS);
}

/** Deletes expired log rows in the caller's array. */
export function deleteExpiredLogs(logs: OperationalLog[], now: number): void {
  const kept = applyLogRetention(logs, now);
  logs.length = 0;
  logs.push(...kept);
}

/**
 * The 365-day window runs only when future enablement is cleared.
 * When it is not cleared, every metadata row is deleted.
 * A cleared row whose age is equal to the TTL is deleted.
 */
export function applyMetadataRetention(
  rows: readonly MetadataRow[],
  now: number,
  futureEnablementCleared: boolean,
): MetadataRow[] {
  if (!futureEnablementCleared) return [];
  return rows.filter((row) => now - row.storedAt < METADATA_TTL_MS);
}

/** Deletes metadata rows in the caller's array. An uncleared window deletes every row. */
export function deleteExpiredMetadata(
  rows: MetadataRow[],
  now: number,
  futureEnablementCleared: boolean,
): void {
  const kept = applyMetadataRetention(rows, now, futureEnablementCleared);
  rows.length = 0;
  rows.push(...kept);
}

export function writeMetadata(
  rows: readonly MetadataRow[],
  row: MetadataRow,
  futureEnablementCleared: boolean,
): { ok: true; rows: MetadataRow[] } | { ok: false; reason: 'future-enablement-not-cleared'; rows: MetadataRow[] } {
  if (!futureEnablementCleared) {
    return { ok: false, reason: 'future-enablement-not-cleared', rows: [...rows] };
  }
  return { ok: true, rows: [...rows, row] };
}

export function toTombstone(
  accession: string,
  reason: Tombstone['reason'],
  dates: { eventDateAsReported: string | null; filedDate: string | null },
  scrub: { scrub: Tombstone['scrub']; storesRemaining: readonly string[]; storedAt: number; lineage: RecordLineage | null },
): Tombstone {
  return {
    accession,
    hidden: true,
    reason,
    payload: null,
    eventDateAsReported: dates.eventDateAsReported,
    filedDate: dates.filedDate,
    scrub: scrub.scrub,
    storesRemaining: [...scrub.storesRemaining],
    storedAt: scrub.storedAt,
    lineage: scrub.lineage
      ? {
        issuerCik: scrub.lineage.issuerCik,
        classTitleAsFiled: scrub.lineage.classTitleAsFiled,
        filerCiks: [...scrub.lineage.filerCiks],
      }
      : null,
  };
}

const LOG_REASONS: ReadonlySet<string> = new Set<LogReason>([
  'network-refused',
  'non-synthetic-accession',
  'parse-failed',
  'out-of-scope',
  'ambiguous-issuer',
  'ambiguous-class',
  'individual',
  'mixed',
  'unknown',
  'eligibility-not-reviewed',
  'eligibility-rejected',
  'duplicate',
  'conflict',
  'withdrawn',
  'corrected',
  'stale',
  'kill-switch',
  'store-incomplete',
  'persistence-refused',
  'store-unverified',
  'lineage-conflict',
  'tombstoned-accession',
  'prior-scrub-incomplete',
]);

/** Keep a reason code only. Anything else becomes `unknown` so raw text cannot be logged. */
export function sanitizeLogReason(reason: string): LogReason {
  return LOG_REASONS.has(reason) ? reason as LogReason : 'unknown';
}
