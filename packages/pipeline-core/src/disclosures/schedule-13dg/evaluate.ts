// SPDX-License-Identifier: AGPL-3.0-only

import { XMLParser } from 'fast-xml-parser';
import {
  COVERAGE_CLAIMS,
  ENTITY_TYPE_CODE_SET,
  INDIVIDUAL_TYPE_CODE,
  OTHER_TYPE_CODE,
  PARSER_VERSION,
  REAL_EDGAR_ACCESSION,
  SYNTHETIC_ACCESSION,
} from './constants.js';
import type {
  AdmittedFiler,
  AdmittedSchedule13dgRecord,
  Evaluation,
  ExclusionReason,
  ReviewedEntityEligibility,
} from './types.js';

const FORBIDDEN_KEY = /cusip|isin|signature|signatory|address|street|postal|zip|exhibit|narrative|purpose|beneficiary|citizenship|comment/i;

const PERSON_KEYS = new Set([
  'reportingpersoninfo',
  'coverpageheaderreportingpersondetails',
]);

const EVENT_DATE_KEYS = new Set([
  'dateofeventrequiringstatement',
  'dateofevent',
  'eventdate',
]);

const FILED_DATE_KEYS = new Set(['filingdate', 'datefiled']);

const CLASS_TITLE_KEYS = new Set(['securitiesclasstitle', 'securitytitle']);

const FORM_TYPES = new Set([
  'SCHEDULE 13D',
  'SCHEDULE 13G',
  'SCHEDULE 13D/A',
  'SCHEDULE 13G/A',
]);

type FormType = AdmittedSchedule13dgRecord['formType'];

interface PersonDraft {
  filerCik: string | null;
  codes: string[] | 'unparseable';
  reportedPercentAsFiled: string | null;
  reportedSharesAsFiled: string | null;
}

const ALWAYS_ARRAY = new Set([
  'issuercik',
  'securitiesclasstitle',
  'securitytitle',
  'reportingpersoninfo',
  'coverpageheaderreportingpersondetails',
  'dateofeventrequiringstatement',
  'dateofevent',
  'eventdate',
  'filingdate',
  'datefiled',
  'submissiontype',
  'amendmentno',
  'amendmentnumber',
  'reportingpersoncount',
]);

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) => ALWAYS_ARRAY.has(name.toLowerCase()),
});

export function crossFilerPercentSum(): { allowed: false; value: null; reason: 'cross-filer-sum-forbidden' } {
  return { allowed: false, value: null, reason: 'cross-filer-sum-forbidden' };
}

export function interpretAbsence(observedFilings: number): {
  observedFilings: number;
  meansZeroHolding: false;
  label: 'not-observed' | 'observed';
} {
  return {
    observedFilings,
    meansZeroHolding: false,
    label: observedFilings === 0 ? 'not-observed' : 'observed',
  };
}

