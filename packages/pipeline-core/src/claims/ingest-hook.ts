// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Ingestion claim hook (WS-1b)
 *
 * Content-addresses every record produced by an ingestion module at parse
 * time, so hashes exist in the citation store before any query is made.
 * This is the step that makes `maplespike.sqlite` actually populate and
 * turns "tool responses carry hashes" into "everything Quill ingests is
 * verifiable".
 *
 * `runModule` in ingestion/registry.ts calls `registerModuleClaims` after a
 * module's main ingest function returns. The hook is failure-safe: if claim
 * registration fails, ingestion continues — claims are a side effect, never
 * a gate.
 */

import { canonicalJson, buildClaimBundle } from './index.js';
import type { ClaimBundle } from './index.js';
import type { PublisherTermsEvidenceInput, SourceArtifactEvidenceInput } from './types.js';
import { normalizeUrlForMatch, redactArtifactUrl } from './evidence.js';
import { citationStore } from './store.js';
import { getIngestionArtifacts } from './artifact-capture.js';
import { NO_REUSE_LICENSE_NOTICE, resolvePublisherLicense } from '../shared/attribution.js';

/**
 * Derive a stable "claim statement" from a record. Uses the fields modules
 * most commonly emit (id, title, name, url) and falls back to a JSON
 * preview so every record still gets a human-readable claim.
 */
function recordClaimStatement(moduleName: string, record: Record<string, unknown>): string {
  const id = record.id ?? record.record_id ?? record.slug;
  const title = record.title ?? record.name ?? record.company_name ?? record.client_name ?? record.registrant_name;
  const url = record.url ?? record.source_url ?? record.sourceUrl;
  const bits: string[] = [];
  if (typeof id === 'string' || typeof id === 'number') bits.push(String(id));
  if (typeof title === 'string' && title.length > 0) bits.push(title);
  if (typeof url === 'string' && url.length > 0) bits.push(url);
  if (bits.length > 0) return `${moduleName}: ${bits.join(' — ')}`;
  // Last resort: a short canonical preview (deterministic, so the claim is stable).
  const preview = canonicalJson(record);
  return `${moduleName}: ${preview.length > 160 ? preview.slice(0, 157) + '…' : preview}`;
}

/**
 * Build a ClaimBundle for a single parsed record. The hash covers the
 * canonical JSON of the record itself, so `echo -n '<canonical json>' |
 * sha256sum` reproduces it.
 */
async function recordToClaim(
  moduleName: string,
  sourceLabel: string,
  defaultLicense: string,
  record: Record<string, unknown>,
  runArtifacts: SourceArtifactEvidenceInput[],
): Promise<ClaimBundle> {
  const claim = recordClaimStatement(moduleName, record);
  // Prefer a real per-record URL when present; the module-level source label
  // is only the last-resort fallback (it may be a portal name, not a URL).
  const recordUrl =
    (typeof record.url === 'string' && record.url) ||
    (typeof record.source_url === 'string' && record.source_url) ||
    (typeof record.sourceUrl === 'string' && record.sourceUrl) ||
    sourceLabel;
  const declared = resolvePublisherLicense(record);
  const hasPublisherDeclaration = declared.basis === 'publisher-metadata';
  const recordArtifacts = readSourceArtifactsEvidence(record.source_artifacts_evidence);
  const normalizedRecordUrl = normalizeUrlForMatch(recordUrl);
  const matchingRecordArtifacts = recordArtifacts.filter(artifact =>
    normalizedRecordUrl !== null && normalizeUrlForMatch(artifact.url) === normalizedRecordUrl,
  );
  const matchingRunArtifacts = runArtifacts.filter(artifact =>
    normalizedRecordUrl !== null && normalizeUrlForMatch(artifact.url) === normalizedRecordUrl,
  );
  const sourceRetrievedAt = matchingRecordArtifacts[0]?.retrievedAt ?? matchingRunArtifacts[0]?.retrievedAt;
  const publisherTermsEvidence = hasPublisherDeclaration
    ? readPublisherTermsEvidence(record)
    : undefined;
  const hasConfiguredLicense = defaultLicense !== NO_REUSE_LICENSE_NOTICE;
  return buildClaimBundle({
    claim,
    value: record,
    sourceName: moduleName,
    sourceUrl: recordUrl,
    retrievedAt: sourceRetrievedAt,
    license: hasPublisherDeclaration || declared.basis === 'source-configuration'
      ? declared.license
      : defaultLicense,
    ...(declared.licenseUrl ? { licenseUrl: declared.licenseUrl } : {}),
    licenseBasis: hasPublisherDeclaration
      ? 'publisher-metadata'
      : declared.basis === 'source-configuration' || hasConfiguredLicense
        ? 'source-configuration'
        : 'no-publisher-declaration',
    ...(recordArtifacts.length ? { sourceArtifactsEvidence: recordArtifacts } : {}),
    ...(publisherTermsEvidence ? { publisherTermsEvidence } : {}),
    attributionText: hasPublisherDeclaration || declared.basis === 'source-configuration'
      ? declared.attributionText
      : hasConfiguredLicense
        ? 'License information supplied by Quill source configuration; confirm scope and conditions with the publisher.'
        : declared.attributionText,
    transformations: ['ingestion'],
  }, { capturedArtifactsEvidence: runArtifacts });
}

