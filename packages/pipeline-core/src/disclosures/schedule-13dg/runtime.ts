// SPDX-License-Identifier: AGPL-3.0-only

import { KILL_SWITCH_DEFAULT_ENGAGED, LIVE_INGEST_IMPLEMENTED, SOURCE_ID } from './constants.js';
import { canonicalRecord, evaluateFiling } from './evaluate.js';
import { deleteExpiredLogs, toTombstone } from './retention.js';
import type {
  AdmittedSchedule13dgRecord,
  Evaluation,
  ExclusionReason,
  OperationalLog,
  ReviewedEntityEligibility,
  SecondaryStore,
  Tombstone,
} from './types.js';

export class Schedule13dgDisabledError extends Error {
  readonly code = 'live-ingest-disabled';

  constructor() {
    super('live-ingest-disabled');
    this.name = 'Schedule13dgDisabledError';
  }
}

interface StoredRecord {
  record: AdmittedSchedule13dgRecord;
  canonical: string;
}

export type IngestResult =
  | Evaluation
  | { status: 'blocked'; reason: 'kill-switch' }
  | { status: 'duplicate'; reason: 'duplicate' }
  | { status: 'conflict'; reason: 'conflict' };

export interface Schedule13dgRuntime {
  killSwitchEngaged(): boolean;
  setKillSwitch(engaged: boolean): void;
  liveIngestImplemented(): false;
  ingestSynthetic(input: {
    xml: string;
    accession: string;
    filedDate: string;
    eligibility: readonly ReviewedEntityEligibility[];
    fetch?: { timestampUtc: string; timestampCtLabel: string | null };
    now?: number;
  }): IngestResult;
  serve(): { blocked: true; records: [] } | { blocked: false; records: AdmittedSchedule13dgRecord[] };
  withdraw(accession: string): void;
  correct(input: {
    priorAccession: string;
    xml: string;
    accession: string;
    filedDate: string;
    eligibility: readonly ReviewedEntityEligibility[];
    fetch?: { timestampUtc: string; timestampCtLabel: string | null };
  }): IngestResult;
  markStale(activeAccessions: readonly string[]): void;
  tombstones(): readonly Tombstone[];
  logs(): readonly OperationalLog[];
  purgeLogs(now: number): void;
  metrics(): Readonly<Record<ExclusionReason, number>>;
  registerSecondaryStore(store: SecondaryStore): void;
  secondaryStores(): readonly string[];
  scrub(accession: string, reason: Tombstone['reason']): void;
}

const METRIC_KEYS: readonly ExclusionReason[] = [
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
];

export function createSchedule13dgRuntime(): Schedule13dgRuntime {
  let killSwitch = KILL_SWITCH_DEFAULT_ENGAGED;
  const records = new Map<string, StoredRecord>();
  const hidden = new Map<string, Tombstone>();
  const logbook: OperationalLog[] = [];
  const counts = emptyMetrics();
  const secondary: SecondaryStore[] = [];

  function note(reason: string, now: number): void {
    const entry: OperationalLog = { at: now, reason, source: SOURCE_ID };
    logbook.push(entry);
  }

  function bump(reason: ExclusionReason): void {
    counts[reason] += 1;
  }

  function hide(accession: string, reason: Tombstone['reason']): void {
    const existing = records.get(accession);
    hidden.set(accession, toTombstone(accession, reason, {
      eventDateAsReported: existing?.record.eventDateAsReported ?? hidden.get(accession)?.eventDateAsReported ?? null,
      filedDate: existing?.record.filedDate ?? hidden.get(accession)?.filedDate ?? null,
    }));
    records.delete(accession);
    for (const store of secondary) store.deletePayload(accession);
  }

  return {
    killSwitchEngaged() {
      return killSwitch;
    },
    setKillSwitch(engaged: boolean) {
      killSwitch = engaged;
      if (engaged) {
        for (const accession of records.keys()) hide(accession, 'kill-switch');
      }
    },
    liveIngestImplemented() {
      return LIVE_INGEST_IMPLEMENTED;
    },
    ingestSynthetic(input) {
      if (killSwitch) return { status: 'blocked', reason: 'kill-switch' };
      const now = input.now ?? Date.now();
      const evaluation = evaluateFiling(input);
      if (evaluation.status === 'rejected') {
        bump(evaluation.reason);
        note(evaluation.reason, now);
        return evaluation;
      }
      const canonical = canonicalRecord(evaluation.record);
      const prior = records.get(evaluation.record.accession);
      if (prior) {
        if (prior.canonical === canonical) {
          bump('duplicate');
          note('duplicate', now);
          return { status: 'duplicate', reason: 'duplicate' };
        }
        bump('conflict');
        note('conflict', now);
        return { status: 'conflict', reason: 'conflict' };
      }
      records.set(evaluation.record.accession, { record: evaluation.record, canonical });
      for (const store of secondary) store.write(evaluation.record.accession, evaluation.record);
      return evaluation;
    },
    serve() {
      if (killSwitch) return { blocked: true, records: [] };
      return { blocked: false, records: [...records.values()].map((item) => item.record) };
    },
    withdraw(accession) {
      if (killSwitch) return;
      if (!records.has(accession) && !hidden.has(accession)) return;
      hide(accession, 'withdrawn');
    },
    correct(input) {
      if (killSwitch) return { status: 'blocked', reason: 'kill-switch' };
      if (input.accession === input.priorAccession) {
        bump('conflict');
        note('conflict', Date.now());
        return { status: 'conflict', reason: 'conflict' };
      }
      if (records.has(input.priorAccession) || hidden.has(input.priorAccession)) {
        hide(input.priorAccession, 'corrected');
      }
      return this.ingestSynthetic(input);
    },
    markStale(activeAccessions) {
      if (killSwitch) return;
      const active = new Set(activeAccessions);
      for (const accession of records.keys()) {
        if (!active.has(accession)) hide(accession, 'stale');
      }
    },
    tombstones() {
      return [...hidden.values()];
    },
    logs() {
      return [...logbook];
    },
    purgeLogs(now: number) {
      deleteExpiredLogs(logbook, now);
    },
    metrics() {
      return { ...counts };
    },
    registerSecondaryStore(store) {
      secondary.push(store);
    },
    secondaryStores() {
      return secondary.map((store) => store.id);
    },
    scrub(accession, reason) {
      hide(accession, reason);
    },
  };
}

export function liveIngest(): never {
  throw new Schedule13dgDisabledError();
}

function emptyMetrics(): Record<ExclusionReason, number> {
  const counts = {} as Record<ExclusionReason, number>;
  for (const key of METRIC_KEYS) counts[key] = 0;
  return counts;
}
