// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import {
  ACCESS_REVIEW,
  COVERAGE_CLAIMS,
  ENABLEMENT_GATES,
  ENTITY_TYPE_CODES,
  ENTITY_TYPE_SCREENING,
  ENGLISH_CAVEAT,
  FUTURE_ENABLEMENT_CLEARED,
  LANGUAGE_REVIEW,
  LIVE_INGEST_IMPLEMENTED,
  LOG_TTL_MS,
  METADATA_TTL_MS,
  PRODUCT_LABEL,
  Schedule13dgDisabledError,
  applyIssuerLabelCorrection,
  classIdentity,
  collapseSecurityClasses,
  createSchedule13dgRuntime,
  crossFilerPercentSum,
  deleteExpiredMetadata,
  evaluateFiling,
  interpretAbsence,
  liveIngest,
  runBoundedAccess,
  writeMetadata,
} from '../index.js';
import type { AdmittedSchedule13dgRecord, MetadataRow, ReviewedEntityEligibility, SecondaryStore } from '../index.js';

const PERSON = 'SYNTHETIC NATURAL PERSON';
const PERSON_CIK = 'SYN-CIK-PERSON-1';
const CUSIP = '99999X999';
const ISIN = 'CA99999X9999';
const NARRATIVE = 'SECRET NARRATIVE BODY';
const SIGNATORY = 'SYNTHETIC SIGNATORY NAME';
const RAW_TAG = '<edgarSubmission';

const T0 = Date.parse('2026-01-01T00:00:00.000Z');

const REVIEWED_CLASSES = [
  { issuerCik: 'SYN-CIK-ISSUER-1', classTitleAsFiled: 'Common Shares' },
  { issuerCik: 'SYN-CIK-ISSUER-1', classTitleAsFiled: 'Preferred Shares Series A' },
  { issuerCik: 'SYN-CIK-ISSUER-2', classTitleAsFiled: 'Common Shares' },
  { issuerCik: 'SYN-CIK-ISSUER-9', classTitleAsFiled: 'Common Shares' },
];

function reviewed(
  filerCik: string,
  patch: Partial<ReviewedEntityEligibility> = {},
): ReviewedEntityEligibility {
  return {
    filerCik,
    reviewId: `REV-${filerCik}`,
    status: 'reviewed-eligible',
    files13fManager: false,
    personalVehicleRisk: 'reviewed-absent',
    ...patch,
  };
}

function filingXml(options: {
  form?: string;
  issuerCiks?: readonly string[];
  classTitles?: readonly string[];
  eventTag?: string;
  eventDate?: string | null;
  filedInDocument?: string | null;
  persons?: readonly {
    name?: string;
    cik?: string | null;
    typeXml?: string;
    percent?: string | null;
    shares?: string | null;
  }[];
  count?: string | null;
  coverCount?: string | null;
  omitCounts?: boolean;
  namespace?: boolean;
  extra?: string;
} = {}): string {
  const form = options.form ?? 'SCHEDULE 13G';
  const issuers = (options.issuerCiks ?? ['SYN-CIK-ISSUER-1'])
    .map((cik) => `<issuerCik>${cik}</issuerCik>`)
    .join('');
  const classes = (options.classTitles ?? ['Common Shares'])
    .map((title) => `<securitiesClassTitle>${title}</securitiesClassTitle>`)
    .join('');
  const eventTag = options.eventTag ?? 'eventDate';
  const event = options.eventDate === null
    ? ''
    : `<${eventTag}>${options.eventDate ?? '2025-09-30'}</${eventTag}>`;
  const filed = options.filedInDocument === null
    ? ''
    : `<filingDate>${options.filedInDocument ?? '2025-11-13'}</filingDate>`;
  const persons = (options.persons ?? [{
    name: 'SYNTHETIC ADVISER ALPHA',
    cik: 'SYN-CIK-FILER-A',
    typeXml: '<typeOfReportingPerson>IA</typeOfReportingPerson>',
    percent: '6.5',
    shares: '1000',
  }]).map((person) => {
    const name = person.name ? `<reportingPersonName>${person.name}</reportingPersonName>` : '';
    const cik = person.cik ? `<reportingPersonCik>${person.cik}</reportingPersonCik>` : '';
    const type = person.typeXml ?? '';
    const percent = person.percent ? `<percentOfClass>${person.percent}</percentOfClass>` : '';
    const shares = person.shares ? `<aggregateAmountOwned>${person.shares}</aggregateAmountOwned>` : '';
    return `<reportingPersonInfo>${name}${cik}${type}${percent}${shares}</reportingPersonInfo>`;
  }).join('');
  const declared = options.count ?? String((options.persons ?? [1]).length);
  const cover = options.coverCount ?? String((options.persons ?? [1]).length);
  const count = options.omitCounts
    ? ''
    : `<reportingPersonCount>${declared}</reportingPersonCount><coverPageReportingPersonCount>${cover}</coverPageReportingPersonCount>`;
  const root = options.namespace
    ? '<edgarSubmission xmlns="http://www.sec.gov/edgar/schedule13g">'
    : '<edgarSubmission>';
  return [
    root,
    `<headerData><submissionType>${form}</submissionType></headerData>`,
    '<formData>',
    `<coverPageHeader>${classes}${event}${filed}</coverPageHeader>`,
    `<reportingPersons>${persons}</reportingPersons>`,
    `<issuerInfo>${issuers}`,
    `<issuerCusipNumber>${CUSIP}</issuerCusipNumber>`,
    `<issuerCusip>${CUSIP}</issuerCusip>`,
    `<isin>${ISIN}</isin>`,
    '</issuerInfo>',
    `<purposeOfTransaction>${NARRATIVE}</purposeOfTransaction>`,
    `<signatureBlock><signatureName>${SIGNATORY}</signatureName></signatureBlock>`,
    count,
    options.extra ?? '',
    '</formData>',
    '</edgarSubmission>',
  ].join('');
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function assertNoLeak(value: unknown): void {
  const json = JSON.stringify(value);
  for (const token of [PERSON, PERSON_CIK, CUSIP, ISIN, NARRATIVE, SIGNATORY, RAW_TAG, 'sedi.ca', 'sha256']) {
    assert.equal(json.includes(token), false, `leaked ${token}`);
  }
  for (const hashed of [digest(NARRATIVE), digest(PERSON), digest(PERSON_CIK), digest(RAW_TAG)]) {
    assert.equal(json.includes(hashed), false, 'leaked a source or person hash');
  }
}

function controlledStore(id: string, flags: { throwWrite: boolean; throwDelete: boolean }): SecondaryStore {
  const map = new Map<string, unknown>();
  return {
    id,
    write(accession, payload) {
      if (flags.throwWrite) throw new Error('write failed');
      map.set(accession, payload);
    },
    deletePayload(accession) {
      if (flags.throwDelete) throw new Error('delete failed');
      map.delete(accession);
    },
    read(accession) {
      return map.get(accession) ?? null;
    },
  };
}

function memoryStore(): SecondaryStore & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    id: 'memory-stand-in',
    map,
    write(accession, payload) {
      map.set(accession, payload);
    },
    deletePayload(accession) {
      map.delete(accession);
    },
    read(accession) {
      return map.get(accession) ?? null;
    },
  };
}

function evaluate(input: Omit<Parameters<typeof evaluateFiling>[0], 'reviewedClasses'> & {
  reviewedClasses?: Parameters<typeof evaluateFiling>[0]['reviewedClasses'];
}) {
  return evaluateFiling({
    ...input,
    reviewedClasses: input.reviewedClasses ?? REVIEWED_CLASSES,
  });
}