function readSourceArtifactsEvidence(value: unknown): SourceArtifactEvidenceInput[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .filter(evidence => typeof evidence.url === 'string'
      && typeof evidence.retrievedAt === 'string'
      && Number.isFinite(Date.parse(evidence.retrievedAt))
      && typeof evidence.sha256 === 'string'
      && /^[a-f0-9]{64}$/i.test(evidence.sha256)
      && typeof evidence.statusCode === 'number'
      && Number.isInteger(evidence.statusCode)
      && evidence.statusCode >= 0
      && evidence.statusCode <= 599
      && (evidence.byteLength === undefined || (typeof evidence.byteLength === 'number' && Number.isInteger(evidence.byteLength) && evidence.byteLength >= 0))
      && ['complete-http-client-body', 'empty-body-not-captured'].includes(String(evidence.bodyCapture)))
    .map(evidence => ({
      url: redactArtifactUrl(evidence.url as string, evidence.urlRedacted === true)?.url ?? '',
      retrievedAt: evidence.retrievedAt as string,
      sha256: (evidence.sha256 as string).toLowerCase(),
      statusCode: evidence.statusCode as number,
      bodyCapture: evidence.bodyCapture === 'empty-body-not-captured'
        ? 'empty-body-not-captured'
        : 'complete-http-client-body',
      urlRedacted: redactArtifactUrl(evidence.url as string, evidence.urlRedacted === true)?.urlRedacted ?? true,
      ...(typeof evidence.mediaType === 'string' ? { mediaType: evidence.mediaType } : {}),
      ...(typeof evidence.byteLength === 'number' ? { byteLength: evidence.byteLength } : {}),
      ...(typeof evidence.etag === 'string' ? { etag: evidence.etag } : {}),
      ...(typeof evidence.lastModified === 'string' ? { lastModified: evidence.lastModified } : {}),
    }));
}

