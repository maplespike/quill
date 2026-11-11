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
import type { AdmittedSchedule13dgRecord, ReviewedEntityEligibility, SecondaryStore } from '../index.js';

const PERSON = 'SYNTHETIC NATURAL PERSON';
const PERSON_CIK = 'SYN-CIK-PERSON-1';
const CUSIP = '99999X999';
const ISIN = 'CA99999X9999';
const NARRATIVE = 'SECRET NARRATIVE BODY';
const SIGNATORY = 'SYNTHETIC SIGNATORY NAME';
const RAW_TAG = '<edgarSubmission';

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-01-01T00:00:00.000Z');

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
  const filed = options.filedInDocument
    ? `<filingDate>${options.filedInDocument}</filingDate>`
    : '';
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
  const count = options.count ? `<reportingPersonCount>${options.count}</reportingPersonCount>` : '';
  return [
    '<edgarSubmission>',
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

function openRuntime() {
  const runtime = createSchedule13dgRuntime();
  runtime.setKillSwitch(false);
  return runtime;
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
      assert.equal(gate.status === 'green' || gate.status === 'approved', false);
    }
    const runtime = createSchedule13dgRuntime();
    assert.equal(runtime.killSwitchEngaged(), true);
    assert.equal(runtime.liveIngestImplemented(), false);
    assert.deepEqual(runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-1',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
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
        assert.ok(error instanceof Schedule13dgDisabledError);
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
      const unreviewed = evaluateFiling({
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
      const eligible = evaluateFiling({
        xml,
        accession: 'SYN-ACC-TYPE',
        filedDate: '2025-11-13',
        eligibility: [reviewed('SYN-CIK-FILER-A', { files13fManager: true })],
      });
      const ignored = evaluateFiling({
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
    const individual = evaluateFiling({
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

    const mixed = evaluateFiling({
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

    const unknown = evaluateFiling({
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

    const missing = evaluateFiling({
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
    const ambiguous = evaluateFiling({
      xml,
      accession: 'SYN-ACC-AMB',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A', { status: 'ambiguous' })],
    });
    assert.deepEqual(ambiguous, { status: 'rejected', reason: 'unknown' });

    const vehicle = evaluateFiling({
      xml,
      accession: 'SYN-ACC-VEH',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A', { personalVehicleRisk: 'present', files13fManager: true })],
    });
    assert.deepEqual(vehicle, { status: 'rejected', reason: 'eligibility-rejected' });

    const partial = evaluateFiling({
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
    const issuer = evaluateFiling({
      xml: filingXml({ issuerCiks: ['SYN-CIK-ISSUER-1', 'SYN-CIK-ISSUER-2'] }),
      accession: 'SYN-ACC-ISS',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(issuer, { status: 'rejected', reason: 'ambiguous-issuer' });

    const securityClass = evaluateFiling({
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
    const evaluation = evaluateFiling({
      xml: filingXml({
        form: 'SCHEDULE 13D',
        eventTag: 'dateOfEventRequiringStatement',
        eventDate: '09/30/2025',
        issuerCiks: ['SYN-CIK-ISSUER-1'],
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

    const missingEvent = evaluateFiling({
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
    const runtime = openRuntime();
    const store = memoryStore();
    runtime.registerSecondaryStore(store);
    const first = filingXml({ eventDate: '2025-09-30' });
    const admitted = runtime.ingestSynthetic({
      xml: first,
      accession: 'SYN-ACC-1',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.equal(admitted.status, 'admitted');
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
      xml: filingXml({ eventDate: '2026-01-15' }),
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

    const corrected = runtime.correct({
      priorAccession: 'SYN-ACC-1',
      accession: 'SYN-ACC-3',
      xml: filingXml({ eventDate: '2026-01-15' }),
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
    const evaluation = evaluateFiling({
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
      now: T0,
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
      now: T0,
    });
    runtime.purgeLogs(T0 + LOG_TTL_MS - 1);
    assert.equal(runtime.logs().length, 1);
    runtime.purgeLogs(T0 + LOG_TTL_MS);
    assert.deepEqual(runtime.logs(), []);

    const row = {
      id: 'row-1',
      storedAt: T0,
      payload: {
        source: 'sec-schedule-13dg',
        synthetic: true,
      } as AdmittedSchedule13dgRecord,
    };
    const refused = writeMetadata([], row, FUTURE_ENABLEMENT_CLEARED);
    assert.equal(refused.ok, false);
    const rows = [row];
    deleteExpiredMetadata(rows, T0 + METADATA_TTL_MS - 1, true);
    assert.equal(rows.length, 1);
    deleteExpiredMetadata(rows, T0 + METADATA_TTL_MS, true);
    assert.deepEqual(rows, []);
    rows.push(row);
    deleteExpiredMetadata(rows, T0, false);
    assert.deepEqual(rows, []);
  });

  it('scrubs an injected secondary store and reports that no other store is attached', () => {
    const runtime = openRuntime();
    assert.deepEqual(runtime.secondaryStores(), []);
    const store = memoryStore();
    runtime.registerSecondaryStore(store);
    runtime.ingestSynthetic({
      xml: filingXml(),
      accession: 'SYN-ACC-SCRUB',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.ok(store.read('SYN-ACC-SCRUB'));
    runtime.scrub('SYN-ACC-SCRUB', 'withdrawn');
    assert.equal(store.read('SYN-ACC-SCRUB'), null);
    const tombstone = runtime.tombstones().find((item) => item.accession === 'SYN-ACC-SCRUB');
    assert.equal(tombstone?.payload, null);
    assert.equal(JSON.stringify(tombstone).includes(CUSIP), false);
    runtime.setKillSwitch(true);
    assert.deepEqual(runtime.serve(), { blocked: true, records: [] });
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
    const form13f = evaluateFiling({
      xml: filingXml({ form: '13F-HR' }),
      accession: 'SYN-ACC-13F',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(form13f, { status: 'rejected', reason: 'out-of-scope' });
    const form4 = evaluateFiling({
      xml: filingXml({ form: 'FORM 4' }),
      accession: 'SYN-ACC-F4',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(form4, { status: 'rejected', reason: 'out-of-scope' });
    const real = evaluateFiling({
      xml: filingXml(),
      accession: '0000000000-26-000001',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(real, { status: 'rejected', reason: 'non-synthetic-accession' });
    const mismatch = evaluateFiling({
      xml: filingXml({ count: '2' }),
      accession: 'SYN-ACC-COUNT',
      filedDate: '2025-11-13',
      eligibility: [reviewed('SYN-CIK-FILER-A')],
    });
    assert.deepEqual(mismatch, { status: 'rejected', reason: 'unknown' });
  });

  it('reads a 13D issuer CIK tag and a flagged type code without keeping identifiers', () => {
    const evaluation = evaluateFiling({
      xml: filingXml({
        form: 'SCHEDULE 13D/A',
        eventTag: 'dateOfEventRequiringStatement',
        eventDate: '01/15/2026',
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
