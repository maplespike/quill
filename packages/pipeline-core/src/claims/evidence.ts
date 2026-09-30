// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ClaimItem } from './index.js';
import type { BuildClaimBundleOptions } from './index.js';
import type { ClaimProvenanceEvidence, SourceArtifactEvidenceInput } from './types.js';

/** Build an evidence inventory without inferring facts that the fetcher did not capture. */
export function buildProvenanceEvidence(
  sha256: string,
  item: Pick<ClaimItem, 'sourceUrl' | 'licenseBasis' | 'transformations' | 'sourceArtifactsEvidence' | 'publisherTermsEvidence'>,
  options: BuildClaimBundleOptions = {},
): ClaimProvenanceEvidence {
  const explicitArtifacts = (item.sourceArtifactsEvidence ?? []).filter(isValidArtifact);
  const sourceUrl = normalizeUrlForMatch(item.sourceUrl);
  const matchesSourceUrl = (artifact: SourceArtifactEvidenceInput) =>
    sourceUrl !== null && normalizeUrlForMatch(artifact.url) === sourceUrl;
  const matchingCapturedArtifacts = (options.capturedArtifactsEvidence ?? [])
    .filter(isValidArtifact)
    .filter(matchesSourceUrl);
  const artifacts = [
    ...explicitArtifacts.map(artifact => ({ artifact, evidenceSource: 'explicit-record-evidence' as const })),
    ...matchingCapturedArtifacts.map(artifact => ({ artifact, evidenceSource: 'shared-http-client-capture' as const })),
  ];
  const hasUrlMatchedEvidence = artifacts.some(({ artifact }) => matchesSourceUrl(artifact));
  const publisherMetadataObserved = item.licenseBasis === 'publisher-metadata'
    && item.publisherTermsEvidence !== undefined;
  const configuredTerms = item.licenseBasis === 'source-configuration';
  const terms = item.publisherTermsEvidence;

  return {
    schema_version: 'quill.provenance.v1',
    record_integrity: {
      algorithm: 'SHA-256',
      digest: sha256,
      scope: 'canonical-json-record',
      canonicalization: 'quill-canonical-json-v1',
    },
    acquisition: {
      status: artifacts.length > 0 ? 'captured' : 'not-captured',
      // URL equality is only a request association, not proof of artifact-to-record content lineage.
      association: hasUrlMatchedEvidence
        ? 'url-matched-not-content-verified'
        : artifacts.length > 0 ? 'not-established' : 'none',
      artifacts: artifacts.map(({ artifact, evidenceSource }) => ({
        association: matchesSourceUrl(artifact) ? 'url-matched-not-content-verified' : 'not-established',
        evidence_source: evidenceSource,
        url: redactArtifactUrl(artifact.url, artifact.urlRedacted)?.url ?? '',
        retrieved_at: artifact.retrievedAt,
        sha256: artifact.sha256.toLowerCase(),
        hash_scope: 'http-client-response-body-utf8',
        status_code: artifact.statusCode,
        media_type: artifact.mediaType ?? null,
        byte_length: artifact.byteLength ?? null,
        etag: artifact.etag ?? null,
        last_modified: artifact.lastModified ?? null,
        url_redacted: redactArtifactUrl(artifact.url, artifact.urlRedacted)?.urlRedacted ?? true,
        body_capture: artifact.bodyCapture,
      })),
    },
    transformations: {
      status: item.transformations?.length ? 'pipeline-reported' : 'not-recorded',
      coverage: 'declared-steps-only',
      steps: item.transformations ?? [],
      stages: {
        module_code_revision: null,
        parser_version: null,
        transform_code_revision: null,
      },
    },
    publisher_terms: {
      status: publisherMetadataObserved
        ? 'publisher-metadata-observed'
        : configuredTerms
          ? 'source-configuration-only'
          : 'not-observed',
      label: publisherMetadataObserved ? terms?.label ?? null : null,
      url: publisherMetadataObserved && terms?.url
        ? redactArtifactUrl(terms.url)?.url ?? null
        : null,
      observed_fields: publisherMetadataObserved ? terms?.observedFields ?? [] : [],
    },
  };
}

function isValidArtifact(artifact: SourceArtifactEvidenceInput): boolean {
  return typeof artifact.sha256 === 'string'
    && /^[a-f0-9]{64}$/i.test(artifact.sha256)
    && typeof artifact.url === 'string'
    && normalizeUrlForMatch(artifact.url) !== null
    && typeof artifact.retrievedAt === 'string'
    && Number.isFinite(Date.parse(artifact.retrievedAt))
    && Number.isInteger(artifact.statusCode)
    && artifact.statusCode >= 0
    && artifact.statusCode <= 599
    && (artifact.byteLength === undefined || (Number.isInteger(artifact.byteLength) && artifact.byteLength >= 0))
    && (artifact.bodyCapture === 'complete-http-client-body' || artifact.bodyCapture === 'empty-body-not-captured');
}

/** Return a query/credential-redacted URL used only for conservative association. */
export function normalizeUrlForMatch(value: string): string | null {
  const redacted = redactArtifactUrl(value);
  if (!redacted) return null;
  return redacted.url.endsWith('/') ? redacted.url.slice(0, -1) : redacted.url;
}

/** Remove URL components that may contain secrets before evidence is persisted or returned. */
export function redactArtifactUrl(
  value: string,
  wasAlreadyRedacted = false,
): { url: string; urlRedacted: boolean } | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const urlRedacted = wasAlreadyRedacted
      || url.username !== ''
      || url.password !== ''
      || url.search !== ''
      || url.hash !== '';
    url.hash = '';
    url.search = '';
    url.username = '';
    url.password = '';
    let safeUrl = url.toString();
    if (url.pathname === '/' && !/^https?:\/\/[^/?#]+\/(?:[?#]|$)/i.test(value)) {
      safeUrl = safeUrl.slice(0, -1);
    }
    return { url: safeUrl, urlRedacted };
  } catch {
    return null;
  }
}
