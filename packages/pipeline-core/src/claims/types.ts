// SPDX-License-Identifier: AGPL-3.0-only

export interface SourceArtifactEvidenceInput {
  /** Request URL for the response artifact; credentials/query values are removed before persistence. */
  url: string;
  retrievedAt: string;
  /** SHA-256 of the UTF-8 encoding of the response-body string exposed by the HTTP client, before parsing. */
  sha256: string;
  statusCode: number;
  urlRedacted?: boolean;
  /** Legacy `empty-body-not-captured` values may be read from older stored evidence. */
  bodyCapture: 'complete-http-client-body' | 'empty-body-not-captured';
  mediaType?: string;
  byteLength?: number;
  etag?: string;
  lastModified?: string;
}

export interface PublisherTermsEvidenceInput {
  label?: string;
  url?: string;
  observedFields: string[];
}

export interface ClaimProvenanceEvidence {
  schema_version: 'quill.provenance.v1';
  record_integrity: {
    algorithm: 'SHA-256';
    digest: string;
    scope: 'canonical-json-record';
    canonicalization: 'quill-canonical-json-v1';
  };
  acquisition: {
    status: 'captured' | 'not-captured';
    association: 'url-matched-not-content-verified' | 'not-established' | 'none';
    artifacts: Array<{
      association: 'url-matched-not-content-verified' | 'not-established';
      evidence_source: 'explicit-record-evidence' | 'shared-http-client-capture';
      url: string;
      retrieved_at: string;
      sha256: string;
      hash_scope: 'http-client-response-body-utf8';
      status_code: number;
      media_type: string | null;
      byte_length: number | null;
      etag: string | null;
      last_modified: string | null;
      url_redacted: boolean;
      /** Legacy values may still appear in persisted evidence; new captures use complete-http-client-body. */
      body_capture: 'complete-http-client-body' | 'empty-body-not-captured';
    }>;
  };
  transformations: {
    status: 'pipeline-reported' | 'not-recorded';
    coverage: 'declared-steps-only';
    steps: string[];
    stages: {
      module_code_revision: string | null;
      parser_version: string | null;
      transform_code_revision: string | null;
    };
  };
  publisher_terms: {
    status: 'publisher-metadata-observed' | 'source-configuration-only' | 'not-observed';
    label: string | null;
    url: string | null;
    observed_fields: string[];
  };
}
