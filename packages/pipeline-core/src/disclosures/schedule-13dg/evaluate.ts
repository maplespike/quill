// SPDX-License-Identifier: AGPL-3.0-only

import { XMLParser } from 'fast-xml-parser';
import {
  CLASS_TITLE,
  COVERAGE_CLAIMS,
  ENTITY_TYPE_CODE_SET,
  INDIVIDUAL_TYPE_CODE,
  OTHER_TYPE_CODE,
  PARSER_VERSION,
  REAL_EDGAR_ACCESSION,
  REVIEW_ID,
  SYNTHETIC_ACCESSION,
  SYNTHETIC_CIK,
} from './constants.js';
import type {
  AdmittedFiler,
  AdmittedSchedule13dgRecord,
  Evaluation,
  ExclusionReason,
  ReviewedEntityEligibility,
} from './types.js';

const KNOWN_TYPE_CODES: ReadonlySet<string> = new Set([
  ...ENTITY_TYPE_CODE_SET,
  INDIVIDUAL_TYPE_CODE,
  OTHER_TYPE_CODE,
]);

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

const PERCENT = /^(?:100(?:\.0)?|[1-9]\d?(?:\.\d)?|0(?:\.\d)?)$/;
const SHARES = /^(?:0|[1-9]\d{0,17})$/;
const AMENDMENT_NO = /^(?:0|[1-9]\d{0,2})$/;
const COUNT_TOKEN = /^(?:0|[1-9]\d{0,3})$/;
const FETCH_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const FETCH_CT = /^\d{4}-\d{2}-\d{2} CT$/;

type FormType = AdmittedSchedule13dgRecord['formType'];

interface PersonDraft {
  filerCik: string;
  codes: string[] | 'unparseable';
  reportedPercentAsFiled: string | null;
  reportedSharesAsFiled: string | null;
}