export function evaluateFiling(input: {
  xml: string;
  accession: string;
  filedDate: string;
  eligibility: readonly ReviewedEntityEligibility[];
  fetch?: { timestampUtc: string; timestampCtLabel: string | null };
}): Evaluation {
  if (!SYNTHETIC_ACCESSION.test(input.accession) || REAL_EDGAR_ACCESSION.test(input.accession)) {
    return reject('non-synthetic-accession');
  }
  if (typeof input.xml !== 'string' || looksLikeNetwork(input.xml)) {
    return reject('network-refused');
  }
  if (!isIsoDate(input.filedDate)) {
    return reject('unknown');
  }

  let parsed: unknown;
  try {
    parsed = xmlParser.parse(input.xml);
  } catch {
    return reject('parse-failed');
  }
  const tree = stripForbidden(parsed);
  if (!tree || typeof tree !== 'object') return reject('parse-failed');

  const form = readForm(tree);
  if (form === 'out-of-scope') return reject('out-of-scope');
  if (form === 'parse-failed') return reject('parse-failed');

  const issuerCiks = uniqueStrings(collectKeyStrings(tree, new Set(['issuercik'])));
  if (issuerCiks.length !== 1) return reject('ambiguous-issuer');

  const classTitles = uniqueStrings(collectKeyStrings(tree, CLASS_TITLE_KEYS));
  if (classTitles.length !== 1) return reject('ambiguous-class');

  const eventDates = normalizeUnique(collectKeyStrings(tree, EVENT_DATE_KEYS));
  if (eventDates === null || eventDates.length !== 1) return reject('unknown');

  const documentFiled = normalizeUnique(collectKeyStrings(tree, FILED_DATE_KEYS));
  if (documentFiled === null || documentFiled.length > 1) return reject('unknown');

  const persons = collectPersons(tree);
  if (persons === null) return reject('unknown');

  const declared = collectKeyStrings(tree, new Set(['reportingpersoncount']));
  if (declared.length > 0) {
    const expected = uniqueStrings(declared);
    if (expected.length !== 1 || expected[0] !== String(persons.length)) return reject('unknown');
  }

  const screen = screenPersons(persons);
  if (screen !== 'entity-screen') return reject(screen);

  const filers = admitPersons(persons, input.eligibility);
  if (typeof filers === 'string') return reject(filers);

  const amendmentNumber = readAmendmentNumber(tree);
  const isAmendment = form.endsWith('/A') || amendmentNumber !== null;
  const record: AdmittedSchedule13dgRecord = {
    source: 'sec-schedule-13dg',
    synthetic: true,
    accession: input.accession,
    formType: form,
    amendmentNumber,
    isAmendment,
    isSale: false,
    inferredTrade: null,
    positionChange: 'not-inferred',
    issuerCik: issuerCiks[0] ?? '',
    classTitleAsFiled: classTitles[0] ?? '',
    filers,
    eventDateAsReported: eventDates[0] ?? '',
    filedDate: input.filedDate,
    documentFiledDate: documentFiled.length === 1 ? documentFiled[0] ?? null : null,
    fetch: {
      timestampUtc: input.fetch?.timestampUtc ?? null,
      timestampCtLabel: input.fetch?.timestampCtLabel ?? null,
      parserVersion: PARSER_VERSION,
    },
    chainNote: isAmendment
      ? `Amendment No. ${amendmentNumber ?? 'unnumbered'} (earlier filings not shown)`
      : null,
    completeness: COVERAGE_CLAIMS.completeness,
    realtime: COVERAGE_CLAIMS.realtime,
    crossFilerPercentSum: null,
  };

  if (leaks(record)) return reject('unknown');
  return { status: 'admitted', record };
}

export function canonicalRecord(record: AdmittedSchedule13dgRecord): string {
  return JSON.stringify({
    accession: record.accession,
    formType: record.formType,
    amendmentNumber: record.amendmentNumber,
    issuerCik: record.issuerCik,
    classTitleAsFiled: record.classTitleAsFiled,
    eventDateAsReported: record.eventDateAsReported,
    filedDate: record.filedDate,
    documentFiledDate: record.documentFiledDate,
    filers: record.filers.map((filer) => ({
      filerCik: filer.filerCik,
      eligibilityReviewId: filer.eligibilityReviewId,
      reportedPercentAsFiled: filer.reportedPercentAsFiled,
      reportedSharesAsFiled: filer.reportedSharesAsFiled,
    })),
  });
}

function reject(reason: ExclusionReason): Evaluation {
  return { status: 'rejected', reason };
}

function looksLikeNetwork(xml: string): boolean {
  const trimmed = xml.trim();
  if (/^(https?:)?\/\//i.test(trimmed)) return true;
  return /https?:\/\//i.test(xml);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function stripForbidden(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripForbidden);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) continue;
    out[key] = stripForbidden(child);
  }
  return out;
}

