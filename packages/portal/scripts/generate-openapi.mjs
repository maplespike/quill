#!/usr/bin/env node
/** Generate the portal OpenAPI 3.1 specification from the built SDK agent catalog. */

import { writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sdk = require(resolve(__dirname, '../../sdk/dist/index.cjs'));
const agentMap = sdk.AGENTS;
const paths = {
  '/v1/claims/verify/{hash}': {
    get: {
      tags: ['Claims'], summary: 'Look up a claim hash', operationId: 'claims-verify-hash',
      description: 'A hash match checks canonical record integrity only. Provenance evidence and source retrieval time are available only when recorded; this lookup does not authenticate the source or establish reuse rights.',
      parameters: [{ name: 'hash', in: 'path', required: true, schema: { type: 'string', pattern: '^(sha256:|sha256-)?[a-f0-9]{64}$' } }],
      responses: {
        '200': { description: 'Claim hash lookup and available evidence', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClaimVerificationResponse' } } } },
        '400': { description: 'Invalid SHA-256 hash format' },
        '500': { description: 'Claim verification failed' },
      },
      security: [],
    },
  },
  '/v1/claims/latest': {
    get: {
      tags: ['Claims'], summary: 'List recent claim summaries', operationId: 'claims-latest',
      description: 'Public discovery index. Source retrieval timestamps may be null when acquisition evidence was not recorded.',
      responses: {
        '200': { description: 'Recent claim summaries', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClaimsLatestResponse' } } } },
        '500': { description: 'Claims index failed' },
      },
      security: [],
    },
  },
  '/v1/claims/verify': {
    post: {
      tags: ['Claims'], summary: 'Recompute a canonical-record hash', operationId: 'claims-verify-value',
      description: 'Recomputes SHA-256 of canonical JSON for the supplied value and optionally compares a claimed hash. This checks value integrity, not source authenticity or reuse rights.',
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['data'], properties: { data: {}, sha256: { type: 'string' } } } } } },
      responses: {
        '200': { description: 'Recomputed canonical-record hash and comparison result', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClaimHashResponse' } } } },
        '400': { description: 'Invalid request body' },
        '413': { description: 'Request body exceeds 1 MiB' },
        '500': { description: 'Claim verification failed' },
      },
      security: [],
    },
  },
};