interface ReviewedClass {
  issuerCik: string;
  classTitleAsFiled: string;
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
  'coverpagereportingpersoncount',
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
  reviewedClasses: readonly ReviewedClass[];
  fetch?: { timestampUtc: string; timestampCtLabel: string | null };
}): Evaluation {
  if (!SYNTHETIC_ACCESSION.test(input.accession) || REAL_EDGAR_ACCESSION.test(input.accession)) {
    return reject('non-synthetic-accession');
  }
  if (typeof input.xml !== 'string' || isBareUrl(input.xml)) {
    return reject('network-refused');
  }
  if (!isRealDate(input.filedDate)) return reject('unknown');

  let parsed: unknown;
  try {
    parsed = xmlParser.parse(input.xml);
  } catch {
    return reject('parse-failed');
  }
  if (!parsed || typeof parsed !== 'object') return reject('parse-failed');

  const form = readForm(parsed);
  if (form === 'out-of-scope') return reject('out-of-scope');
  if (form === 'parse-failed') return reject('parse-failed');

  const persons = collectPersons(parsed);
  if (persons === null) return reject('unknown');
  const declared = readCount(parsed, 'reportingpersoncount');
  const cover = readCount(parsed, 'coverpagereportingpersoncount');
  if (declared === null || cover === null || declared !== cover || declared !== persons.length || declared < 1) {
    return reject('unknown');
  }

  const screen = screenPersons(persons);
  if (screen !== 'entity-screen') return reject(screen);
  if (new Set(persons.map((person) => person.filerCik)).size !== persons.length) return reject('unknown');

  const issuerCiks = uniqueStrings(collectKeyStrings(parsed, new Set(['issuercik'])))
    .filter((value) => syntheticCik(value) === value);
  const rawIssuerCount = collectKeyStrings(parsed, new Set(['issuercik'])).length;
  if (rawIssuerCount !== 1 || issuerCiks.length !== 1) return reject('ambiguous-issuer');
  const issuerCik = issuerCiks[0] ?? '';

  const classTitles = uniqueStrings(collectKeyStrings(parsed, CLASS_TITLE_KEYS));
  if (classTitles.length !== 1) return reject('ambiguous-class');
  const classTitle = classTitles[0] ?? '';
  if (!CLASS_TITLE.test(classTitle)) return reject('ambiguous-class');
  if (prohibitedValue(classTitle)) return reject('unknown');
  const classReviewed = input.reviewedClasses.some((item) =>
    item.issuerCik === issuerCik
    && item.classTitleAsFiled === classTitle
    && CLASS_TITLE.test(item.classTitleAsFiled)
    && !prohibitedValue(item.classTitleAsFiled),
  );
  if (!classReviewed) return reject('ambiguous-class');

  const eventDates = normalizeUnique(collectKeyStrings(parsed, EVENT_DATE_KEYS));
  if (eventDates === null || eventDates.length !== 1) return reject('unknown');
  const eventDate = eventDates[0] ?? '';

  const documentFiled = normalizeUnique(collectKeyStrings(parsed, FILED_DATE_KEYS));
  if (documentFiled === null || documentFiled.length !== 1 || documentFiled[0] !== input.filedDate) {
    return reject('unknown');
  }

  const amendment = readAmendmentNumber(parsed);
  if (amendment === 'invalid') return reject('unknown');
  const isAmendment = form.endsWith('/A');
  if (isAmendment && amendment === null) return reject('unknown');
  if (!isAmendment && amendment !== null) return reject('unknown');

  const fetchUtc = input.fetch?.timestampUtc ?? null;
  const fetchCt = input.fetch?.timestampCtLabel ?? null;
  if (fetchUtc !== null && !FETCH_UTC.test(fetchUtc)) return reject('unknown');
  if (fetchCt !== null && !FETCH_CT.test(fetchCt)) return reject('unknown');

  const filers = admitPersons(persons, input.eligibility);
  if (typeof filers === 'string') return reject(filers);

  const record: AdmittedSchedule13dgRecord = {
    source: 'sec-schedule-13dg',
    synthetic: true,
    accession: input.accession,
    formType: form,
    amendmentNumber: amendment,
    isAmendment,
    isSale: false,
    inferredTrade: null,
    positionChange: 'not-inferred',
    issuerCik,
    classTitleAsFiled: classTitle,
    filers,
    eventDateAsReported: eventDate,
    filedDate: input.filedDate,
    documentFiledDate: input.filedDate,
    fetch: {
      timestampUtc: fetchUtc,
      timestampCtLabel: fetchCt,
      parserVersion: PARSER_VERSION,
    },
    chainNote: isAmendment
      ? `Amendment No. ${amendment ?? ''} (earlier filings not shown)`
      : null,
    completeness: COVERAGE_CLAIMS.completeness,
    realtime: COVERAGE_CLAIMS.realtime,
    crossFilerPercentSum: null,
  };

  if (retainedLeak(record)) return reject('unknown');
  return { status: 'admitted', record: freezeRecord(record) };
}

export function freezeRecord(record: AdmittedSchedule13dgRecord): AdmittedSchedule13dgRecord {
  const clone = structuredClone(record);
  for (const filer of clone.filers) Object.freeze(filer);
  Object.freeze(clone.filers);
  Object.freeze(clone.fetch);
  return Object.freeze(clone);
}

