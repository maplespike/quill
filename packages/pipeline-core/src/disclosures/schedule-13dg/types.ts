// SPDX-License-Identifier: AGPL-3.0-only

export type ExclusionReason =
  | 'network-refused'
  | 'non-synthetic-accession'
  | 'parse-failed'
  | 'out-of-scope'
  | 'ambiguous-issuer'
  | 'ambiguous-class'
  | 'individual'
  | 'mixed'
  | 'unknown'
  | 'eligibility-not-reviewed'
  | 'eligibility-rejected'
  | 'duplicate'
  | 'conflict';

export interface ReviewedEntityEligibility {
  filerCik: string;
  reviewId: string;
  status: 'reviewed-eligible' | 'reviewed-ineligible' | 'unreviewed' | 'ambiguous';
  /**
   * Recorded so callers can see it is ignored. A true value is not eligibility.
   */
  files13fManager: boolean | 'unknown';
  personalVehicleRisk: 'reviewed-absent' | 'unresolved' | 'present';
}

export interface AdmittedFiler {
  filerCik: string;
  eligibilityReviewId: string;
  reportedPercentAsFiled: string | null;
  reportedSharesAsFiled: string | null;
  reportedZeroHolding: boolean;
  zeroHoldingIsSale: false;
}

export interface AdmittedSchedule13dgRecord {
  source: 'sec-schedule-13dg';
  synthetic: true;
  accession: string;
  formType: 'SCHEDULE 13D' | 'SCHEDULE 13G' | 'SCHEDULE 13D/A' | 'SCHEDULE 13G/A';
  amendmentNumber: string | null;
  isAmendment: boolean;
  isSale: false;
  inferredTrade: null;
  positionChange: 'not-inferred';
  issuerCik: string;
  classTitleAsFiled: string;
  filers: readonly AdmittedFiler[];
  eventDateAsReported: string;
  filedDate: string;
  documentFiledDate: string | null;
  fetch: {
    timestampUtc: string | null;
    timestampCtLabel: string | null;
    parserVersion: string;
  };
  chainNote: string | null;
  completeness: 'not-claimed';
  realtime: 'not-claimed';
  crossFilerPercentSum: null;
}

export type Evaluation =
  | { status: 'rejected'; reason: ExclusionReason }
  | { status: 'admitted'; record: AdmittedSchedule13dgRecord };

export interface IssuerClass {
  classTitleAsFiled: string;
}

export interface IssuerIncorporation {
  status: 'historical-only';
  sourceFilingDate: string;
  currentStatus: 'not-reverified';
  review: 'unreviewed';
}

export interface IssuerStatusRecord {
  issuerCik: string;
  displayName: string;
  classes: readonly IssuerClass[];
  incorporation: IssuerIncorporation;
}

export type LogReason =
  | ExclusionReason
  | 'withdrawn'
  | 'corrected'
  | 'stale'
  | 'kill-switch'
  | 'store-incomplete'
  | 'persistence-refused'
  | 'store-unverified'
  | 'lineage-conflict';

export interface OperationalLog {
  at: number;
  reason: LogReason;
  source: 'sec-schedule-13dg';
}

export interface RecordLineage {
  issuerCik: string;
  classTitleAsFiled: string;
  filerCiks: readonly string[];
}

export interface Tombstone {
  accession: string;
  hidden: true;
  reason: 'withdrawn' | 'corrected' | 'stale' | 'conflict' | 'kill-switch';
  payload: null;
  eventDateAsReported: string | null;
  filedDate: string | null;
  scrub: 'complete' | 'incomplete';
  storesRemaining: readonly string[];
  storedAt: number;
  lineage: RecordLineage | null;
}

export interface SecondaryStore {
  id: string;
  write(accession: string, payload: AdmittedSchedule13dgRecord): void;
  deletePayload(accession: string): void;
  read(accession: string): unknown;
}