for (const agent of Object.values(agentMap)) {
  for (const action of agent.actions) {
    const endpoint = `/v1/${agent.name}/${action.id}`;
    const required = action.requiredParams || [];
    const parameters = [...new Set([...required, ...(action.optionalParams || []), 'limit'])].map(name => ({
      name,
      in: 'query',
      required: required.includes(name),
      schema: name === 'limit' ? { type: 'integer', maximum: 100 } : { type: 'string' },
    }));
    paths[endpoint] = {
      get: {
        tags: [agent.name], summary: action.description, description: action.description,
        operationId: `${agent.name}-${action.id}`, parameters,
        responses: {
          '200': {
            description: 'Successful response; payload, citations, and provenance vary by endpoint and source.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/QuillResponse' } } },
          },
          '401': { description: 'API key missing or invalid' },
          '402': { description: 'Quota exhausted' },
        },
        security: [{ ApiKeyAuth: [] }],
      },
    };
  }
}

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'MapleSpike API', version: '0.2.0',
    description: 'Canadian public-sector data API. Coverage and response fields vary by endpoint and source. Where supplied, Quill record hashes support integrity comparisons but do not establish source authenticity or reuse rights. Publisher terms vary by dataset; consult the original source. Software license declarations vary by repository artifact; see https://github.com/reverb256/quill/blob/main/docs/open-source-audit.md.',
    contact: { name: 'MapleSpike', url: 'https://maplespike.ca', email: 'hello@maplespike.ca' },
  },
  servers: [
    { url: 'https://api.maplespike.ca/v1', description: 'Production' },
    { url: 'http://localhost:8081/v1', description: 'Local development' },
  ],
  paths,
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'API key from https://maplespike.ca/workspace' },
    },
    schemas: {
      QuillResponse: {
        type: 'object', description: 'Common API envelope. Payload and citation fields vary by route and source.',
        properties: {
          success: { type: 'boolean' }, data: { description: 'Route-specific payload; shape varies by endpoint.' },
          text: { type: ['string', 'null'] },
          error: { anyOf: [{ $ref: '#/components/schemas/ApiError' }, { type: 'null' }] },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
          quality: { anyOf: [{ $ref: '#/components/schemas/QualityMeta' }, { type: 'null' }] },
          citation: { anyOf: [{ $ref: '#/components/schemas/CitationMeta' }, { type: 'null' }] },
        },
      },
      ClaimVerificationResponse: {
        allOf: [
          { $ref: '#/components/schemas/QuillResponse' },
          { type: 'object', properties: { data: { $ref: '#/components/schemas/ClaimVerificationData' } } },
        ],
      },
      ClaimsLatestResponse: {
        allOf: [
          { $ref: '#/components/schemas/QuillResponse' },
          { type: 'object', properties: { data: { $ref: '#/components/schemas/ClaimsLatestData' } } },
        ],
      },
      ClaimHashResponse: {
        allOf: [
          { $ref: '#/components/schemas/QuillResponse' },
          { type: 'object', properties: { data: { $ref: '#/components/schemas/ClaimHashData' } } },
        ],
      },
      ClaimVerificationData: {
        type: 'object', description: 'Stored or indexed record hash match and evidence when available.',
        properties: {
          verified: { type: 'boolean' }, found: { type: 'boolean' }, sha256: { type: 'string' },
          source: { type: 'string' }, source_name: { type: 'string' }, source_url: { type: 'string' },
          retrieved_at: { type: ['string', 'null'], format: 'date-time', description: 'Source acquisition time; null when not recorded.' },
          claim_created_at: { type: ['string', 'null'], format: 'date-time', description: 'Quill claim registration time, not source retrieval time.' },
          license: { type: ['string', 'null'], description: 'Publisher metadata or a notice to consult source terms; not a reuse grant.' },
          license_url: { type: 'string' }, license_basis: { type: 'string' },
          provenance_evidence: { anyOf: [{ $ref: '#/components/schemas/ProvenanceEvidence' }, { type: 'null' }] },
          verification_scope: { type: 'string', enum: ['claim-store-hash-match', 'pipeline-index-hash-match'] },
          claim: { type: 'string' }, quality: { type: ['object', 'null'] }, verify_command: { type: 'string' },
        },
      },
      ClaimsLatestData: {
        type: 'object', properties: {
          count: { type: 'integer' },
          claims: { type: 'array', items: { $ref: '#/components/schemas/ClaimSummary' } },
        },
      },
      ClaimSummary: {
        type: 'object', properties: {
          sha256: { type: 'string' }, claim: { type: 'string' }, source_name: { type: 'string' }, source_url: { type: 'string' },
          retrieved_at: { type: ['string', 'null'], format: 'date-time', description: 'Source acquisition time; null when not recorded.' },
          license: { type: 'string' }, update_frequency: { type: 'string' },
          claim_created_at: { type: 'string', format: 'date-time', description: 'Quill claim registration time, not source retrieval time.' },
          created_at: { type: 'string', format: 'date-time', description: 'Legacy alias for claim registration time.' },
          provenance_status: { const: 'inspect-verification-endpoint' },
        },
      },
      ClaimHashData: {
        type: 'object', properties: {
          verified: { type: 'boolean', description: 'True only when an optional claimed hash matches the recomputed canonical JSON hash.' },
          recomputed_sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          matches_claimed: { type: ['boolean', 'null'] }, verify_command: { type: 'string' },
        },
      },
      ApiError: {
        type: 'object', properties: {
          code: { type: 'string' }, message: { type: 'string' }, message_fr: { type: 'string' },
          details: { type: 'array', items: {} },
        },
      },
      ResponseMeta: {
        type: 'object', properties: {
          requestId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time', description: 'API response timestamp, not source retrieval time.' },
          version: { type: 'string' },
          usage: { type: 'object', properties: { periodCalls: { type: 'integer' }, periodLimit: { type: 'integer' }, tier: { type: 'string' } } },
          agent: { type: 'string' }, action: { type: 'string' }, authMethod: { type: 'string' },
          creditsCharged: { type: 'number' }, cacheStatus: { type: 'string', enum: ['hit', 'miss', 'mock'] }, durationMs: { type: 'number' },
        },
      },
      QualityMeta: {
        type: 'object', properties: {
          freshness_seconds: { type: 'number' }, source_uptime_7d: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] }, certainty_score: { type: 'number' },
          last_verified: { type: ['string', 'null'], format: 'date-time' }, data_completeness: { type: 'string' },
        },
      },
      CitationMeta: {
        type: 'object', properties: {
          source_name: { type: 'string' }, source_url: { type: 'string' },
          retrieved_at: { type: ['string', 'null'], format: 'date-time', description: 'Source acquisition time only when observed.' },
          data_hash: { type: 'string', description: 'For claim records, SHA-256 of canonical Quill record JSON, not upstream response bytes.' },
          license: { type: 'string', description: 'Publisher metadata or a notice to consult source terms; not a reuse grant.' },
          license_url: { type: 'string' }, license_basis: { type: 'string', enum: ['publisher-metadata', 'source-configuration', 'no-publisher-declaration'] },
          attribution_text: { type: 'string' }, update_frequency: { type: 'string' }, original_format: { type: 'string' },
          citation_text: { type: 'string' }, citation_footnote: { type: 'string' },
          provenance_evidence: { anyOf: [{ $ref: '#/components/schemas/ProvenanceEvidence' }, { type: 'null' }] },
        },
      },
      ProvenanceEvidence: {
        type: 'object', description: 'Evidence inventory only; it does not establish source identity, completeness, or reuse rights.',
        required: ['schema_version', 'record_integrity', 'acquisition', 'transformations', 'publisher_terms'],
        properties: {
          schema_version: { const: 'quill.provenance.v1' },
          record_integrity: { type: 'object', properties: {
            algorithm: { const: 'SHA-256' }, digest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
            scope: { const: 'canonical-json-record' }, canonicalization: { const: 'quill-canonical-json-v1' },
          } },
          acquisition: { type: 'object', properties: {
            status: { type: 'string', enum: ['captured', 'not-captured'] },
            association: { type: 'string', enum: ['url-matched-not-content-verified', 'not-established', 'none'] },
            artifacts: { type: 'array', items: { type: 'object', properties: {
              association: { type: 'string', enum: ['url-matched-not-content-verified', 'not-established'] },
              evidence_source: { type: 'string', enum: ['explicit-record-evidence', 'shared-http-client-capture'] },
              url: { type: 'string' }, retrieved_at: { type: 'string', format: 'date-time' },
              sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, hash_scope: { const: 'http-client-response-body-utf8' },
              status_code: { type: 'integer' }, media_type: { type: ['string', 'null'] }, byte_length: { type: ['integer', 'null'] },
              etag: { type: ['string', 'null'] }, last_modified: { type: ['string', 'null'] }, url_redacted: { type: 'boolean' },
              body_capture: { type: 'string', enum: ['complete-http-client-body', 'empty-body-not-captured'] },
            } } },
          } },
          transformations: { type: 'object', properties: {
            status: { type: 'string', enum: ['pipeline-reported', 'not-recorded'] }, coverage: { const: 'declared-steps-only' },
            steps: { type: 'array', items: { type: 'string' } }, stages: { type: 'object', properties: {
              module_code_revision: { type: ['string', 'null'] }, parser_version: { type: ['string', 'null'] }, transform_code_revision: { type: ['string', 'null'] },
            } },
          } },
          publisher_terms: { type: 'object', properties: {
            status: { type: 'string', enum: ['publisher-metadata-observed', 'source-configuration-only', 'not-observed'] },
            label: { type: ['string', 'null'] }, url: { type: ['string', 'null'] }, observed_fields: { type: 'array', items: { type: 'string' } },
          } },
        },
      },
    },
  },
  tags: Object.values(agentMap).map(agent => ({ name: agent.name, description: agent.description })),
};

const outDir = resolve(__dirname, '../v1');
const publicOutDir = resolve(__dirname, '../public/v1');
mkdirSync(outDir, { recursive: true });
mkdirSync(publicOutDir, { recursive: true });
const outPath = resolve(outDir, 'openapi.json');
const publicOutPath = resolve(publicOutDir, 'openapi.json');
writeFileSync(outPath, JSON.stringify(spec, null, 2));
copyFileSync(outPath, publicOutPath);
console.log(`Wrote ${outPath} and ${publicOutPath} — ${Object.keys(paths).length} endpoints across ${Object.keys(agentMap).length} agents`);