function readForm(tree: unknown): FormType | 'out-of-scope' | 'parse-failed' {
  const raw = collectKeyStrings(tree, new Set(['submissiontype']));
  if (raw.length !== 1) return 'parse-failed';
  const text = (raw[0] ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (
    text.includes('13F')
    || text.includes('FORM 3')
    || text.includes('FORM 4')
    || text.includes('FORM 5')
    || text.includes('SECTION 16')
  ) {
    return 'out-of-scope';
  }
  const normalized = text.startsWith('SCHEDULE ') ? text : `SCHEDULE ${text}`;
  if (!FORM_TYPES.has(normalized)) return 'parse-failed';
  return normalized as FormType;
}

function readAmendmentNumber(tree: unknown): string | null {
  const raw = collectKeyStrings(tree, new Set(['amendmentno', 'amendmentnumber']));
  const unique = uniqueStrings(raw.map((item) => item.trim()).filter((item) => item.length > 0));
  if (unique.length !== 1) return null;
  return unique[0] ?? null;
}

function collectPersons(tree: unknown): PersonDraft[] | null {
  const blocks: Record<string, unknown>[] = [];
  collectKeyedObjects(tree, PERSON_KEYS, blocks);
  if (blocks.length === 0) return null;
  const persons: PersonDraft[] = [];
  for (const block of blocks) {
    const codes = typeCodesFrom(valueByKey(block, 'typeofreportingperson'));
    const filerCik = firstString(block, ['reportingpersoncik', 'reportingcik', 'filercik']);
    const percent = firstString(block, ['percentofclass', 'classpercent']);
    const shares = firstString(block, ['aggregateamountowned']);
    if (percent === 'invalid' || shares === 'invalid') return null;
    persons.push({
      filerCik,
      codes,
      reportedPercentAsFiled: percent,
      reportedSharesAsFiled: shares,
    });
  }
  return persons;
}

function screenPersons(persons: readonly PersonDraft[]): 'entity-screen' | 'individual' | 'mixed' | 'unknown' {
  let individual = 0;
  let entity = 0;
  let other = 0;
  for (const person of persons) {
    const kind = personKind(person);
    if (kind === 'mixed') return 'mixed';
    if (kind === 'unknown') other += 1;
    else if (kind === 'individual') individual += 1;
    else entity += 1;
  }
  if (individual > 0 && (entity > 0 || other > 0)) return 'mixed';
  if (individual > 0) return 'individual';
  if (other > 0) return 'unknown';
  return 'entity-screen';
}

function personKind(person: PersonDraft): 'entity' | 'individual' | 'mixed' | 'unknown' {
  if (person.codes === 'unparseable' || person.codes.length === 0) return 'unknown';
  const unique = uniqueStrings(person.codes);
  if (unique.length !== 1) {
    if (unique.includes(INDIVIDUAL_TYPE_CODE)) return 'mixed';
    return 'unknown';
  }
  const code = unique[0] ?? '';
  if (code === INDIVIDUAL_TYPE_CODE) return 'individual';
  if (code === OTHER_TYPE_CODE || !ENTITY_TYPE_CODE_SET.has(code)) return 'unknown';
  return 'entity';
}

function admitPersons(
  persons: readonly PersonDraft[],
  eligibility: readonly ReviewedEntityEligibility[],
): AdmittedFiler[] | ExclusionReason {
  const filers: AdmittedFiler[] = [];
  let failure: ExclusionReason | null = null;
  for (const person of persons) {
    if (!person.filerCik) return 'unknown';
    const reviewed = eligibility.filter((item) => item.filerCik === person.filerCik);
    if (reviewed.length !== 1) {
      failure = failure ?? 'eligibility-not-reviewed';
      continue;
    }
    const record = reviewed[0];
    if (!record) {
      failure = failure ?? 'eligibility-not-reviewed';
      continue;
    }
    void record.files13fManager;
    if (record.status === 'ambiguous') return 'unknown';
    if (record.status === 'unreviewed') {
      failure = failure ?? 'eligibility-not-reviewed';
      continue;
    }
    if (record.status === 'reviewed-ineligible' || record.personalVehicleRisk !== 'reviewed-absent') {
      failure = failure ?? 'eligibility-rejected';
      continue;
    }
    if (record.status !== 'reviewed-eligible') {
      failure = failure ?? 'eligibility-not-reviewed';
      continue;
    }
    filers.push({
      filerCik: person.filerCik,
      eligibilityReviewId: record.reviewId,
      reportedPercentAsFiled: person.reportedPercentAsFiled,
      reportedSharesAsFiled: person.reportedSharesAsFiled,
      reportedZeroHolding: isZeroToken(person.reportedPercentAsFiled) || isZeroToken(person.reportedSharesAsFiled),
      zeroHoldingIsSale: false,
    });
  }
  if (failure) return failure;
  if (filers.length !== persons.length) return 'unknown';
  return filers;
}

function typeCodesFrom(value: unknown): string[] | 'unparseable' {
  if (typeof value === 'string') {
    const parts = value.split(/[^A-Za-z]+/).filter((part) => part.length > 0).map((part) => part.toUpperCase());
    if (parts.length === 0) return 'unparseable';
    return parts;
  }
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      const codes = typeCodesFrom(item);
      if (codes === 'unparseable') return 'unparseable';
      out.push(...codes);
    }
    return out.length > 0 ? out : 'unparseable';
  }
  if (value && typeof value === 'object') {
    const out: string[] = [];
    for (const [key, child] of Object.entries(value)) {
      if (key.toLowerCase() === 'type' && typeof child === 'string') {
        const codes = typeCodesFrom(child);
        if (codes === 'unparseable') return 'unparseable';
        out.push(...codes);
        continue;
      }
      const code = key.replace(/^is/i, '').toUpperCase();
      const truthy = child === true || child === 'Y' || child === 'y' || child === '1' || child === 'true';
      if (truthy && /^[A-Z]{2}$/.test(code)) out.push(code);
    }
    return out.length > 0 ? out : 'unparseable';
  }
  return 'unparseable';
}

