/**
 * Quill — OpenAPI Specification
 *
 * GET /v1/openapi.json — Auto-generated OpenAPI 3.1 spec
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { loadConfig } from '../config.js';

export const openApiHandler: RouteHandler = async (_request, ctx) => {
  try {
    const config = loadConfig(ctx.env);

    const spec = {
    openapi: '3.1.0',
    info: {
      title: config.name,
      version: config.version,
      description: `Canadian public-sector data API. Module coverage and response fields vary by endpoint and source. Where supplied, Quill record hashes support integrity comparisons but do not establish source authenticity or reuse rights. Publisher terms vary by dataset; consult the original source. Software license declarations vary by repository artifact; see https://github.com/reverb256/quill/blob/main/docs/open-source-audit.md.`,
      contact: {
        name: 'MapleSpike',
        url: 'https://quill.maplespike.ca',
      },
    },
    servers: [
      { url: 'https://api.maplespike.ca/v1', description: 'Production' },
      { url: 'http://localhost:8081/v1', description: 'Development' },
    ],
    security: [{ BearerAuth: [] }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API key (quill_ prefix)',
          description: 'Get your API key at https://quill.maplespike.ca',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', nullable: true },
            error: {
              type: 'object',
              nullable: true,
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                requestId: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                version: { type: 'string' },
                usage: {
                  type: 'object',
                  properties: {
                    periodCalls: { type: 'integer' },
                    periodLimit: { type: 'integer' },
                    tier: { type: 'string' },
                  },
                },
              },
            },
            citation: {
              anyOf: [{ $ref: '#/components/schemas/CitationMeta' }, { type: 'null' }],
            },
          },
        },
        CitationMeta: {
          type: 'object',
          properties: {
            source_name: { type: 'string' },
            source_url: { type: 'string' },
            retrieved_at: { type: ['string', 'null'], format: 'date-time', description: 'Source acquisition time only when observed.' },
            data_hash: { type: 'string', description: 'For claim records, SHA-256 of canonical Quill record JSON, not upstream response bytes.' },
            provenance_evidence: { anyOf: [{ $ref: '#/components/schemas/ProvenanceEvidence' }, { type: 'null' }] },
            license: { type: 'string', description: 'Publisher metadata or a notice to consult source terms; not a reuse grant.' },
            license_basis: { type: 'string', enum: ['publisher-metadata', 'source-configuration', 'no-publisher-declaration'] },
            license_url: { type: 'string' }, attribution_text: { type: 'string' }, update_frequency: { type: 'string' },
          },
        },
        AuditSummaryResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: { data: { $ref: '#/components/schemas/AuditSummaryData' } },
            },
          ],
        },
        AuditSummaryData: {
          type: 'object',
          description: 'Build-time dependency audit snapshot. generatedAt is when the snapshot was produced.',
          required: ['generatedAt', 'summary', 'top', 'stale', 'ageDays', '_meta'],
          properties: {
            generatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'When the snapshot was produced. Not the request time.',
            },
            summary: { $ref: '#/components/schemas/AuditSummaryCounts' },
            top: { type: 'array', items: { $ref: '#/components/schemas/AuditAdvisory' } },
            note: { type: 'string' },
            stale: { type: 'boolean', description: 'True when generatedAt is older than 7 days.' },
            ageDays: { type: 'integer', minimum: 0, description: 'Whole days since generatedAt.' },
            _meta: { $ref: '#/components/schemas/AuditSummaryMeta' },
          },
        },
        AuditSummaryCounts: {
          type: 'object',
          required: ['total', 'critical', 'high', 'moderate', 'low', 'info'],
          properties: {
            total: { type: 'integer' },
            critical: { type: 'integer' },
            high: { type: 'integer' },
            moderate: { type: 'integer' },
            low: { type: 'integer' },
            info: { type: 'integer' },
          },
        },
        AuditAdvisory: {
          type: 'object',
          required: ['id', 'package', 'severity', 'title'],
          properties: {
            id: { type: 'string' },
            package: { type: 'string' },
            severity: { type: 'string', enum: ['critical', 'high', 'moderate', 'low', 'info'] },
            title: { type: 'string' },
            url: { type: 'string' },
          },
        },
        AuditSummaryMeta: {
          type: 'object',
          required: ['source', 'generatedAgeSeconds', 'ageDays', 'stale', 'maxSnapshotAgeSeconds', 'fallbackReason'],
          properties: {
            source: { type: 'string', enum: ['static'], description: 'The route serves the build-time snapshot.' },
            generatedAgeSeconds: { type: 'integer', description: 'Seconds since generatedAt.' },
            ageDays: { type: 'integer', minimum: 0 },
            stale: { type: 'boolean' },
            maxSnapshotAgeSeconds: { type: 'integer', description: 'Age after which stale is true. 7 days.' },
            fallbackReason: { type: 'string' },
          },
        },
        ProvenanceEvidence: {
          type: 'object',
          description: 'Evidence inventory only; it does not establish source identity, completeness, or reuse rights.',
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
                etag: { type: ['string', 'null'] }, last_modified: { type: ['string', 'null'] },
                url_redacted: { type: 'boolean' }, body_capture: { type: 'string', enum: ['complete-http-client-body', 'empty-body-not-captured'] },
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
    paths: {
      '/v1/upstream/status': {
        get: {
          tags: ['Health'],
          summary: 'Upstream government source status',
          description:
            'Per-host health for the government sources Quill depends on: observed state (up, degraded, down), declared maintenance windows (scheduled, partial), announced incidents, and the copy the site may show. Public: no API key required. Expected-back times are published only for declared windows, never inferred.',
          security: [],
          responses: {
            '200': {
              description: 'Per-host upstream status plus the single banner the site may show',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
            },
          },
        },
      },
      '/v1/security/audit-summary': {
        get: {
          tags: ['Security'],
          summary: 'Dependency audit snapshot',
          description:
            'Serves the build-time pnpm audit snapshot. A request does not run pnpm audit. generatedAt is the time the snapshot was produced, not the request time. A snapshot older than 7 days is still returned, with stale set to true. Public: no API key. Refresh the file with node scripts/gen-security-audit.mjs.',
          security: [],
          responses: {
            '200': {
              description:
                'Snapshot fields, generatedAt, source, stale, and ageDays. stale is false when the snapshot is 7 days old or newer.',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/AuditSummaryResponse' } },
              },
            },
            '503': {
              description:
                'The snapshot is missing, a placeholder, or unparseable. The error code is AUDIT_QUERY_FAILED.',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } },
              },
            },
          },
        },
      },
      '/v1/health': {
        get: {
          tags: ['Health'],
          summary: 'Service health check',
          description: 'Returns service status, tenant info, and current usage. Use this to verify your API key is working.',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Service is healthy',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
            },
          },
        },
      },
      '/v1/gov/releases': {
        get: {
          tags: ['Government Data'],
          summary: 'List government data releases',
          description: 'Returns recent releases from Statistics Canada, CKAN portals, and other government data sources.',
          parameters: [
            { name: 'jurisdiction', in: 'query', schema: { type: 'string' }, description: 'Filter by jurisdiction (federal, ontario, bc, alberta, quebec)' },
            { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category (economy, health, environment, education, etc.)' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { '200': { description: 'List of government data releases' } },
        },
      },
      '/v1/gov/search': {
        get: {
          tags: ['Government Data'],
          summary: 'Search across all government data sources',
          description: 'Unified search across Statistics Canada, CKAN portals, and provincial data catalogues.',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query' },
            { name: 'jurisdiction', in: 'query', schema: { type: 'string' }, description: 'Limit to specific jurisdiction' },
          ],
          responses: { '200': { description: 'Search results from government data sources' } },
        },
      },
      '/v1/citation/{id}': {
        get: {
          tags: ['Citations'],
          summary: 'Verify a citation hash',
          description: 'Looks up a Quill record by hash. A match checks the hash stored or computed for the canonical record representation; it does not authenticate the upstream source.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Citation details with verification command' } },
        },
      },
      '/v1/claims/verify/{hash}': {
        get: {
          tags: ['Citations'],
          summary: 'Verify a claim hash (public)',
          description: 'Public lookup — checks a SHA-256 claim hash against the Quill claim store or local pipeline index. No API key required. Store-backed responses may include provenance_evidence and a shell command to reproduce the canonical record hash. A match is not source authentication; retrieval time and other evidence may be unavailable.',
          parameters: [{ name: 'hash', in: 'path', required: true, schema: { type: 'string' }, description: 'SHA-256 hash, with or without the sha256: prefix (e.g. sha256:a1b2... or bare hex)' }],
          responses: {
            '200': { description: 'Claim hash lookup result. Provenance evidence and source retrieval time are available only when recorded.' },
            '400': { description: 'Invalid SHA-256 hash format' },
            '500': { description: 'Claim verification failed' },
          },
        },
      },
      '/v1/claims/latest': {
        get: {
          tags: ['Citations'],
          summary: 'List recent claim bundles (public)',
          description: 'Public discovery — returns recent claim-bundle summaries. retrieved_at is null when source acquisition time was not recorded. Inspect one hash via GET /v1/claims/verify/{hash}; a hash match does not authenticate the source. No API key required.',
          responses: {
            '200': { description: 'Recent claims with provenance (count + claims[])' },
            '500': { description: 'Claims index failed' },
          },
        },
      },
      '/v1/claims/verify': {
        post: {
          tags: ['Citations'],
          summary: 'Recompute a claim hash (public)',
          description: 'Public trust primitive — recomputes the SHA-256 of canonical JSON of the submitted data and compares it to an optional claimed hash. No Quill storage required; the trust primitive for non-MCP callers.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { description: 'Any JSON value to hash' },
                    sha256: { type: 'string', description: 'Optional claimed hash to compare against' },
                  },
                  required: ['data'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Recomputed hash and match result' },
            '400': { description: 'Invalid body' },
            '500': { description: 'Claim verification failed' },
          },
        },
      },
      '/v1/usage': {
        get: {
          tags: ['Usage'],
          summary: 'Get current usage',
          description: 'Returns daily and monthly API call counts, limits, and remaining quota for the calling key\'s own tenant. Self-scoped, available on every tier (including Free).',
          responses: { '200': { description: 'Usage statistics' } },
        },
      },
      '/v1/audit/query': {
        post: {
          tags: ['Audit'],
          summary: 'Query audit log (Business tier+)',
          description: 'Returns immutable audit log entries. Requires Business tier or higher.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    operation: { type: 'string', description: 'Filter by operation type' },
                    success: { type: 'boolean' },
                    since: { type: 'string', format: 'date-time' },
                    until: { type: 'string', format: 'date-time' },
                    limit: { type: 'integer', default: 50 },
                    offset: { type: 'integer', default: 0 },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Audit log entries' } },
        },
      },

      // ── Key Management ──

      '/v1/keys': {
        get: {
          tags: ['Keys'],
          summary: 'List API keys',
          description: 'Returns all API keys for the authenticated tenant.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'List of API keys' } },
        },
        post: {
          tags: ['Keys'],
          summary: 'Create a new API key',
          description: 'Generates a new API key. The raw key is returned once and never stored.',
          security: [{ BearerAuth: [] }],
          responses: { '201': { description: 'API key created' } },
        },
      },
      '/v1/keys/{id}': {
        delete: {
          tags: ['Keys'],
          summary: 'Revoke an API key',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Key revoked' } },
        },
      },
      '/v1/keys/{id}/rotate': {
        post: {
          tags: ['Keys'],
          summary: 'Rotate an API key',
          description: 'Invalidates the old key and returns a new one. The new key is shown once.',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Key rotated' } },
        },
      },

      // ── Registration ──

      '/v1/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new tenant',
          description: 'Creates a new tenant and returns an API key.',
          responses: { '201': { description: 'Tenant registered' } },
        },
      },
      '/v1/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current tenant info',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Tenant details' } },
        },
      },

      // ── Billing ──

      '/v1/billing/plans': {
        get: {
          tags: ['Billing'],
          summary: 'List pricing plans',
          description: 'Returns available pricing tiers.',
          responses: { '200': { description: 'List of plans' } },
        },
      },
      '/v1/billing/stripe/checkout': {
        post: {
          tags: ['Billing'],
          summary: 'Create a Stripe Checkout session',
          description: 'Creates a Stripe Checkout session for the authenticated tenant (Pro $50 CAD/month, Business $200 CAD/month). Return URLs are set server-side.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['plan_id'],
                  properties: {
                    plan_id: { type: 'string', enum: ['pro', 'business'], description: 'Plan to subscribe to' },
                    embedded: { type: 'boolean', description: 'Return an embedded Checkout client secret instead of a hosted URL' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Checkout session details' } },
        },
      },

      // ── AI Endpoints ──

      '/v1/ai/ask': {
        post: {
          tags: ['AI'],
          summary: 'Ask a question about Canadian government data',
          description: 'AI-powered Q&A over government data sources. Returns cited answers.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['question'],
                  properties: {
                    question: { type: 'string' },
                    context: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'AI-generated answer with citations' } },
        },
      },
      '/v1/ai/analyze': {
        post: {
          tags: ['AI'],
          summary: 'Analyze data for bias or patterns',
          description: 'AI-powered analysis of government data for bias detection, trend analysis, and narrative tracking.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    topic: { type: 'string' },
                    sources: { type: 'array', items: { type: 'string' } },
                    analysisType: { type: 'string', enum: ['bias', 'trend', 'narrative'] },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Analysis results' } },
        },
      },

      // ── Signals ──

      '/v1/signals': {
        get: {
          tags: ['Signals'],
          summary: 'Get detected signals',
          description: 'Returns recent signals detected by the engine (revolving doors, lobbying overlaps, sole-source flags).',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Signal type filter' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { '200': { description: 'Recent signals' } },
        },
      },

      // ── OAuth Auth ──

      '/v1/auth/oauth/providers': {
        get: {
          tags: ['Auth'],
          summary: 'List OAuth providers',
          description: 'Returns available OAuth providers for login.',
          responses: { '200': { description: 'List of OAuth providers' } },
        },
      },
      '/v1/auth/oauth/{provider}': {
        get: {
          tags: ['Auth'],
          summary: 'Initiate OAuth login',
          parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '302': { description: 'Redirect to OAuth provider' } },
        },
      },
      '/v1/auth/oauth/{provider}/callback': {
        get: {
          tags: ['Auth'],
          summary: 'OAuth callback',
          parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Authentication completed' } },
        },
      },

      // ── GitHub Auth ──

      '/v1/auth/github': {
        get: {
          tags: ['Auth'],
          summary: 'Legacy GitHub login (starts /v1/auth/oauth/github)',
          responses: { '302': { description: 'Redirect to GitHub' } },
        },
      },
      '/v1/auth/github/callback': {
        get: {
          tags: ['Auth'],
          summary: 'Legacy GitHub callback (restarts /v1/auth/oauth/github)',
          responses: { '302': { description: 'Redirect to GitHub (generic OAuth flow)' } },
        },
      },
      '/v1/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh JWT token',
          responses: { '200': { description: 'New JWT token' } },
        },
      },
      '/v1/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout',
          responses: { '200': { description: 'Logged out' } },
        },
      },
      '/v1/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get authenticated user profile',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'User profile' } },
        },
      },

      // ── Web3 Auth ──

      '/v1/auth/web3/challenge': {
        post: {
          tags: ['Auth'],
          summary: 'Request Web3 sign-in challenge',
          responses: { '200': { description: 'Challenge message for wallet signature' } },
        },
      },
      '/v1/auth/web3/login': {
        post: {
          tags: ['Auth'],
          summary: 'Verify wallet signature and login',
          responses: { '200': { description: 'JWT token' } },
        },
      },

      // ── Passkey Auth ──

      '/v1/auth/passkey/register/begin': {
        post: {
          tags: ['Auth'],
          summary: 'Begin passkey registration',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'WebAuthn registration options' } },
        },
      },
      '/v1/auth/passkey/register/complete': {
        post: {
          tags: ['Auth'],
          summary: 'Complete passkey registration',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Passkey registered' } },
        },
      },
      '/v1/auth/passkey/login/begin': {
        post: {
          tags: ['Auth'],
          summary: 'Begin passkey login',
          responses: { '200': { description: 'WebAuthn authentication options' } },
        },
      },
      '/v1/auth/passkey/login/complete': {
        post: {
          tags: ['Auth'],
          summary: 'Complete passkey login',
          responses: { '200': { description: 'JWT token' } },
        },
      },
      '/v1/auth/passkey/credentials': {
        get: {
          tags: ['Auth'],
          summary: 'List registered passkeys',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'List of passkey credentials' } },
        },
      },
      '/v1/auth/passkey/credentials/{id}': {
        delete: {
          tags: ['Auth'],
          summary: 'Delete a passkey',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Passkey deleted' } },
        },
      },

      // ── Entity composition surface (quill://entity/{id} + linked_entities) ──

      '/v1/entities/{id}': {
        get: {
          tags: ['Entities'],
          summary: 'Get entity profile by ID',
          description:
            'Returns the resolved entity profile for a canonical entity id: canonical name, type, confidence, aliases, appearances, and the canonical `quill://entity/{id}` URI. ' +
            'Accepts either a raw entity id or a full quill://entity/{id} URI. Requires Pro tier or higher (mirrors resolve_entity — micro, $0.001).',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Raw entity id or quill://entity/{id} URI' },
          ],
          responses: {
            '200': { description: 'Entity profile with canonical quill:// URI' },
            '400': { description: 'Missing id' },
            '402': { description: 'UPGRADE_REQUIRED — Pro tier or higher' },
            '404': { description: 'Entity not found, or entity graph not populated' },
          },
        },
      },
      '/v1/entities/{id}/links': {
        get: {
          tags: ['Entities'],
          summary: 'Cross-reference an entity across all registries',
          description:
            'Cross-references an entity across every registry Quill tracks (lobbying, GIC, committees, corporate, CanLII, elections, oversight, municipal, provincial). ' +
            'Returns per-registry evidence buckets (count, modules, date range), total appearances, and the relationship connections layer — the same surface as the linked_entities MCP tool. ' +
            'Requires Business tier or higher (mirrors linked_entities — premium, $0.10). Optional ?type=person|organization|auto filter.',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Raw entity id or quill://entity/{id} URI' },
            { name: 'type', in: 'query', required: false, schema: { type: 'string', enum: ['auto', 'person', 'organization'] }, description: 'Entity type hint (default: auto)' },
          ],
          responses: {
            '200': { description: 'Per-registry cross-reference + connections' },
            '400': { description: 'Missing id or invalid type' },
            '402': { description: 'UPGRADE_REQUIRED — Business tier or higher' },
            '404': { description: 'Entity not found, or entity graph not populated' },
          },
        },
      },
    },
    tags: [
      { name: 'Health', description: 'Service health and status' },
      { name: 'Security', description: 'Dependency audit snapshot' },
      { name: 'Government Data', description: 'Canadian government data releases and search' },
      { name: 'Citations', description: 'Content verification and provenance' },
      { name: 'Usage', description: 'API usage and quota management' },
      { name: 'Audit', description: 'Immutable audit trails for data provenance' },
      { name: 'Keys', description: 'API key lifecycle management' },
      { name: 'Auth', description: 'Authentication: OAuth, Web3, Passkey, JWT' },
      { name: 'Billing', description: 'Plans and checkout' },
      { name: 'AI', description: 'AI-powered analysis and Q&A' },
      { name: 'Signals', description: 'Engine-detected signals and alerts' },
      { name: 'Entities', description: 'Entity resolution + cross-registry composition (quill://entity/{id})' },
    ],
  };

    return jsonResponse(buildSuccess(spec, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OpenAPI spec generation failed';
    return jsonResponse(buildError('OPENAPI_FAILED', message, ctx), 500);
  }
};
