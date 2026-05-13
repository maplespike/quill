/**
 * MapleSpike Canada — Citation Endpoint
 *
 * GET /v1/citation/:id — Retrieve and verify citation hash
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { computeHash, generateVerifyCommand } from '@maplespike/pipeline-core';

const SAMPLE_CITATIONS: Record<string, { id: string; contentHash: string; algorithm: string; url: string; verifiedAt: string }> = {
  'cit-001': {
    id: 'cit-001',
    contentHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    algorithm: 'sha256',
    url: 'https://maplespike.ca/v1/gov/releases?jurisdiction=federal',
    verifiedAt: '2026-05-10T14:30:00Z',
  },
  'cit-002': {
    id: 'cit-002',
    contentHash: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
    algorithm: 'sha256',
    url: 'https://maplespike.ca/v1/citation/cit-002',
    verifiedAt: '2026-05-09T12:00:00Z',
  },
};

export const getCitationHandler: RouteHandler = async (_request, ctx, params) => {
  const citation = SAMPLE_CITATIONS[params.id];

  if (!citation) {
    return jsonResponse(buildError('CITATION_NOT_FOUND', `No citation with id: ${params.id}`, ctx), 404);
  }

  return jsonResponse(buildSuccess({
    ...citation,
    verifyCommand: generateVerifyCommand(citation.url, citation.algorithm),
    verificationUrl: `https://maplespike.ca/citation/${params.id}`,
  }, ctx));
};
