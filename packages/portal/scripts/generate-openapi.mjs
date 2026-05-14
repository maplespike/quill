#!/usr/bin/env node
/**
 * Generate OpenAPI 3.1 specification from the built SDK agent catalog.
 *
 * Run: node scripts/generate-openapi.mjs
 * Output: packages/portal/v1/openapi.json
 *
 * This ensures the OpenAPI spec always matches the actual SDK agents.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const sdkPath = resolve(__dirname, '../../sdk/dist/index.cjs');
const sdk = require(sdkPath);

const agents = sdk.listAgents();
const agentMap = sdk.AGENTS;

const paths = {};
const schemas = {};

for (const [key, agent] of Object.entries(agentMap)) {
  for (const action of agent.actions) {
    const endpoint = `/v1/${agent.name}/${action.id}`;
    const params = {};
    for (const p of [...(action.requiredParams || []), ...(action.optionalParams || [])]) {
      params[p] = {
        type: 'string',
        description: `${p} parameter`,
        ...(action.requiredParams?.includes(p) ? {} : { nullable: true }),
      };
    }
    params['limit'] = { type: 'integer', nullable: true, description: 'Max results' };

    paths[endpoint] = {
      get: {
        tags: [agent.name],
        summary: action.description,
        description: action.description,
        operationId: `${agent.name}-${action.id}`,
        parameters: [
          ...(action.requiredParams || []).map(p => ({
            name: p, in: 'query', required: true, schema: { type: 'string' },
          })),
          ...(action.optionalParams || []).map(p => ({
            name: p, in: 'query', required: false, schema: { type: 'string' },
          })),
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/MapleSpikeResponse' } } },
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
    title: 'MapleSpike API',
    version: '0.2.0',
    description: 'Canadian government data API — 53 modules covering Parliament, lobbying, immigration, courts, regulations, oversight, real-time feeds, and more. Every response includes SHA-256 verified citations.',
    contact: {
      name: 'MapleSpike',
      url: 'https://maplespike.ca',
      email: 'dev@maplespike.ca',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    { url: 'https://api.maplespike.ca', description: 'Production' },
    { url: 'https://api.maplespike.ca', description: 'Development' },
  ],
  paths,
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key from https://maplespike.ca/workspace',
      },
    },
    schemas: {
      MapleSpikeResponse: {
        type: 'object',
        properties: {
          data: { type: 'object', description: 'Response payload' },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              source: { type: 'string' },
            },
          },
          quality: {
            type: 'object',
            properties: {
              score: { type: 'number', minimum: 0, maximum: 1 },
              freshness: { type: 'string' },
            },
          },
          citation: {
            type: 'object',
            properties: {
              hash: { type: 'string', description: 'SHA-256 citation hash' },
              sourceUrl: { type: 'string' },
              retrievedAt: { type: 'string', format: 'date-time' },
              license: { type: 'string' },
            },
          },
        },
      },
    },
  },
  tags: Object.entries(agentMap).map(([key, agent]) => ({
    name: agent.name,
    description: agent.description,
  })),
};

const outDir = resolve(__dirname, '../v1');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'openapi.json');
writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`Wrote ${outPath} — ${Object.keys(paths).length} endpoints across ${Object.keys(agentMap).length} agents`);
