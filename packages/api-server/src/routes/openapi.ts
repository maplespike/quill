/**
 * MapleSpike — OpenAPI Specification
 *
 * GET /v1/openapi.json — Auto-generated OpenAPI 3.1 spec
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, jsonResponse } from '../response.js';
import { loadConfig } from '../config.js';

export const openApiHandler: RouteHandler = async (_request, ctx) => {
  const config = loadConfig(ctx.env);

  const spec = {
    openapi: '3.1.0',
    info: {
      title: config.name,
      version: config.version,
      description: `Canada's sovereign, AI-native government data layer. One API key gives you access to every major Canadian government dataset — Statistics Canada, open.canada.ca, provincial portals, AI-curated news from 43+ sources, citation verification, bias analysis, and immutable audit trails.`,
      contact: {
        name: 'MapleSpike',
        url: 'https://maplespike.ca',
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
          bearerFormat: 'API key (maplespike_ prefix)',
          description: 'Get your API key at https://maplespike.ca',
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
          summary: 'Verify a citation hash',
          description: 'Returns the SHA-256 hash for an article, enabling independent verification that content has not been altered.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Citation details with verification command' } },
        },
      },
      '/v1/usage': {
        get: {
          summary: 'Get current usage',
          description: 'Returns daily and monthly API call counts, limits, and remaining quota for your tier.',
          responses: { '200': { description: 'Usage statistics' } },
        },
      },
      '/v1/audit/query': {
        post: {
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
    },
    tags: [
      { name: 'Health', description: 'Service health and status' },
      { name: 'News', description: 'AI-curated Canadian news' },
      { name: 'Government Data', description: 'Canadian government data releases and search' },
      { name: 'Citations', description: 'Content verification and provenance' },
      { name: 'Curation', description: 'AI-powered article curation' },
      { name: 'Usage', description: 'API usage and quota management' },
      { name: 'Audit', description: 'Immutable audit trails for data provenance' },
    ],
  };

  return jsonResponse(buildSuccess(spec, ctx));
};
