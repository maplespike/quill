// SPDX-License-Identifier: AGPL-3.0-only

import {
  FUTURE_ENABLEMENT_CLEARED,
  KILL_SWITCH_DEFAULT_ENGAGED,
  LIVE_INGEST_IMPLEMENTED,
  LOG_TTL_MS,
  METADATA_TTL_MS,
  SOURCE_ID,
  STORE_ID,
} from './constants.js';
import { canonicalRecord, evaluateFiling, freezeRecord, recordLineage } from './evaluate.js';
import {
  deleteExpiredLogs,
  deleteExpiredMetadata,
  sanitizeLogReason,
  toTombstone,
  writeMetadata,
} from './retention.js';
import type { MetadataRow } from './retention.js';
import type {
  AdmittedSchedule13dgRecord,
  Evaluation,
  ExclusionReason,
  LogReason,
  OperationalLog,
  RecordLineage,
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
  storedAt: number;
}

export type IngestResult =
  | Evaluation
  | { status: 'blocked'; reason: 'kill-switch' | 'store-unverified' }
  | { status: 'not-persisted'; reason: 'persistence-refused' }
  | { status: 'duplicate'; reason: 'duplicate' }
  | { status: 'conflict'; reason: 'conflict' | 'lineage-conflict' }
  | { status: 'incomplete'; reason: 'partial-write' | 'store-incomplete'; storesRemaining: readonly string[] }
  | { status: 'admitted'; record: AdmittedSchedule13dgRecord; persisted: true };

export interface SyntheticUnlock {
  unlocked: true;
  liveIngest: false;
  gatesCleared: false;
  futureEnablementCleared: false;
}

export interface Schedule13dgRuntime {
  killSwitchEngaged(): boolean;
  unlockSyntheticEvaluation(): SyntheticUnlock;
  engageKillSwitch(): void;
  liveIngestImplemented(): false;
  gatesCleared(): false;
  futureEnablementCleared(): false;
  ingestSynthetic(input: {
    xml: string;
    accession: string;
    filedDate: string;
    eligibility: readonly ReviewedEntityEligibility[];
    reviewedClasses: readonly { issuerCik: string; classTitleAsFiled: string }[];
    fetch?: { timestampUtc: string; timestampCtLabel: string | null };
  }): IngestResult;
  serve(): { blocked: true; records: []; reason?: 'store-unverified' } | { blocked: false; records: AdmittedSchedule13dgRecord[] };
  withdraw(accession: string): ScrubResult;
  correct(input: {
    priorAccession: string;
    xml: string;
    accession: string;
    filedDate: string;
    eligibility: readonly ReviewedEntityEligibility[];
    reviewedClasses: readonly { issuerCik: string; classTitleAsFiled: string }[];
    fetch?: { timestampUtc: string; timestampCtLabel: string | null };
  }): IngestResult;
  markStale(activeAccessions: readonly string[]): void;
  tombstones(): readonly Tombstone[];
  logs(): readonly OperationalLog[];
  purgeLogs(now: number): void;
  metrics(): Readonly<Record<ExclusionReason, number>>;
  enrollSecondaryStore(store: SecondaryStore): { accepted: false; reason: 'enrollment-closed' };
  secondaryStores(): readonly string[];
  storesVerified(): boolean;
  scrub(accession: string, reason: Tombstone['reason']): ScrubResult;
}