function openRuntime(options: {
  stores?: SecondaryStore[];
  clock?: () => number;
  requiredStoreIds?: readonly string[];
} = {}) {
  const stores = options.stores;
  const runtime = createSchedule13dgRuntime({
    retention: 'synthetic-contract',
    clock: options.clock ?? (() => T0),
    stores,
    requiredStoreIds: options.requiredStoreIds ?? stores?.map((store) => store.id),
  });
  const unlock = runtime.unlockSyntheticEvaluation();
  assert.equal(unlock.gatesCleared, false);
  assert.equal(unlock.liveIngest, false);
  assert.equal(unlock.futureEnablementCleared, false);
  const ingest = runtime.ingestSynthetic.bind(runtime);
  const correct = runtime.correct.bind(runtime);
  type IngestInput = Parameters<typeof ingest>[0];
  type CorrectInput = Parameters<typeof correct>[0];
  return Object.assign(runtime, {
    ingestSynthetic(input: Omit<IngestInput, 'reviewedClasses'> & { reviewedClasses?: IngestInput['reviewedClasses'] }) {
      return ingest({ ...input, reviewedClasses: input.reviewedClasses ?? REVIEWED_CLASSES });
    },
    correct(input: Omit<CorrectInput, 'reviewedClasses'> & { reviewedClasses?: CorrectInput['reviewedClasses'] }) {
      return correct({ ...input, reviewedClasses: input.reviewedClasses ?? REVIEWED_CLASSES });
    },
  });
}