export function recordLineage(record: AdmittedSchedule13dgRecord): {
  issuerCik: string;
  classTitleAsFiled: string;
  filerCiks: string[];
} {
  return {
    issuerCik: record.issuerCik,
    classTitleAsFiled: record.classTitleAsFiled,
    filerCiks: record.filers.map((filer) => filer.filerCik).sort(),
  };
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

function isBareUrl(xml: string): boolean {
  const trimmed = xml.trim();
  return /^https?:\/\//i.test(trimmed) && !trimmed.includes('<');
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

function readAmendmentNumber(tree: unknown): string | null | 'invalid' {
  const raw = collectKeyStrings(tree, new Set(['amendmentno', 'amendmentnumber']))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const unique = uniqueStrings(raw);
  if (unique.length === 0) return null;
  if (unique.length !== 1) return 'invalid';
  const value = unique[0] ?? '';
  if (!AMENDMENT_NO.test(value) || prohibitedValue(value)) return 'invalid';
  return value;
}

function readCount(tree: unknown, key: string): number | null {
  const raw = collectKeyStrings(tree, new Set([key]));
  if (raw.length !== 1) return null;
  const value = raw[0] ?? '';
  if (!COUNT_TOKEN.test(value)) return null;
  return Number(value);
}

function collectPersons(tree: unknown): PersonDraft[] | null {
  const blocks: Record<string, unknown>[] = [];
  collectPersonBlocks(tree, blocks);
  if (blocks.length === 0) return null;
  const persons: PersonDraft[] = [];
  for (const block of blocks) {
    const codes = typeCodesFrom(valueByKey(block, 'typeofreportingperson'));
    const cikField = oneString(block, ['reportingpersoncik', 'reportingcik', 'filercik']);
    const percent = oneString(block, ['percentofclass', 'classpercent']);
    const shares = oneString(block, ['aggregateamountowned']);
    if (!cikField.ok || !percent.ok || !shares.ok) return null;
    const filerCik = syntheticCik(cikField.value);
    if (filerCik === 'bad' || filerCik === null) return null;
    if (percent.value !== null && !PERCENT.test(percent.value)) return null;
    if (shares.value !== null && !SHARES.test(shares.value)) return null;
    if (percent.value !== null && prohibitedValue(percent.value)) return null;
    if (shares.value !== null && prohibitedValue(shares.value)) return null;
    if (contradictoryZero(percent.value, shares.value)) return null;
    persons.push({
      filerCik,
      codes,
      reportedPercentAsFiled: percent.value,
      reportedSharesAsFiled: shares.value,
    });
  }
  return persons;
}

function contradictoryZero(percent: string | null, shares: string | null): boolean {
  const percentZero = isZeroToken(percent);
  const sharesZero = isZeroToken(shares);
  if (percentZero && shares !== null && !sharesZero) return true;
  if (sharesZero && percent !== null && !percentZero) return true;
  return false;
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
  if (entity !== persons.length) return 'unknown';
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
    const reviewed = eligibility.filter((item) => item.filerCik === person.filerCik && REVIEW_ID.test(item.reviewId));
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
    if (!REVIEW_ID.test(record.reviewId) || prohibitedValue(record.reviewId)) return 'unknown';
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
    if (parts.some((part) => !KNOWN_TYPE_CODES.has(part))) return 'unparseable';
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
    const entries = Object.entries(value);
    if (entries.length === 0) return 'unparseable';
    const out: string[] = [];
    for (const [key, child] of entries) {
      if (key.toLowerCase() === 'type') {
        const codes = typeCodesFrom(child);
        if (codes === 'unparseable') return 'unparseable';
        out.push(...codes);
        continue;
      }
      const code = key.replace(/^is/i, '').toUpperCase();
      if (!KNOWN_TYPE_CODES.has(code)) return 'unparseable';
      if (child === true || child === 'Y' || child === 'y' || child === '1' || child === 'true') {
        out.push(code);
        continue;
      }
      if (child === false || child === 'N' || child === 'n' || child === '0' || child === 'false') continue;
      return 'unparseable';
    }
    return out.length > 0 ? out : 'unparseable';
  }
  return 'unparseable';
}

function oneString(obj: Record<string, unknown>, names: readonly string[]): { ok: true; value: string | null } | { ok: false } {
  const wanted = new Set(names);
  const found: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (!wanted.has(key.toLowerCase())) continue;
    if (typeof value !== 'string') return { ok: false };
    const trimmed = value.trim();
    if (trimmed.length > 0) found.push(trimmed);
  }
  const unique = uniqueStrings(found);
  if (unique.length > 1) return { ok: false };
  return { ok: true, value: unique[0] ?? null };
}

function syntheticCik(value: string | null): string | null | 'bad' {
  if (value === null) return null;
  if (!SYNTHETIC_CIK.test(value) || prohibitedValue(value)) return 'bad';
  return value;
}

function valueByKey(obj: Record<string, unknown>, name: string): unknown {
  for (const [key, value] of Object.entries(obj)) {
    if (key.toLowerCase() === name) return value;
  }
  return undefined;
}

function collectPersonBlocks(node: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectPersonBlocks(item, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (PERSON_KEYS.has(key.toLowerCase())) {
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          out.push(item as Record<string, unknown>);
          collectPersonBlocks(item, out);
        }
      }
      continue;
    }
    collectPersonBlocks(value, out);
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
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const value = `${iso[1]}-${iso[2]}-${iso[3]}`;
    return isRealDate(value) ? value : null;
  }
  const us = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (us) {
    const value = `${us[3]}-${us[1]}-${us[2]}`;
    return isRealDate(value) ? value : null;
  }
  return null;
}

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1990 || year > 2100 || month < 1 || month > 12) return false;
  const days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const limit = month === 2 && leap ? 29 : days[month] ?? 0;
  return day >= 1 && day <= limit;
}