export interface ScrubResult {
  scrub: 'complete' | 'incomplete';
  storesRemaining: readonly string[];
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

export function createSchedule13dgRuntime(options: {
  clock?: () => number;
  retention?: 'refused' | 'synthetic-contract';
  stores?: readonly SecondaryStore[];
} = {}): Schedule13dgRuntime {
  const clock = options.clock ?? (() => 0);
  const retention = options.retention ?? 'refused';
  const stores = [...(options.stores ?? [])];
  const verified = manifestVerified(stores);
  let killSwitch = KILL_SWITCH_DEFAULT_ENGAGED;
  const records = new Map<string, StoredRecord>();
  const hidden = new Map<string, Tombstone>();
  const logbook: OperationalLog[] = [];
  const counts = emptyMetrics();
  let productionRows: MetadataRow[] = [];

  function now(): number {
    return clock();
  }

  function note(reason: LogReason): void {
    const code = sanitizeLogReason(reason);
    logbook.push({ at: now(), reason: code, source: SOURCE_ID });
  }

  function bump(reason: ExclusionReason): void {
    counts[reason] += 1;
  }

  function tick(at: number): void {
    deleteExpiredLogs(logbook, at);
    deleteExpiredMetadata(productionRows, at, FUTURE_ENABLEMENT_CLEARED);
    productionRows = productionRows.filter((row) => at - row.storedAt < (FUTURE_ENABLEMENT_CLEARED ? METADATA_TTL_MS : 0));
    if (retention !== 'synthetic-contract') {
      for (const accession of [...records.keys()]) scrubAt(accession, 'stale', at);
      records.clear();
    } else {
      for (const [accession, stored] of [...records.entries()]) {
        if (at - stored.storedAt >= METADATA_TTL_MS) scrubAt(accession, 'stale', at);
      }
    }
    const tombstoneTtl = retention === 'synthetic-contract' ? METADATA_TTL_MS : LOG_TTL_MS;
    for (const [accession, tomb] of [...hidden.entries()]) {
      if (at - tomb.storedAt >= tombstoneTtl) hidden.delete(accession);
    }
  }

  function lineageOf(accession: string): RecordLineage | null {
    const live = records.get(accession);
    if (live) return recordLineage(live.record);
    return hidden.get(accession)?.lineage ?? null;
  }

  function scrubAt(accession: string, reason: Tombstone['reason'], at: number): ScrubResult {
    const live = records.get(accession);
    const prior = hidden.get(accession);
    const lineage = live ? recordLineage(live.record) : prior?.lineage ?? null;
    const dates = {
      eventDateAsReported: live?.record.eventDateAsReported ?? prior?.eventDateAsReported ?? null,
      filedDate: live?.record.filedDate ?? prior?.filedDate ?? null,
    };
    records.delete(accession);
    const storesRemaining = verified ? deleteEverywhere(accession) : stores.map((store) => store.id);
    const result: ScrubResult = storesRemaining.length === 0
      ? { scrub: 'complete', storesRemaining: [] }
      : { scrub: 'incomplete', storesRemaining };
    hidden.set(accession, toTombstone(accession, reason, dates, {
      scrub: result.scrub,
      storesRemaining: result.storesRemaining,
      storedAt: at,
      lineage,
    }));
    if (result.scrub === 'incomplete') note('store-incomplete');
    return result;
  }

  function deleteEverywhere(accession: string): string[] {
    const failed = new Set<string>();
    for (const store of stores) {
      try {
        store.deletePayload(accession);
      } catch {
        failed.add(store.id);
      }
    }
    for (const store of stores) {
      try {
        if (store.read(accession) != null) failed.add(store.id);
      } catch {
        failed.add(store.id);
      }
    }
    return [...failed];
  }

  function persist(record: AdmittedSchedule13dgRecord, canonical: string, at: number): IngestResult {
    const frozen = freezeRecord(record);
    const refused = writeMetadata(productionRows, {
      id: frozen.accession,
      storedAt: at,
      payload: frozen,
    }, FUTURE_ENABLEMENT_CLEARED);
    if (refused.ok) productionRows = refused.rows;
    if (retention !== 'synthetic-contract') {
      note('persistence-refused');
      return { status: 'not-persisted', reason: 'persistence-refused' };
    }
    const written: SecondaryStore[] = [];
    for (const store of stores) {
      try {
        store.write(frozen.accession, frozen);
        if (store.read(frozen.accession) == null) throw new Error('unread');
        written.push(store);
      } catch {
        const storesRemaining = deleteEverywhere(frozen.accession);
        records.delete(frozen.accession);
        if (storesRemaining.length > 0) note('store-incomplete');
        return { status: 'incomplete', reason: 'partial-write', storesRemaining };
      }
    }
    records.set(frozen.accession, { record: frozen, canonical, storedAt: at });
    return { status: 'admitted', record: freezeRecord(frozen), persisted: true };
  }

  function ingestEvaluated(input: {
    xml: string;
    accession: string;
    filedDate: string;
    eligibility: readonly ReviewedEntityEligibility[];
    reviewedClasses: readonly { issuerCik: string; classTitleAsFiled: string }[];
    fetch?: { timestampUtc: string; timestampCtLabel: string | null };
  }): IngestResult {
    const at = now();
    tick(at);
    if (!verified) return { status: 'blocked', reason: 'store-unverified' };
    if (killSwitch) return { status: 'blocked', reason: 'kill-switch' };
    const evaluation = evaluateFiling(input);
    if (evaluation.status === 'rejected') {
      bump(evaluation.reason);
      note(evaluation.reason);
      return evaluation;
    }
    const canonical = canonicalRecord(evaluation.record);
    const prior = records.get(evaluation.record.accession);
    if (prior) {
      if (prior.canonical === canonical) {
        bump('duplicate');
        note('duplicate');
        return { status: 'duplicate', reason: 'duplicate' };
      }
      bump('conflict');
      note('conflict');
      return { status: 'conflict', reason: 'conflict' };
    }
    return persist(evaluation.record, canonical, at);
  }

  return {
    killSwitchEngaged() {
      return killSwitch;
    },
    unlockSyntheticEvaluation() {
      killSwitch = false;
      return {
        unlocked: true,
        liveIngest: false,
        gatesCleared: false,
        futureEnablementCleared: false,
      };
    },
    engageKillSwitch() {
      killSwitch = true;
      const at = now();
      for (const accession of [...records.keys()]) scrubAt(accession, 'kill-switch', at);
    },
    liveIngestImplemented() {
      return LIVE_INGEST_IMPLEMENTED;
    },
    gatesCleared() {
      return false;
    },
    futureEnablementCleared() {
      return FUTURE_ENABLEMENT_CLEARED;
    },
    ingestSynthetic(input) {
      return ingestEvaluated(input);
    },
    serve() {
      tick(now());
      if (killSwitch) return { blocked: true, records: [] };
      if (!verified) return { blocked: true, records: [], reason: 'store-unverified' };
      return {
        blocked: false,
        records: [...records.values()].map((item) => freezeRecord(item.record)),
      };
    },
    withdraw(accession) {
      tick(now());
      if (!records.has(accession) && !hidden.has(accession)) {
        const storesRemaining = verified ? deleteEverywhere(accession) : stores.map((store) => store.id);
        return storesRemaining.length === 0
          ? { scrub: 'complete', storesRemaining: [] }
          : { scrub: 'incomplete', storesRemaining };
      }
      return scrubAt(accession, 'withdrawn', now());
    },
    correct(input) {
      const at = now();
      tick(at);
      if (!verified) return { status: 'blocked', reason: 'store-unverified' };
      if (killSwitch) return { status: 'blocked', reason: 'kill-switch' };
      if (input.accession === input.priorAccession) {
        bump('conflict');
        note('conflict');
        return { status: 'conflict', reason: 'conflict' };
      }
      const priorLineage = lineageOf(input.priorAccession);
      if (!priorLineage) {
        note('lineage-conflict');
        return { status: 'conflict', reason: 'lineage-conflict' };
      }
      const evaluation = evaluateFiling(input);
      if (evaluation.status === 'rejected') {
        bump(evaluation.reason);
        note(evaluation.reason);
        return evaluation;
      }
      const nextLineage = recordLineage(evaluation.record);
      const same = priorLineage.issuerCik === nextLineage.issuerCik
        && priorLineage.classTitleAsFiled === nextLineage.classTitleAsFiled
        && priorLineage.filerCiks.join('\n') === nextLineage.filerCiks.join('\n');
      if (!same) {
        note('lineage-conflict');
        return { status: 'conflict', reason: 'lineage-conflict' };
      }
      const saved = persist(evaluation.record, canonicalRecord(evaluation.record), at);
      if (saved.status !== 'admitted') return saved;
      scrubAt(input.priorAccession, 'corrected', at);
      return saved;
    },
    markStale(activeAccessions) {
      const at = now();
      tick(at);
      const active = new Set(activeAccessions);
      for (const accession of [...records.keys()]) {
        if (!active.has(accession)) scrubAt(accession, 'stale', at);
      }
    },
    tombstones() {
      tick(now());
      return [...hidden.values()].map((item) => ({
        ...item,
        storesRemaining: [...item.storesRemaining],
        lineage: item.lineage
          ? { ...item.lineage, filerCiks: [...item.lineage.filerCiks] }
          : null,
      }));
    },
    logs() {
      tick(now());
      return logbook.map((entry) => ({ ...entry }));
    },
    purgeLogs(at: number) {
      deleteExpiredLogs(logbook, at);
    },
    metrics() {
      return { ...counts };
    },
    enrollSecondaryStore() {
      return { accepted: false, reason: 'enrollment-closed' };
    },
    secondaryStores() {
      return verified ? stores.map((store) => store.id) : [];
    },
    storesVerified() {
      return verified;
    },
    scrub(accession, reason) {
      tick(now());
      return scrubAt(accession, reason, now());
    },
  };
}

export function liveIngest(): never {
  throw new Schedule13dgDisabledError();
}

function manifestVerified(stores: readonly SecondaryStore[]): boolean {
  const ids = new Set<string>();
  for (const store of stores) {
    if (!store || typeof store.id !== 'string' || !STORE_ID.test(store.id)) return false;
    if (ids.has(store.id)) return false;
    ids.add(store.id);
    if (typeof store.write !== 'function') return false;
    if (typeof store.deletePayload !== 'function') return false;
    if (typeof store.read !== 'function') return false;
  }
  return true;
}

function emptyMetrics(): Record<ExclusionReason, number> {
  const counts = {} as Record<ExclusionReason, number>;
  for (const key of METRIC_KEYS) counts[key] = 0;
  return counts;
}