describe('schedule 13d/g disabled foundation', () => {
  it('ships disabled, with every enablement gate closed', () => {
    assert.equal(PRODUCT_LABEL, 'Quill by Maplespike');
    assert.equal(LIVE_INGEST_IMPLEMENTED, false);
    assert.equal(FUTURE_ENABLEMENT_CLEARED, false);
    assert.equal(ENTITY_TYPE_SCREENING.provesEligibility, false);
    assert.equal(ENTITY_TYPE_SCREENING.files13fManagerProvesEligibility, false);
    assert.equal(ENTITY_TYPE_SCREENING.pilotRatioIsAdmittedCount, false);
    assert.equal(LANGUAGE_REVIEW.status, 'unapproved');
    assert.equal(LANGUAGE_REVIEW.frenchLabels, null);
    assert.equal(LANGUAGE_REVIEW.humanReviewedFrench, false);
    assert.equal(ACCESS_REVIEW.status, 'unapproved');
    assert.equal(ACCESS_REVIEW.monitoredContact, null);
    assert.equal(ACCESS_REVIEW.userAgent, null);
    assert.equal(ACCESS_REVIEW.extraSpendUsd, 0);
    assert.equal(COVERAGE_CLAIMS.completeness, 'not-claimed');
    assert.equal(COVERAGE_CLAIMS.realtime, 'not-claimed');
    assert.match(ENGLISH_CAVEAT, /Quill by Maplespike/);
    for (const gate of ENABLEMENT_GATES) {
      assert.equal(gate.blocksEnablement, true);
      const status: string = gate.status;
      assert.equal(status === 'green' || status === 'approved', false);
    }
    const runtime = createSchedule13dgRuntime();
    assert.equal(runtime.killSwitchEngaged(), true);
    assert.equal(runtime.liveIngestImplemented(), false);
    assert.equal(runtime.productionStoreManifestVerified(), false);
    assert.deepEqual(runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-1',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
      reviewedClasses: REVIEWED_CLASSES,
    }), { status: 'blocked', reason: 'kill-switch' });
    assert.deepEqual(runtime.serve(), { blocked: true, records: [] });
    assert.equal(runtime.secondaryStores().length, 0);
  });

  it('ignores environment flags that would turn ingestion on', () => {
    const previous = {
      enabled: process.env.SEC_SCHEDULE_13DG_ENABLED,
      kill: process.env.QUILL_SEC_13DG_KILL_SWITCH,
    };
    process.env.SEC_SCHEDULE_13DG_ENABLED = 'true';
    process.env.QUILL_SEC_13DG_KILL_SWITCH = 'false';
    try {
      const runtime = createSchedule13dgRuntime();
      assert.equal(runtime.killSwitchEngaged(), true);
      assert.throws(() => liveIngest(), Schedule13dgDisabledError);
    } finally {
      if (previous.enabled === undefined) delete process.env.SEC_SCHEDULE_13DG_ENABLED;
      else process.env.SEC_SCHEDULE_13DG_ENABLED = previous.enabled;
      if (previous.kill === undefined) delete process.env.QUILL_SEC_13DG_KILL_SWITCH;
      else process.env.QUILL_SEC_13DG_KILL_SWITCH = previous.kill;
    }
  });

  it('does not call the network for a live ingest or a URL input', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response('');
    }) as typeof fetch;
    try {
      assert.throws(() => liveIngest(), (error: unknown) => {
        if (!(error instanceof Schedule13dgDisabledError)) return false;
        assert.equal(error.message, 'live-ingest-disabled');
        return true;
      });
      const runtime = openRuntime();
      const refused = runtime.ingestSynthetic({
        xml: 'https://www.sec.gov/Archives/example',
        accession: 'SYN-ACC-URL',
        filedDate: '2025-11-13',
        eligibility: [],
      });
      assert.equal(refused.status, 'rejected');
      if (refused.status === 'rejected') assert.equal(refused.reason, 'network-refused');
      assert.equal(calls, 0);
      assertNoLeak(runtime.logs());
      assertNoLeak(runtime.metrics());
    } finally {
      globalThis.fetch = original;
    }
  });

  it('requires reviewed eligibility for every entity type code', () => {
    for (const code of ENTITY_TYPE_CODES) {
      const xml = filingXml({
        persons: [{
          name: 'SYNTHETIC ENTITY',
          cik: 'SYN-CIK-FILER-A',
          typeXml: `<typeOfReportingPerson>${code}</typeOfReportingPerson>`,
          percent: '5.1',
          shares: '10',
        }],
      });
      const unreviewed = evaluate({
        xml,
        accession: 'SYN-ACC-TYPE',
        filedDate: '2025-11-13',
        eligibility: [],
      });
      assert.equal(unreviewed.status, 'rejected');
      if (unreviewed.status === 'rejected') {
        assert.equal(unreviewed.reason, 'eligibility-not-reviewed');
        assertNoLeak(unreviewed);
      }
      const eligible = evaluate({
        xml,
        accession: 'SYN-ACC-TYPE',
        filedDate: '2025-11-13',
        eligibility: [reviewed('SYN-CIK-FILER-A', { files13fManager: true })],
      });
      const ignored = evaluate({
        xml,
        accession: 'SYN-ACC-TYPE',
        filedDate: '2025-11-13',
        eligibility: [reviewed('SYN-CIK-FILER-A', { files13fManager: 'unknown' })],
      });
      assert.equal(eligible.status, 'admitted');
      assert.equal(ignored.status, 'admitted');
      if (eligible.status === 'admitted' && ignored.status === 'admitted') {
        assert.equal(eligible.record.filers[0]?.eligibilityReviewId, 'REV-SYN-CIK-FILER-A');
        assert.equal(ignored.record.filers[0]?.reportedPercentAsFiled, eligible.record.filers[0]?.reportedPercentAsFiled);
        assert.equal(JSON.stringify(eligible.record).includes('13F'), false);
      }
    }
  });

  it('rejects an individual, a mixed filing, and an unknown filing as a whole', () => {
    const individual = evaluate({
      xml: filingXml({
        persons: [{
          name: PERSON,
          cik: PERSON_CIK,
          typeXml: '<typeOfReportingPerson>IN</typeOfReportingPerson>',
          percent: '9.0',
          shares: '9',
        }],
      }),
      accession: 'SYN-ACC-IN',
      filedDate: '2025-11-13',
      eligibility: [reviewed(PERSON_CIK)],
    });
    assert.deepEqual(individual, { status: 'rejected', reason: 'individual' });

    const mixed = evaluate({
      xml: filingXml({
        persons: [
          {
            name: 'SYNTHETIC ADVISER ALPHA',
            cik: 'SYN-CIK-FILER-A',
            typeXml: '<typeOfReportingPerson>IA</typeOfReportingPerson>',
            percent: '6.5',
            shares: '1000',
          },
          {
            name: PERSON,
            cik: PERSON_CIK,
            typeXml: '<typeOfReportingPerson>IN</typeOfReportingPerson>',
            percent: '1.0',
            shares: '10',
          },
        ],
      }),
      accession: 'SYN-ACC-MIX',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A'), reviewed(PERSON_CIK)],
    });
    assert.deepEqual(mixed, { status: 'rejected', reason: 'mixed' });

    const unknown = evaluate({
      xml: filingXml({
        persons: [{
          name: 'SYNTHETIC OTHER',
          cik: 'SYN-CIK-FILER-A',
          typeXml: '<typeOfReportingPerson>OO</typeOfReportingPerson>',
          percent: '8.0',
          shares: '8',
        }],
      }),
      accession: 'SYN-ACC-OO',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(unknown, { status: 'rejected', reason: 'unknown' });

    const missing = evaluate({
      xml: filingXml({
        persons: [{
          name: 'SYNTHETIC ADVISER ALPHA',
          cik: 'SYN-CIK-FILER-A',
          typeXml: '',
          percent: '8.0',
          shares: '8',
        }],
      }),
      accession: 'SYN-ACC-MISS',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(missing, { status: 'rejected', reason: 'unknown' });
    assertNoLeak(individual);
    assertNoLeak(mixed);
    assertNoLeak(unknown);
  });

  it('fails closed on ambiguous eligibility, personal vehicles, and partial review', () => {
    const xml = filingXml();
    const ambiguous = evaluate({
      xml,
      accession: 'SYN-ACC-AMB',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A', { status: 'ambiguous' })],
    });
    assert.deepEqual(ambiguous, { status: 'rejected', reason: 'unknown' });

    const vehicle = evaluate({
      xml,
      accession: 'SYN-ACC-VEH',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A', { personalVehicleRisk: 'present', files13fManager: true })],
    });
    assert.deepEqual(vehicle, { status: 'rejected', reason: 'eligibility-rejected' });

    const partial = evaluate({
      xml: filingXml({
        persons: [
          {
            name: 'SYNTHETIC ADVISER ALPHA',
            cik: 'SYN-CIK-FILER-A',
            typeXml: '<typeOfReportingPerson>CO</typeOfReportingPerson>',
            percent: '6.2',
            shares: '62',
          },
          {
            name: 'SYNTHETIC PARTNER BETA',
            cik: 'SYN-CIK-FILER-B',
            typeXml: '<typeOfReportingPerson>PN</typeOfReportingPerson>',
            percent: '6.2',
            shares: '62',
          },
        ],
      }),
      accession: 'SYN-ACC-PART',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(partial.status, 'rejected');
    if (partial.status === 'rejected') assert.equal(partial.reason, 'eligibility-not-reviewed');
    assert.equal(JSON.stringify(partial).includes('6.2'), false);
  });

  it('keeps an ambiguous issuer or class unmerged', () => {
    const issuer = evaluate({
      xml: filingXml({ issuerCiks: ['SYN-CIK-ISSUER-1', 'SYN-CIK-ISSUER-2'] }),
      accession: 'SYN-ACC-ISS',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(issuer, { status: 'rejected', reason: 'ambiguous-issuer' });
    const repeated = evaluate({
      xml: filingXml({
        issuerCiks: ['SYN-CIK-ISSUER-1'],
        extra: '<issuerCIK>SYN-CIK-ISSUER-1</issuerCIK>',
      }),
      accession: 'SYN-ACC-REPEAT',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(repeated, { status: 'rejected', reason: 'ambiguous-issuer' });

    const securityClass = evaluate({
      xml: filingXml({ classTitles: ['Common Shares', 'Preferred Shares Series A'] }),
      accession: 'SYN-ACC-CLS',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(securityClass, { status: 'rejected', reason: 'ambiguous-class' });
    assert.deepEqual(collapseSecurityClasses(), { allowed: false, classes: null });
    assert.notEqual(
      classIdentity('SYN-CIK-ISSUER-1', 'Common Shares'),
      classIdentity('SYN-CIK-ISSUER-1', 'Preferred Shares Series A'),
    );
  });

  it('separates the event date, the filed date, and fetch metadata', () => {
    const evaluation = evaluate({
      xml: filingXml({
        form: 'SCHEDULE 13D',
        eventTag: 'dateOfEventRequiringStatement',
        eventDate: '09/30/2025',
        issuerCiks: [],
        extra: '<issuerCIK>SYN-CIK-ISSUER-1</issuerCIK>',
      }),
      accession: 'SYN-ACC-DATES',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
      fetch: { timestampUtc: '2026-11-11T15:00:00.000Z', timestampCtLabel: '2026-11-11 CT' },
    });
    assert.equal(evaluation.status, 'admitted');
    if (evaluation.status !== 'admitted') return;
    assert.equal(evaluation.record.eventDateAsReported, '2025-09-30');
    assert.equal(evaluation.record.filedDate, '2025-11-13');
    assert.equal(evaluation.record.fetch.timestampUtc, '2026-11-11T15:00:00.000Z');
    assert.equal(evaluation.record.fetch.timestampCtLabel, '2026-11-11 CT');
    assert.notEqual(evaluation.record.eventDateAsReported, evaluation.record.filedDate);
    assert.equal(evaluation.record.isSale, false);
    assert.equal(evaluation.record.inferredTrade, null);
    assert.equal(evaluation.record.positionChange, 'not-inferred');
    assert.equal('delta' in evaluation.record, false);

    const missingEvent = evaluate({
      xml: filingXml({ eventDate: null }),
      accession: 'SYN-ACC-NOEVENT',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(missingEvent, { status: 'rejected', reason: 'unknown' });
    assert.equal(JSON.stringify(missingEvent).includes('2025-11-13'), false);
  });

  it('keeps a historical issuer status historical when the label is corrected', () => {
    const corrected = applyIssuerLabelCorrection({
      issuerCik: 'SYN-CIK-ISSUER-H',
      displayName: 'Synthetic Historical Issuer',
      classes: [
        { classTitleAsFiled: 'Common Shares' },
        { classTitleAsFiled: 'Preferred Shares Series A' },
      ],
      incorporation: {
        status: 'historical-only',
        sourceFilingDate: '2017-03-15',
        currentStatus: 'not-reverified',
        review: 'unreviewed',
      },
    }, 'Synthetic Historical Issuer Corrected');
    assert.equal(corrected.displayName, 'Synthetic Historical Issuer Corrected');
    assert.equal(corrected.incorporation.sourceFilingDate, '2017-03-15');
    assert.equal(corrected.incorporation.status, 'historical-only');
    assert.equal(corrected.incorporation.currentStatus, 'not-reverified');
    assert.equal(corrected.incorporation.review, 'unreviewed');
    assert.equal(corrected.classes.length, 2);
  });

  it('treats a duplicate, an amendment, a correction, and a withdrawal exactly', () => {
    const store = memoryStore();
    const runtime = openRuntime({ stores: [store] });
    const first = filingXml({ eventDate: '2025-09-30' });
    const admitted = runtime.ingestSynthetic({
      xml: first,
      accession: 'SYN-ACC-1',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(admitted.status, 'admitted');
    const servedFrozen = runtime.serve();
    assert.equal(servedFrozen.blocked, false);
    if (!servedFrozen.blocked && servedFrozen.records[0]) {
      assert.throws(() => {
        (servedFrozen.records[0] as { issuerCik: string }).issuerCik = 'MUTATED';
      });
    }
    const duplicate = runtime.ingestSynthetic({
      xml: first,
      accession: 'SYN-ACC-1',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(duplicate, { status: 'duplicate', reason: 'duplicate' });

    const amendment = runtime.ingestSynthetic({
      xml: filingXml({
        form: 'SCHEDULE 13G/A',
        eventDate: '2025-12-31',
        filedInDocument: '2026-02-13',
        extra: '<amendmentNo>25</amendmentNo>',
        persons: [{
          name: 'SYNTHETIC ADVISER ALPHA',
          cik: 'SYN-CIK-FILER-A',
          typeXml: '<typeOfReportingPerson>IA</typeOfReportingPerson>',
          percent: '0',
          shares: '0',
        }],
      }),
      accession: 'SYN-ACC-2',
      filedDate: '2026-02-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(amendment.status, 'admitted');
    if (amendment.status !== 'admitted') return;
    assert.equal(amendment.record.isAmendment, true);
    assert.equal(amendment.record.amendmentNumber, '25');
    assert.equal(amendment.record.isSale, false);
    assert.equal(amendment.record.filers[0]?.reportedZeroHolding, true);
    assert.equal(amendment.record.filers[0]?.zeroHoldingIsSale, false);
    assert.equal(amendment.record.positionChange, 'not-inferred');
    assert.match(amendment.record.chainNote ?? '', /earlier filings not shown/);

    const sameAccession = runtime.correct({
      priorAccession: 'SYN-ACC-1',
      accession: 'SYN-ACC-1',
      xml: filingXml({ eventDate: '2026-01-15', filedInDocument: '2026-01-20' }),
      filedDate: '2026-01-20',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(sameAccession, { status: 'conflict', reason: 'conflict' });

    const conflict = runtime.ingestSynthetic({
      xml: filingXml({
        persons: [{
          name: 'SYNTHETIC ADVISER ALPHA',
          cik: 'SYN-CIK-FILER-A',
          typeXml: '<typeOfReportingPerson>IA</typeOfReportingPerson>',
          percent: '1.0',
          shares: '10',
        }],
      }),
      accession: 'SYN-ACC-1',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(conflict, { status: 'conflict', reason: 'conflict' });
    const served = runtime.serve();
    assert.equal(served.blocked, false);
    if (served.blocked) return;
    const original = served.records.find((record) => record.accession === 'SYN-ACC-1');
    assert.equal(original?.filers[0]?.reportedPercentAsFiled, '6.5');

    const drifted = runtime.correct({
      priorAccession: 'SYN-ACC-1',
      accession: 'SYN-ACC-DRIFT',
      xml: filingXml({
        classTitles: ['Preferred Shares Series A'],
        eventDate: '2026-01-15',
        filedInDocument: '2026-01-20',
      }),
      filedDate: '2026-01-20',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(drifted.status, 'conflict');
    if (drifted.status === 'conflict') assert.equal(drifted.reason, 'lineage-conflict');
    const kept = runtime.serve();
    assert.equal(kept.blocked, false);
    if (!kept.blocked) {
      assert.equal(kept.records.find((record) => record.accession === 'SYN-ACC-1')?.filers[0]?.reportedPercentAsFiled, '6.5');
    }

    const corrected = runtime.correct({
      priorAccession: 'SYN-ACC-1',
      accession: 'SYN-ACC-3',
      xml: filingXml({ eventDate: '2026-01-15', filedInDocument: '2026-01-20' }),
      filedDate: '2026-01-20',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(corrected.status, 'admitted');
    if (corrected.status !== 'admitted') return;
    assert.equal(corrected.record.eventDateAsReported, '2026-01-15');
    assert.equal(corrected.record.filedDate, '2026-01-20');
    assert.equal(corrected.record.isSale, false);
    const prior = runtime.tombstones().find((item) => item.accession === 'SYN-ACC-1');
    assert.equal(prior?.reason, 'corrected');
    assert.equal(prior?.payload, null);
    assert.equal(prior?.eventDateAsReported, '2025-09-30');
    assert.equal(prior?.filedDate, '2025-11-13');
    assert.equal(store.read('SYN-ACC-1'), null);

    runtime.withdraw('SYN-ACC-2');
    const withdrawn = runtime.tombstones().find((item) => item.accession === 'SYN-ACC-2');
    assert.equal(withdrawn?.reason, 'withdrawn');
    assert.equal(withdrawn?.payload, null);
    assert.equal(store.read('SYN-ACC-2'), null);
    const after = runtime.serve();
    if (after.blocked) return;
    assert.equal(after.records.some((record) => record.accession === 'SYN-ACC-2'), false);

    runtime.markStale(['SYN-ACC-3']);
    assert.equal(runtime.serve().blocked, false);
    const stale = runtime.tombstones().find((item) => item.accession === 'SYN-ACC-3');
    assert.equal(stale, undefined);
    runtime.markStale([]);
    const hidden = runtime.tombstones().find((item) => item.accession === 'SYN-ACC-3');
    assert.equal(hidden?.reason, 'stale');
    assert.equal(hidden?.payload, null);
    assert.notEqual(interpretAbsence(0).meansZeroHolding, true);
    assert.equal(interpretAbsence(0).label, 'not-observed');
  });

  it('does not sum percentages across filers', () => {
    const evaluation = evaluate({
      xml: filingXml({
        persons: [
          {
            name: 'SYNTHETIC ADVISER ALPHA',
            cik: 'SYN-CIK-FILER-A',
            typeXml: '<typeOfReportingPerson>IA</typeOfReportingPerson>',
            percent: '6.5',
            shares: '65',
          },
          {
            name: 'SYNTHETIC HOLDER BETA',
            cik: 'SYN-CIK-FILER-B',
            typeXml: '<typeOfReportingPerson>HC</typeOfReportingPerson>',
            percent: '4.0',
            shares: '40',
          },
        ],
      }),
      accession: 'SYN-ACC-SUM',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A'), reviewed('SYN-CIK-FILER-B')],
    });
    assert.equal(evaluation.status, 'admitted');
    if (evaluation.status !== 'admitted') return;
    assert.equal(evaluation.record.filers.length, 2);
    assert.equal(evaluation.record.crossFilerPercentSum, null);
    assert.deepEqual(crossFilerPercentSum(), {
      allowed: false,
      value: null,
      reason: 'cross-filer-sum-forbidden',
    });
    assert.equal(JSON.stringify(evaluation.record).includes('10.5'), false);
  });

  it('keeps exclusion metrics, logs, and errors free of source bodies and person identifiers', () => {
    const runtime = openRuntime();
    const rejected = runtime.ingestSynthetic({
      xml: filingXml({
        persons: [{
          name: PERSON,
          cik: PERSON_CIK,
          typeXml: '<typeOfReportingPerson>IN</typeOfReportingPerson>',
          percent: '9.0',
          shares: '9',
        }],
      }),
      accession: 'SYN-ACC-LEAK',
      filedDate: '2025-11-13',
      eligibility: [],
    });
    assert.deepEqual(rejected, { status: 'rejected', reason: 'individual' });
    assert.deepEqual(runtime.logs(), [{ at: T0, reason: 'individual', source: 'sec-schedule-13dg' }]);
    const metrics = runtime.metrics();
    for (const [key, value] of Object.entries(metrics)) {
      assert.equal(typeof value, 'number');
      assert.equal(key.includes(PERSON_CIK), false);
    }
    assert.equal(metrics.individual, 1);
    assertNoLeak(rejected);
    assertNoLeak(runtime.logs());
    assertNoLeak(metrics);
    assert.equal(runtime.secondaryStores().includes('sqlite'), false);
  });

  it('deletes logs at the 7-day boundary and metadata outside a cleared 365-day window', () => {
    const runtime = openRuntime();
    runtime.ingestSynthetic({
      xml: filingXml({ persons: [{ name: PERSON, cik: PERSON_CIK, typeXml: '<typeOfReportingPerson>IN</typeOfReportingPerson>' }] }),
      accession: 'SYN-ACC-LOG',
      filedDate: '2025-11-13',
      eligibility: [],
    });
    runtime.purgeLogs(T0 + LOG_TTL_MS - 1);
    assert.equal(runtime.logs().length, 1);
    runtime.purgeLogs(T0 + LOG_TTL_MS);
    assert.deepEqual(runtime.logs(), []);

    const row: MetadataRow = {
      id: 'row-1',
      storedAt: T0,
      payload: {
        source: 'sec-schedule-13dg',
        synthetic: true,
      } as AdmittedSchedule13dgRecord,
    };
    const refused = writeMetadata([], row, FUTURE_ENABLEMENT_CLEARED);
    assert.equal(refused.ok, false);
    const rows: MetadataRow[] = [row];
    deleteExpiredMetadata(rows, T0 + METADATA_TTL_MS - 1, true);
    assert.equal(rows.length, 1);
    deleteExpiredMetadata(rows, T0 + METADATA_TTL_MS, true);
    assert.equal(rows.length, 0);
    rows.push(row);
    deleteExpiredMetadata(rows, T0, false);
    assert.equal(rows.length, 0);
  });

  it('refuses persistence until synthetic-contract retention is explicit', () => {
    const store = memoryStore();
    const runtime = createSchedule13dgRuntime({
      clock: () => T0,
      stores: [store],
      requiredStoreIds: ['memory-stand-in'],
    });
    runtime.unlockSyntheticEvaluation();
    const refused = runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-REFUSED',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
      reviewedClasses: REVIEWED_CLASSES,
    });
    assert.deepEqual(refused, { status: 'not-persisted', reason: 'persistence-refused' });
    assert.equal(store.read('SYN-ACC-REFUSED'), null);
    const served = runtime.serve();
    assert.equal(served.blocked, false);
    if (!served.blocked) assert.equal(served.records.length, 0);
    assert.equal(runtime.futureEnablementCleared(), false);
    assert.equal(runtime.gatesCleared(), false);
  });

  it('scrubs every store with readback and keeps cleanup available while killed', () => {
    const store = memoryStore();
    const runtime = openRuntime({ stores: [store] });
    assert.deepEqual(runtime.enrollSecondaryStore(store), { accepted: false, reason: 'enrollment-closed' });
    runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-SCRUB',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.ok(store.read('SYN-ACC-SCRUB'));
    runtime.engageKillSwitch();
    const killed = runtime.withdraw('SYN-ACC-SCRUB');
    assert.equal(killed.scrub, 'complete');
    assert.equal(store.read('SYN-ACC-SCRUB'), null);
    const tombstone = runtime.tombstones().find((item) => item.accession === 'SYN-ACC-SCRUB');
    assert.equal(tombstone?.payload, null);
    assert.equal(tombstone?.scrub, 'complete');
    assert.equal(JSON.stringify(tombstone).includes(CUSIP), false);
    assert.deepEqual(runtime.serve(), { blocked: true, records: [] });
    assert.equal(runtime.liveIngestImplemented(), false);
  });

  it('bounds retries without a socket and refuses a zero budget before any attempt', async () => {
    let calls = 0;
    const zero = await runBoundedAccess({
      budgetRequests: 0,
      transport: async () => {
        calls += 1;
        return { status: 200 };
      },
      sleep: async () => {
        throw new Error('sleep');
      },
    });
    assert.equal(zero.outcome, 'refused-zero-budget');
    assert.equal(zero.accessGatePassed, false);
    assert.equal(zero.productionWired, false);
    assert.equal(zero.sharedAcrossCalls, false);
    assert.equal(ACCESS_REVIEW.status, 'unapproved');
    assert.equal(calls, 0);

    const waits: number[] = [];
    const retried = await runBoundedAccess({
      budgetRequests: 3,
      transport: async () => {
        calls += 1;
        return { status: calls < 3 ? 429 : 200 };
      },
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    assert.equal(retried.outcome, 'completed');
    assert.equal(retried.transportCalls, 3);
    assert.deepEqual(waits, [1000, 2000]);

    calls = 0;
    const capped = await runBoundedAccess({
      budgetRequests: 1,
      transport: async () => {
        calls += 1;
        return { status: 403 };
      },
      sleep: async () => {
        throw new Error('sleep');
      },
    });
    assert.equal(capped.outcome, 'failed-closed');
    assert.equal(calls, 1);
    assert.deepEqual(capped.waits, []);
  });

  it('rejects 13F and Section 16 forms, real accessions, and count mismatches', () => {
    const form13f = evaluate({
      xml: filingXml({ form: '13F-HR' }),
      accession: 'SYN-ACC-13F',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(form13f, { status: 'rejected', reason: 'out-of-scope' });
    const form4 = evaluate({
      xml: filingXml({ form: 'FORM 4' }),
      accession: 'SYN-ACC-F4',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(form4, { status: 'rejected', reason: 'out-of-scope' });
    const real = evaluate({
      xml: filingXml(),
      accession: '0000000000-26-000001',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(real, { status: 'rejected', reason: 'non-synthetic-accession' });
    const mismatch = evaluate({
      xml: filingXml({ count: '2' }),
      accession: 'SYN-ACC-COUNT',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(mismatch, { status: 'rejected', reason: 'unknown' });
  });

  it('reads a 13D issuer CIK tag and a flagged type code without keeping identifiers', () => {
    const evaluation = evaluate({
      xml: filingXml({
        form: 'SCHEDULE 13D/A',
        eventTag: 'dateOfEventRequiringStatement',
        eventDate: '01/15/2026',
        filedInDocument: '2026-01-16',
        extra: '<issuerCIK>SYN-CIK-ISSUER-9</issuerCIK><amendmentNumber>2</amendmentNumber>',
        issuerCiks: [],
        persons: [{
          name: 'SYNTHETIC ADVISER ALPHA',
          cik: 'SYN-CIK-FILER-A',
          typeXml: '<typeOfReportingPerson><isIA>Y</isIA></typeOfReportingPerson>',
          percent: '5.0',
          shares: '50',
        }],
      }),
      accession: 'SYN-ACC-VARIANT',
      filedDate: '2026-01-16',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(evaluation.status, 'admitted');
    if (evaluation.status !== 'admitted') return;
    assert.equal(evaluation.record.issuerCik, 'SYN-CIK-ISSUER-9');
    assert.equal(evaluation.record.formType, 'SCHEDULE 13D/A');
    assert.equal(evaluation.record.amendmentNumber, '2');
    assert.equal(evaluation.record.eventDateAsReported, '2026-01-15');
    assert.equal(evaluation.record.filedDate, '2026-01-16');
    assert.equal(JSON.stringify(evaluation).includes('SYNTHETIC ADVISER ALPHA'), false);
    assertNoLeak(evaluation);
  });

  it('rejects adversarial type flags, hidden persons, bad identifiers, and bad dates', () => {
    const hidden = evaluate({
      xml: filingXml({
        extra: [
          '<signatureBlock><reportingPersonInfo>',
          `<reportingPersonName>${PERSON}</reportingPersonName>`,
          `<reportingPersonCik>${PERSON_CIK}</reportingPersonCik>`,
          '<typeOfReportingPerson>IN</typeOfReportingPerson>',
          '</reportingPersonInfo></signatureBlock>',
        ].join(''),
        count: '2',
        coverCount: '2',
      }),
      accession: 'SYN-ACC-HIDDEN',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A'), reviewed(PERSON_CIK)],
    });
    assert.equal(hidden.status, 'rejected');
    if (hidden.status === 'rejected') assert.equal(hidden.reason, 'mixed');
    assertNoLeak(hidden);

    const nested = evaluate({
      xml: filingXml({
        persons: [{
          name: 'SYNTHETIC ADVISER ALPHA',
          cik: 'SYN-CIK-FILER-A',
          typeXml: `<typeOfReportingPerson>IA</typeOfReportingPerson><reportingPersonInfo><reportingPersonName>${PERSON}</reportingPersonName><reportingPersonCik>${PERSON_CIK}</reportingPersonCik><typeOfReportingPerson>IN</typeOfReportingPerson></reportingPersonInfo>`,
          percent: '6.5',
          shares: '65',
        }],
        count: '2',
        coverCount: '2',
      }),
      accession: 'SYN-ACC-NEST',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A'), reviewed(PERSON_CIK)],
    });
    assert.equal(nested.status, 'rejected');
    if (nested.status === 'rejected') assert.equal(nested.reason, 'mixed');

    const flagged = evaluate({
      xml: filingXml({
        persons: [{
          cik: 'SYN-CIK-FILER-A',
          typeXml: '<typeOfReportingPerson><isIA>Y</isIA><isIN>X</isIN></typeOfReportingPerson>',
          percent: '6.5',
          shares: '65',
        }],
      }),
      accession: 'SYN-ACC-FLAG',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(flagged, { status: 'rejected', reason: 'unknown' });

    const unknownKey = evaluate({
      xml: filingXml({
        persons: [{
          cik: 'SYN-CIK-FILER-A',
          typeXml: '<typeOfReportingPerson><isIA>Y</isIA><isZZ>N</isZZ></typeOfReportingPerson>',
          percent: '6.5',
          shares: '65',
        }],
      }),
      accession: 'SYN-ACC-ZZ',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(unknownKey, { status: 'rejected', reason: 'unknown' });

    const duplicateCik = evaluate({
      xml: filingXml({
        persons: [
          { cik: 'SYN-CIK-FILER-A', typeXml: '<typeOfReportingPerson>IA</typeOfReportingPerson>', percent: '6.5', shares: '65' },
          { cik: 'SYN-CIK-FILER-A', typeXml: '<typeOfReportingPerson>HC</typeOfReportingPerson>', percent: '4.0', shares: '40' },
        ],
      }),
      accession: 'SYN-ACC-DUPCIK',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(duplicateCik, { status: 'rejected', reason: 'unknown' });

    const badCik = evaluate({
      xml: filingXml({
        persons: [{
          cik: CUSIP,
          typeXml: '<typeOfReportingPerson>IA</typeOfReportingPerson>',
          percent: '6.5',
          shares: '65',
        }],
      }),
      accession: 'SYN-ACC-BADCIK',
      filedDate: '2025-11-13',
      eligibility: [reviewed(CUSIP)],
    });
    assert.equal(badCik.status, 'rejected');
    assertNoLeak(badCik);

    const badClass = evaluate({
      xml: filingXml({ classTitles: ['Ordinary Units'] }),
      accession: 'SYN-ACC-CLASS',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(badClass, { status: 'rejected', reason: 'ambiguous-class' });
    assert.equal(JSON.stringify(badClass).includes('Ordinary Units'), false);

    const badDate = evaluate({
      xml: filingXml({ eventDate: '2025-02-29' }),
      accession: 'SYN-ACC-DATE',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(badDate, { status: 'rejected', reason: 'unknown' });

    const mismatch = evaluate({
      xml: filingXml({ filedInDocument: '2025-11-14' }),
      accession: 'SYN-ACC-DOC',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(mismatch, { status: 'rejected', reason: 'unknown' });

    const noCount = evaluate({
      xml: filingXml({ omitCounts: true }),
      accession: 'SYN-ACC-NOCOUNT',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(noCount, { status: 'rejected', reason: 'unknown' });

    const leap = evaluate({
      xml: filingXml({ eventDate: '2024-02-29' }),
      accession: 'SYN-ACC-LEAP',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(leap.status, 'admitted');
  });

  it('parses an http namespace without calling the network', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response('');
    }) as typeof fetch;
    try {
      const evaluation = evaluate({
        xml: filingXml({ namespace: true }),
        accession: 'SYN-ACC-NS',
        filedDate: '2025-11-13',
        eligibility: [reviewed('SYN-CIK-FILER-A')],
      });
      assert.equal(evaluation.status, 'admitted');
      assert.equal(calls, 0);
      assertNoLeak(evaluation);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('rolls back a partial write and reports a throwing store after readback', () => {
    const flags = { throwWrite: false, throwDelete: false };
    const first = controlledStore('store-a', flags);
    const secondFlags = { throwWrite: true, throwDelete: false };
    const second = controlledStore('store-b', secondFlags);
    const runtime = openRuntime({ stores: [first, second] });
    const partial = runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-PART',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(partial.status, 'incomplete');
    if (partial.status === 'incomplete') assert.equal(partial.reason, 'partial-write');
    assert.equal(first.read('SYN-ACC-PART'), null);
    assert.equal(second.read('SYN-ACC-PART'), null);
    const served = runtime.serve();
    assert.equal(served.blocked, false);
    if (!served.blocked) assert.equal(served.records.length, 0);

    secondFlags.throwWrite = false;
    flags.throwDelete = true;
    const stored = runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-THROW',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(stored.status, 'admitted');
    runtime.engageKillSwitch();
    const incomplete = runtime.scrub('SYN-ACC-THROW', 'withdrawn');
    assert.equal(incomplete.scrub, 'incomplete');
    assert.equal(incomplete.storesRemaining.includes('store-a'), true);
    assert.ok(first.read('SYN-ACC-THROW'));
    assert.equal(second.read('SYN-ACC-THROW'), null);
    flags.throwDelete = false;
    const cleaned = runtime.withdraw('SYN-ACC-THROW');
    assert.equal(cleaned.scrub, 'complete');
    assert.equal(first.read('SYN-ACC-THROW'), null);
    assert.deepEqual(runtime.serve(), { blocked: true, records: [] });

    const duplicate = memoryStore();
    const unverified = createSchedule13dgRuntime({
      clock: () => T0,
      stores: [duplicate, memoryStore()],
    });
    unverified.unlockSyntheticEvaluation();
    assert.equal(unverified.storesVerified(), false);
    const blocked = unverified.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-UNVERIFIED',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
      reviewedClasses: REVIEWED_CLASSES,
    });
    assert.deepEqual(blocked, { status: 'blocked', reason: 'store-unverified' });
    assert.equal(unverified.serve().blocked, true);
  });

  it('expires synthetic records and tombstones on the injected clock', () => {
    let now = T0;
    const store = memoryStore();
    const runtime = openRuntime({ stores: [store], clock: () => now });
    runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-EXPIRE',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    now = T0 + METADATA_TTL_MS - 1;
    const kept = runtime.serve();
    assert.equal(kept.blocked, false);
    if (!kept.blocked) assert.equal(kept.records.length, 1);
    now = T0 + METADATA_TTL_MS;
    const expired = runtime.serve();
    assert.equal(expired.blocked, false);
    if (!expired.blocked) assert.equal(expired.records.length, 0);
    assert.equal(store.read('SYN-ACC-EXPIRE'), null);
    const tombstone = runtime.tombstones().find((item) => item.accession === 'SYN-ACC-EXPIRE');
    assert.equal(tombstone?.payload, null);
    now = T0 + (METADATA_TTL_MS * 2);
    assert.equal(runtime.tombstones().some((item) => item.accession === 'SYN-ACC-EXPIRE'), false);

    const logs = openRuntime({ clock: () => now });
    now = T0;
    logs.ingestSynthetic({
      xml: filingXml({
        persons: [{ name: PERSON, cik: PERSON_CIK, typeXml: '<typeOfReportingPerson>IN</typeOfReportingPerson>' }],
      }),
      accession: 'SYN-ACC-LOG2',
      filedDate: '2025-11-13',
      eligibility: [],
    });
    assert.equal(logs.logs().length, 1);
    assert.equal(logs.logs()[0]?.reason, 'individual');
    assert.equal(JSON.stringify(logs.logs()).includes('<'), false);
    now = T0 + LOG_TTL_MS;
    assert.deepEqual(logs.logs(), []);
  });

  it('ages default Date.now retention and restores the clock', () => {
    const original = Date.now;
    let t = 1_700_000_000_000;
    Date.now = () => t;
    try {
      const runtime = createSchedule13dgRuntime({ retention: 'synthetic-contract' });
      runtime.unlockSyntheticEvaluation();
      assert.equal(runtime.productionStoreManifestVerified(), false);
      const admitted = runtime.ingestSynthetic({
        xml: filingXml(),
        accession: 'SYN-ACC-CLOCK',
        filedDate: '2025-11-13',
        eligibility: [reviewed('SYN-CIK-FILER-A')],
        reviewedClasses: REVIEWED_CLASSES,
      });
      assert.equal(admitted.status, 'admitted');
      runtime.ingestSynthetic({
        xml: filingXml({
          persons: [{ name: PERSON, cik: PERSON_CIK, typeXml: '<typeOfReportingPerson>IN</typeOfReportingPerson>' }],
        }),
        accession: 'SYN-ACC-CLOCK-LOG',
        filedDate: '2025-11-13',
        eligibility: [],
        reviewedClasses: REVIEWED_CLASSES,
      });
      t += LOG_TTL_MS - 1;
      assert.equal(runtime.logs().some((entry) => entry.reason === 'individual'), true);
      const kept = runtime.serve();
      assert.equal(kept.blocked, false);
      if (!kept.blocked) assert.equal(kept.records.length, 1);
      t += 1;
      assert.equal(runtime.logs().some((entry) => entry.reason === 'individual'), false);
      t = 1_700_000_000_000 + METADATA_TTL_MS;
      const expired = runtime.serve();
      assert.equal(expired.blocked, false);
      if (!expired.blocked) assert.equal(expired.records.length, 0);
    } finally {
      Date.now = original;
    }
    assert.equal(Date.now, original);
  });

  it('refuses to re-admit a tombstoned accession', () => {
    const runtime = openRuntime();
    runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-TOMB',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    runtime.withdraw('SYN-ACC-TOMB');
    const again = runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-TOMB',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(again, { status: 'conflict', reason: 'tombstoned-accession' });
    const served = runtime.serve();
    assert.equal(served.blocked, false);
    if (!served.blocked) assert.equal(served.records.some((record) => record.accession === 'SYN-ACC-TOMB'), false);

    runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-STALE',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    runtime.markStale([]);
    const stale = runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-STALE',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(stale, { status: 'conflict', reason: 'tombstoned-accession' });
  });

  it('keeps an incomplete rollback retryable and blocks serve', () => {
    const second = controlledStore('store-b', { throwWrite: true, throwDelete: false });
    const paired = openRuntime({
      stores: [controlledStore('store-a', { throwWrite: false, throwDelete: true }), second],
      requiredStoreIds: ['store-a', 'store-b'],
    });
    const failed = paired.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-RESIDUAL',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(failed.status, 'incomplete');
    if (failed.status === 'incomplete') {
      assert.equal(failed.reason, 'partial-write');
      assert.equal(failed.storesRemaining.includes('store-a'), true);
    }
    const blockedServe = paired.serve();
    assert.equal(blockedServe.blocked, true);
    if (blockedServe.blocked) assert.equal(blockedServe.reason, 'scrub-incomplete');
    const tomb = paired.tombstones().find((item) => item.accession === 'SYN-ACC-RESIDUAL');
    assert.equal(tomb?.scrub, 'incomplete');
  });

  it('reports an incomplete prior scrub instead of a successful correction', () => {
    const flags = { throwWrite: false, throwDelete: false };
    const store = controlledStore('store-a', flags);
    const runtime = openRuntime({ stores: [store], requiredStoreIds: ['store-a'] });
    runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-PRIOR',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    flags.throwDelete = true;
    const corrected = runtime.correct({
      priorAccession: 'SYN-ACC-PRIOR',
      accession: 'SYN-ACC-NEXT',
      xml: filingXml({ eventDate: '2026-01-15', filedInDocument: '2026-01-20' }),
      filedDate: '2026-01-20',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(corrected.status, 'incomplete');
    if (corrected.status === 'incomplete') assert.equal(corrected.reason, 'prior-scrub-incomplete');
    assert.notEqual(corrected.status, 'admitted');
    assert.equal(runtime.serve().blocked, true);
    assert.ok(store.read('SYN-ACC-PRIOR'));
    flags.throwDelete = false;
    const cleaned = runtime.scrub('SYN-ACC-PRIOR', 'corrected');
    assert.equal(cleaned.scrub, 'complete');
    assert.equal(store.read('SYN-ACC-PRIOR'), null);
    const served = runtime.serve();
    assert.equal(served.blocked, false);
    if (!served.blocked) assert.equal(served.records.some((record) => record.accession === 'SYN-ACC-NEXT'), false);
  });

  it('refuses a correction whose destination is already live or tombstoned', () => {
    const store = memoryStore();
    const runtime = openRuntime({ stores: [store], requiredStoreIds: ['memory-stand-in'] });
    const xmlA = filingXml({ eventDate: '2025-09-30' });
    const xmlB = filingXml({ eventDate: '2025-10-31' });
    const xmlC = filingXml({ eventDate: '2025-12-15' });
    runtime.ingestSynthetic({
      xml: xmlA,
      accession: 'SYN-ACC-A',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    runtime.withdraw('SYN-ACC-A');
    runtime.ingestSynthetic({
      xml: xmlB,
      accession: 'SYN-ACC-B',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    runtime.ingestSynthetic({
      xml: xmlC,
      accession: 'SYN-ACC-C',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    const storeB = JSON.stringify(store.read('SYN-ACC-B'));
    const storeC = JSON.stringify(store.read('SYN-ACC-C'));
    assert.equal(store.read('SYN-ACC-A'), null);

    const resurrect = runtime.correct({
      priorAccession: 'SYN-ACC-B',
      accession: 'SYN-ACC-A',
      xml: xmlB,
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(resurrect.status, 'conflict');
    if (resurrect.status === 'conflict') assert.equal(resurrect.reason, 'tombstoned-accession');
    assert.equal(JSON.stringify(store.read('SYN-ACC-B')), storeB);
    assert.equal(JSON.stringify(store.read('SYN-ACC-C')), storeC);
    assert.equal(store.read('SYN-ACC-A'), null);
    const afterResurrect = runtime.serve();
    assert.equal(afterResurrect.blocked, false);
    if (!afterResurrect.blocked) {
      assert.equal(afterResurrect.records.some((record) => record.accession === 'SYN-ACC-A'), false);
      assert.equal(afterResurrect.records.find((record) => record.accession === 'SYN-ACC-B')?.eventDateAsReported, '2025-10-31');
      assert.equal(afterResurrect.records.find((record) => record.accession === 'SYN-ACC-C')?.eventDateAsReported, '2025-12-15');
    }
    assert.equal(runtime.tombstones().find((item) => item.accession === 'SYN-ACC-A')?.reason, 'withdrawn');
    assert.equal(runtime.tombstones().some((item) => item.accession === 'SYN-ACC-B'), false);

    const overwrite = runtime.correct({
      priorAccession: 'SYN-ACC-B',
      accession: 'SYN-ACC-C',
      xml: xmlB,
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(overwrite.status, 'conflict');
    if (overwrite.status === 'conflict') assert.equal(overwrite.reason, 'conflict');
    assert.equal(JSON.stringify(store.read('SYN-ACC-B')), storeB);
    assert.equal(JSON.stringify(store.read('SYN-ACC-C')), storeC);
    const afterOverwrite = runtime.serve();
    assert.equal(afterOverwrite.blocked, false);
    if (!afterOverwrite.blocked) {
      assert.equal(afterOverwrite.records.find((record) => record.accession === 'SYN-ACC-B')?.eventDateAsReported, '2025-10-31');
      assert.equal(afterOverwrite.records.find((record) => record.accession === 'SYN-ACC-C')?.eventDateAsReported, '2025-12-15');
    }
    assert.equal(runtime.tombstones().some((item) => item.accession === 'SYN-ACC-B'), false);
  });

  it('rejects embedded and letter-first identifier candidates even on a reviewed class', () => {
    const cases = [
      '037833100',
      'G0176J109',
      'Common 037833100 Shares',
      'Note CA99999X9999',
      '037833-100',
      '037833 10 0',
      '037.833.100',
      'Notes 037833 10 0',
    ];
    for (const classTitle of cases) {
      const evaluation = evaluate({
        xml: filingXml({ classTitles: [classTitle] }),
        accession: 'SYN-ACC-ID',
        filedDate: '2025-11-13',
        eligibility: [reviewed('SYN-CIK-FILER-A')],
        reviewedClasses: [{ issuerCik: 'SYN-CIK-ISSUER-1', classTitleAsFiled: classTitle }],
      });
      assert.equal(evaluation.status, 'rejected', classTitle);
      assert.equal(JSON.stringify(evaluation).includes('037833100'), false);
      assert.equal(JSON.stringify(evaluation).includes('G0176J109'), false);
      assert.equal(JSON.stringify(evaluation).includes('CA99999X9999'), false);
    }
    for (const classTitle of ['Common Shares', 'Preferred Shares Series A', 'Class A Common', 'Series 100']) {
      const evaluation = evaluate({
        xml: filingXml({ classTitles: [classTitle] }),
        accession: 'SYN-ACC-WORD',
        filedDate: '2025-11-13',
        eligibility: [reviewed('SYN-CIK-FILER-A')],
        reviewedClasses: [{ issuerCik: 'SYN-CIK-ISSUER-1', classTitleAsFiled: classTitle }],
      });
      assert.equal(evaluation.status, 'admitted', classTitle);
    }
  });

  it('joins separated letter and digit spans before the CUSIP and ISIN windows', () => {
    const flagged = [
      '1037833 10 0',
      'G0176J 10 9',
      'G0176J-10-9',
      'Notes G0176J 10 9',
      'US 037833 10 05',
      'US.037833.10.05',
      'Common US 037833 10 05 Shares',
    ];
    for (const classTitle of flagged) {
      const evaluation = evaluate({
        xml: filingXml({ classTitles: [classTitle] }),
        accession: 'SYN-ACC-SPAN',
        filedDate: '2025-11-13',
        eligibility: [reviewed('SYN-CIK-FILER-A')],
        reviewedClasses: [{ issuerCik: 'SYN-CIK-ISSUER-1', classTitleAsFiled: classTitle }],
      });
      assert.equal(evaluation.status, 'rejected', classTitle);
      const text = JSON.stringify(evaluation);
      for (const leaked of ['1037833', 'G0176J', '037833', classTitle]) {
        assert.equal(text.includes(leaked), false, `${classTitle} leaked ${leaked}`);
      }
    }
    const clear = [
      'Series 100',
      'Common Shares',
      'Preferred Shares Series A',
      'Class A Common',
      'Series 2025 Notes',
      'Rule 13d-1 Shares',
      'Class B 10 Shares',
    ];
    for (const classTitle of clear) {
      const evaluation = evaluate({
        xml: filingXml({ classTitles: [classTitle] }),
        accession: 'SYN-ACC-PROSE',
        filedDate: '2025-11-13',
        eligibility: [reviewed('SYN-CIK-FILER-A')],
        reviewedClasses: [{ issuerCik: 'SYN-CIK-ISSUER-1', classTitleAsFiled: classTitle }],
        fetch: { timestampUtc: '2026-11-11T15:00:00.000Z', timestampCtLabel: '2026-11-11 CT' },
      });
      assert.equal(evaluation.status, 'admitted', classTitle);
    }
  });

  it('rejects a same-accession correction before lineage and never scrubs the prior record', () => {
    const store = memoryStore();
    const runtime = openRuntime({ stores: [store], requiredStoreIds: ['memory-stand-in'] });
    const admitted = runtime.ingestSynthetic({
      xml: filingXml({ eventDate: '2025-09-30' }),
      accession: 'SYN-ACC-SAME',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(admitted.status, 'admitted');
    const before = JSON.stringify(store.read('SYN-ACC-SAME'));
    const conflictsBefore = runtime.metrics().conflict ?? 0;
    for (const xml of [filingXml({ eventDate: '2026-01-15' }), filingXml({ eventDate: '2025-09-30' })]) {
      const same = runtime.correct({
        priorAccession: 'SYN-ACC-SAME',
        accession: 'SYN-ACC-SAME',
        xml,
        filedDate: '2025-11-13',
        eligibility: [reviewed('SYN-CIK-FILER-A')],
      });
      assert.deepEqual(same, { status: 'conflict', reason: 'conflict' });
    }
    assert.equal(runtime.metrics().conflict, conflictsBefore + 2);
    assert.equal(JSON.stringify(store.read('SYN-ACC-SAME')), before);
    assert.equal(runtime.tombstones().some((item) => item.accession === 'SYN-ACC-SAME'), false);
    const served = runtime.serve();
    assert.equal(served.blocked, false);
    if (!served.blocked) {
      assert.equal(served.records.find((record) => record.accession === 'SYN-ACC-SAME')?.eventDateAsReported, '2025-09-30');
    }
  });

  it('returns duplicate for a correction whose destination is already live and identical', () => {
    const store = memoryStore();
    const runtime = openRuntime({ stores: [store], requiredStoreIds: ['memory-stand-in'] });
    const xmlPrior = filingXml({ eventDate: '2025-09-30' });
    const xmlNext = filingXml({ eventDate: '2025-10-31' });
    runtime.ingestSynthetic({
      xml: xmlPrior,
      accession: 'SYN-ACC-PRIOR',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    const next = runtime.ingestSynthetic({
      xml: xmlNext,
      accession: 'SYN-ACC-NEXT',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(next.status, 'admitted');
    const storePrior = JSON.stringify(store.read('SYN-ACC-PRIOR'));
    const storeNext = JSON.stringify(store.read('SYN-ACC-NEXT'));
    const duplicate = runtime.correct({
      priorAccession: 'SYN-ACC-PRIOR',
      accession: 'SYN-ACC-NEXT',
      xml: xmlNext,
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(duplicate, { status: 'duplicate', reason: 'duplicate' });
    assert.equal(JSON.stringify(store.read('SYN-ACC-PRIOR')), storePrior);
    assert.equal(JSON.stringify(store.read('SYN-ACC-NEXT')), storeNext);
    assert.equal(runtime.tombstones().some((item) => item.accession === 'SYN-ACC-PRIOR'), false);
    const served = runtime.serve();
    assert.equal(served.blocked, false);
    if (!served.blocked) {
      assert.equal(served.records.find((record) => record.accession === 'SYN-ACC-PRIOR')?.eventDateAsReported, '2025-09-30');
      assert.equal(served.records.find((record) => record.accession === 'SYN-ACC-NEXT')?.eventDateAsReported, '2025-10-31');
    }
  });

  it('fails closed unless the declared store ids match the stand-ins exactly', () => {
    const store = memoryStore();
    const undeclared = createSchedule13dgRuntime({
      clock: () => T0,
      retention: 'synthetic-contract',
      stores: [store],
    });
    undeclared.unlockSyntheticEvaluation();
    assert.equal(undeclared.storesVerified(), false);
    assert.equal(undeclared.productionStoreManifestVerified(), false);
    assert.deepEqual(undeclared.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-MANIFEST',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
      reviewedClasses: REVIEWED_CLASSES,
    }), { status: 'blocked', reason: 'store-unverified' });

    const extra = controlledStore('store-b', { throwWrite: false, throwDelete: false });
    const mismatch = createSchedule13dgRuntime({
      clock: () => T0,
      retention: 'synthetic-contract',
      stores: [controlledStore('store-a', { throwWrite: false, throwDelete: false }), extra],
      requiredStoreIds: ['store-a'],
    });
    mismatch.unlockSyntheticEvaluation();
    assert.equal(mismatch.storesVerified(), false);
    assert.equal(mismatch.productionStoreManifestVerified(), false);
    assert.equal(mismatch.serve().blocked, true);

    const exact = createSchedule13dgRuntime({
      clock: () => T0,
      retention: 'synthetic-contract',
      stores: [controlledStore('store-a', { throwWrite: false, throwDelete: false })],
      requiredStoreIds: ['store-a'],
    });
    exact.unlockSyntheticEvaluation();
    assert.equal(exact.storesVerified(), true);
    assert.equal(exact.productionStoreManifestVerified(), false);
    assert.equal(exact.secondaryStores().length, 1);
  });

  it('does not import a network client, a hash function, or a retired source', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const sourceDir = join(dir, '..');
    const files = readdirSync(sourceDir).filter((name) => name.endsWith('.ts'));
    assert.ok(files.length > 0);
    for (const name of files) {
      const text = readFileSync(join(sourceDir, name), 'utf8');
      assert.equal(/from ['"]node:crypto['"]/.test(text), false, name);
      assert.equal(/from ['"]undici['"]/.test(text), false, name);
      assert.equal(/httpGet/.test(text), false, name);
      assert.equal(/sec\.gov/.test(text), false, name);
      assert.equal(/sedi/i.test(text), false, name);
      assert.equal(/createHash/.test(text), false, name);
    }
  });
});