function firstString(obj: Record<string, unknown>, names: readonly string[]): string | null | 'invalid' {
  const wanted = new Set(names);
  const found: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (!wanted.has(key.toLowerCase())) continue;
    if (typeof value !== 'string') return 'invalid';
    const trimmed = value.trim();
    if (trimmed.length > 0) found.push(trimmed);
  }
  const unique = uniqueStrings(found);
  if (unique.length > 1) return 'invalid';
  return unique[0] ?? null;
}

function valueByKey(obj: Record<string, unknown>, name: string): unknown {
  for (const [key, value] of Object.entries(obj)) {
    if (key.toLowerCase() === name) return value;
  }
  return undefined;
}

function collectKeyedObjects(
  node: unknown,
  keys: ReadonlySet<string>,
  out: Record<string, unknown>[],
): void {
  if (Array.isArray(node)) {
    for (const item of node) collectKeyedObjects(item, keys, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (keys.has(key.toLowerCase())) {
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          out.push(item as Record<string, unknown>);
        }
      }
      continue;
    }
    collectKeyedObjects(value, keys, out);
  }
}

function collectKeyStrings(node: unknown, keys: ReadonlySet<string>): string[] {
  const out: string[] = [];
  walkStrings(node, keys, out);
  return out;
}

function walkStrings(node: unknown, keys: ReadonlySet<string>, out: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) walkStrings(item, keys, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (keys.has(key.toLowerCase())) {
      pushStrings(value, out);
      continue;
    }
    walkStrings(value, keys, out);
  }
}

function pushStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) out.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) pushStrings(item, out);
  }
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function normalizeUnique(values: readonly string[]): string[] | null {
  if (values.length === 0) return [];
  const normalized: string[] = [];
  for (const value of values) {
    const date = normalizeDate(value);
    if (!date) return null;
    normalized.push(date);
  }
  return uniqueStrings(normalized);
}

function normalizeDate(raw: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (us) return `${us[3]}-${us[1]}-${us[2]}`;
  return null;
}

function isZeroToken(value: string | null): boolean {
  if (value === null) return false;
  return /^0+(?:\.0+)?$/.test(value.trim());
}

function leaks(value: unknown): boolean {
  const json = JSON.stringify(value).toLowerCase();
  return json.includes('cusip')
    || json.includes('isin')
    || json.includes('<')
    || json.includes('sha256')
    || json.includes('signature')
    || json.includes('http://')
    || json.includes('https://');
}