function isZeroToken(value: string | null): boolean {
  if (value === null) return false;
  return /^0+(?:\.0+)?$/.test(value.trim());
}

function prohibitedValue(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower.includes('cusip') || lower.includes('isin') || lower.includes('<') || lower.includes('sha256')) {
    return true;
  }
  const upper = value.toUpperCase();
  if (identifierRuns(upper).some((run) => hasCusipCandidate(run) || hasIsinCandidate(run))) return true;
  if (SYNTHETIC_CIK.test(value) || SYNTHETIC_ACCESSION.test(value) || REVIEW_ID.test(value)) return false;
  if (/^[0-9A-Z]+(?:-[0-9A-Z]+)+$/i.test(value.trim())) {
    const hyphenJoined = upper.replace(/-/g, '');
    if (hasCusipCandidate(hyphenJoined) || hasIsinCandidate(hyphenJoined)) return true;
  }
  return digitSeparatorSpans(upper).some((span) => {
    const digits = span.replace(/[^0-9]/g, '');
    return digits.length === 9 && hasCusipCandidate(digits);
  });
}

/**
 * A CUSIP candidate is a 9-character window in one alphanumeric run:
 * 8 letters or digits, then a digit check character, and either all digits
 * or at least one letter plus at least three digits. "Preferred" is nine
 * letters and its last character is not a digit, so it is not a candidate.
 * "Common" and "Shares" are shorter than nine characters.
 * An ISIN candidate is a 12-character window: two letters, nine letters or
 * digits, and a final digit, with at least one digit in the window.
 * A whole hyphenated alphanumeric token is joined, so `037833-100` is still a candidate.
 * Digit groups separated only by spaces, dots, or hyphens are joined, so
 * `037833 10 0` and `037.833.100` are candidates. This is a shape heuristic.
 * It is not proof that a value is a CUSIP, and it is not a privacy clearance.
 * Words stay in their own runs. `Common Shares` and `Preferred Shares Series A`
 * do not contain a 9-digit separator span.
 */
function identifierRuns(value: string): string[] {
  return value.match(/[0-9A-Z]+/g) ?? [];
}

function digitSeparatorSpans(value: string): string[] {
  return value.match(/[0-9]+(?:[ .\-][0-9]+)+/g) ?? [];
}

function hasCusipCandidate(run: string): boolean {
  if (run.length < 9) return false;
  for (let index = 0; index <= run.length - 9; index += 1) {
    const window = run.slice(index, index + 9);
    if (!/^[0-9A-Z]{8}[0-9]$/.test(window)) continue;
    const digits = window.replace(/[^0-9]/g, '').length;
    const letters = window.replace(/[^A-Z]/g, '').length;
    if (digits === 9 || (letters >= 1 && digits >= 3)) return true;
  }
  return false;
}

function hasIsinCandidate(run: string): boolean {
  if (run.length < 12) return false;
  for (let index = 0; index <= run.length - 12; index += 1) {
    const window = run.slice(index, index + 12);
    if (/^[A-Z]{2}[0-9A-Z]{9}[0-9]$/.test(window) && /[0-9]/.test(window)) return true;
  }
  return false;
}

function retainedLeak(record: AdmittedSchedule13dgRecord): boolean {
  const fields = [
    record.accession,
    record.issuerCik,
    record.classTitleAsFiled,
    record.amendmentNumber ?? '',
    record.eventDateAsReported,
    record.filedDate,
    record.documentFiledDate ?? '',
    record.fetch.timestampUtc ?? '',
    record.fetch.timestampCtLabel ?? '',
    record.chainNote ?? '',
    ...record.filers.flatMap((filer) => [
      filer.filerCik,
      filer.eligibilityReviewId,
      filer.reportedPercentAsFiled ?? '',
      filer.reportedSharesAsFiled ?? '',
    ]),
  ];
  return fields.some((field) => prohibitedValue(field) || /https?:\/\//i.test(field));
}