function readPublisherTermsEvidence(record: Record<string, unknown>): PublisherTermsEvidenceInput | undefined {
  const labelKeys = ['license_title', 'licenseTitle', 'license_id', 'licenseId', 'rights', 'accessRights'];
  const urlKeys = ['license_url', 'licenseUrl', 'rights_url', 'rightsUrl'];
  const labelKey = labelKeys.find(key => typeof record[key] === 'string' && (record[key] as string).trim());
  const urlKey = urlKeys.find(key => typeof record[key] === 'string' && /^https?:\/\//i.test((record[key] as string).trim()));
  const label = labelKey ? (record[labelKey] as string).trim() : undefined;
  const url = urlKey ? (record[urlKey] as string).trim() : undefined;
  if (!label && !url) return undefined;
  return {
    ...(label ? { label } : {}),
    ...(url ? { url } : {}),
    observedFields: [labelKey, urlKey].filter((key): key is string => Boolean(key)),
  };
}

/**
 * Max records content-addressed per module run. Prevents a 400K-record
 * module (e.g. corporate-filings) from creating hundreds of thousands of
 * parallel SHA-256 digests and stalling ingestion — the "claims never
 * break ingestion" guarantee. Env-tunable via QUILL_CLAIMS_MAX.
 */
export const MAX_CLAIMS_PER_RUN = Math.max(
  100,
  parseInt(process.env.QUILL_CLAIMS_MAX ?? '5000', 10) || 5000,
);

/**
 * Register claim bundles for a module's parsed records in the citation
 * store. Returns the number of records registered. Never throws — claim
 * registration must not break ingestion.
 *
 * @param moduleName   Registry module name (e.g. "committees")
 * @param records      Parsed records from the module's main ingest function
 * @param sourceLabel  Upstream source attribution (URL or portal name); used
 *                     as a fallback when a record carries no url field
 */
export async function registerModuleClaims(
  moduleName: string,
  records: unknown[],
  sourceLabel = '',
  license = NO_REUSE_LICENSE_NOTICE,
): Promise<number> {
  if (!Array.isArray(records) || records.length === 0) return 0;

  const objects = records.filter(
    (r): r is Record<string, unknown> => r !== null && typeof r === 'object',
  );
  if (objects.length === 0) return 0;

  const sampled = objects.slice(0, MAX_CLAIMS_PER_RUN);
  if (sampled.length < objects.length) {
    console.warn(
      `[claims] ${moduleName}: truncating claim registration to ${sampled.length} of ${objects.length} records (QUILL_CLAIMS_MAX=${MAX_CLAIMS_PER_RUN})`,
    );
  }

  try {
    const runArtifacts = getIngestionArtifacts();
    const bundles = await Promise.all(
      sampled.map(record => recordToClaim(moduleName, sourceLabel, license, record, runArtifacts)),
    );
    for (const bundle of bundles) {
      citationStore.put(bundle);
    }
    return bundles.length;
  } catch (err) {
    // Failure-safe: log and continue ingestion.
    console.warn(
      `[claims] registerModuleClaims(${moduleName}) failed — skipping claim registration: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
    return 0;
  }
}

/**
 * Convenience wrapper: extract an array of records from a module result and
 * register claims for them. Handles the common result shapes modules return:
 * `{ records: [...] }`, `{ results: [...] }`, or a bare array.
 */
export async function registerModuleResultClaims(
  moduleName: string,
  result: unknown,
  sourceUrl = '',
): Promise<number> {
  if (Array.isArray(result)) {
    return registerModuleClaims(moduleName, result, sourceUrl);
  }
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    // Modules that use withAttribution() return { data, attribution }. Keep
    // the configured terms attached to each claim without promoting them to
    // publisher metadata. A record's own declaration always takes priority.
    if (r.data !== undefined && r.attribution && typeof r.attribution === 'object') {
      const attribution = r.attribution as Record<string, unknown>;
      const data = r.data as Record<string, unknown> | Record<string, unknown>[];
      const payload = Array.isArray(data)
        ? data
        : data && typeof data === 'object'
          ? (Array.isArray(data.records) ? data.records
            : Array.isArray(data.results) ? data.results
              : Array.isArray(data.items) ? data.items
                : Object.values(data).filter(value => value !== null && typeof value === 'object' && !Array.isArray(value)))
          : [];
      if (payload.length > 0) {
        const inherited = {
          ...(typeof attribution.sourceUrl === 'string' ? { source_url: attribution.sourceUrl } : {}),
          ...(typeof attribution.license === 'string' ? { license: attribution.license } : {}),
          ...(typeof attribution.licenseUrl === 'string' ? { license_url: attribution.licenseUrl } : {}),
          ...(typeof attribution.licenseBasis === 'string' ? { license_basis: attribution.licenseBasis } : {}),
          ...(typeof attribution.attributionText === 'string' ? { attribution_text: attribution.attributionText } : {}),
        };
        const records = payload.map(record => ({
          ...inherited,
          ...(record as Record<string, unknown>),
        }));
        return registerModuleClaims(moduleName, records, sourceUrl);
      }
    }
    if (Array.isArray(r.records)) {
      return registerModuleClaims(moduleName, r.records, sourceUrl);
    }
    if (Array.isArray(r.results)) {
      return registerModuleClaims(moduleName, r.results, sourceUrl);
    }
    if (Array.isArray(r.items)) {
      return registerModuleClaims(moduleName, r.items, sourceUrl);
    }
    // Dictionary-shaped results — e.g. committees returns
    // Record<acronym, CommitteeIngestionResult>, influence returns
    // { actors, funding }, corporate returns Record<label, Result>.
    // Register each value as a record. Guard: every value must be an
    // object (a status envelope like { skipped: true, url } has non-object
    // values and falls through to the envelope check below).
    //
    // Note: these claims are result-level bundles (per-committee/per-actor
    // summaries with counts and errors), not per-meeting records — the
    // hook content-addresses what the module returns.
    const dictValues = Object.values(r);
    if (
      dictValues.length > 0 &&
      dictValues.every(v => v !== null && typeof v === 'object' && !Array.isArray(v))
    ) {
      return registerModuleClaims(moduleName, dictValues as Record<string, unknown>[], sourceUrl);
    }
    // Modules that return a count only (e.g. "processed N records") have
    // nothing to content-address — the records themselves are the claims.
    if (typeof r.count === 'number' || typeof r.recordsCount === 'number') {
      return 0;
    }
    // Single-record module result — wrap it. Guard against status envelopes
    // that merely contain a url field (e.g. { skipped: true, url }) by
    // requiring a record-ish identity AND no status/skipped/error marker.
    const looksLikeStatusEnvelope =
      r.skipped === true || r.error !== undefined || r.status === 'skipped';
    if (!looksLikeStatusEnvelope &&
        (r.id !== undefined || r.title !== undefined || r.name !== undefined || r.url !== undefined)) {
      return registerModuleClaims(moduleName, [r], sourceUrl);
    }
  }
  return 0;
}
