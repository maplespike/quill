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
      description: `Canada's sovereign, AI-native government data layer. One API key gives you access to every major Canadian government dataset — Statistics Canada, open.canada.ca, provincial portals, AI-curated news from 43+ sources, citation verification, bias analysis, and immutable audit trails.`,
      contact: {
        name: 'MapleSpike',
        url: 'https://quill.maplespike.ca',
      },
      license: {
        name: 'AGPL-3.0 (pipeline-core) / Commercial (hosted API)',
        url: 'https://www.gnu.org/licenses/agpl-3.0.html',
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
            citations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  source: { type: 'string' },
                  timestamp: { type: 'string' },
                  hash: { type: 'string' },
                  license: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    paths: {
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
          description: 'Returns the SHA-256 hash for an article, enabling independent verification that content has not been altered.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Citation details with verification command' } },
        },
      },
      '/v1/claims/verify/{hash}': {
        get: {
          tags: ['Citations'],
          summary: 'Verify a claim hash (public)',
          description: 'Public trust primitive — checks a SHA-256 claim hash against the Quill claim store and pipeline index. No API key required. Returns verified status plus full provenance: source name, source URL, retrieval time, license, and a shell command to independently reproduce the hash.',
          parameters: [{ name: 'hash', in: 'path', required: true, schema: { type: 'string' }, description: 'SHA-256 hash, with or without the sha256: prefix (e.g. sha256:a1b2... or bare hex)' }],
          responses: {
            '200': { description: 'Claim verification result with provenance (source, retrieved_at, license, verify_command)' },
            '400': { description: 'Invalid SHA-256 hash format' },
            '500': { description: 'Claim verification failed' },
          },
        },
      },
      '/v1/claims/latest': {
        get: {
          tags: ['Citations'],
          summary: 'List recent claim bundles (public)',
          description: 'Public discovery — returns the most recently registered verifiable claim bundles (hash, claim, source, retrieval time, license). Lets journalists and other MCP authors find what Quill has attested, then verify any single hash via GET /v1/claims/verify/{hash}. No API key required.',
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
      '/v1/billing/checkout': {
        post: {
          tags: ['Billing'],
          summary: 'Create a checkout session',
          description: 'Initiates a payment checkout for a plan upgrade.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['planId'],
                  properties: {
                    planId: { type: 'string', description: 'Plan to subscribe to' },
                    successUrl: { type: 'string' },
                    cancelUrl: { type: 'string' },
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
          summary: 'Initiate GitHub OAuth login',
          responses: { '302': { description: 'Redirect to GitHub' } },
        },
      },
      '/v1/auth/github/callback': {
        get: {
          tags: ['Auth'],
          summary: 'GitHub OAuth callback',
          responses: { '200': { description: 'Authentication completed' } },
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
