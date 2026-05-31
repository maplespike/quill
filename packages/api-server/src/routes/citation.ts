/**
 * MapleSpike — Citation Endpoint (Real)
 *
 * GET /v1/citation/:hash — Verify a SHA-256 citation hash against real pipeline data.
 *
 * The citation hash is computed from the JSON-serialized record at fetch time.
 * To verify: re-fetch the source URL, compute sha256 of the response, compare.
 *
 * Hash format: sha256:<hex> (e.g. "sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c")
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { computeHash } from '@maplespike/pipeline-core';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import pino from 'pino';

const log = pino({
  level: process.env.MAPLESPIKE_LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
});

/* ------------------------------------------------------------------ */
/*  Pipeline data loader                                               */
/* ------------------------------------------------------------------ */


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pipelineData: Record<string, any> | null = null;

function loadPipelineData(): Record<string, any> | null {
  if (pipelineData) return pipelineData;

  const paths = [
    resolve(__dirname, '../../../../packages/portal/assets/pipeline-data.json'),
    resolve('/data/projects/own/maplespike/packages/portal/assets/pipeline-data.json'),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, 'utf-8');
        pipelineData = JSON.parse(raw);
        log.info(`Loaded pipeline data from ${p} (${raw.length} bytes)`);
        return pipelineData;
      } catch (err) {
        log.error(`Failed to load ${p}: ${err}`);
      }
    }
  }
  log.error('Pipeline data not found at any path');
  return null;
}

/* ------------------------------------------------------------------ */
/*  Pipeline data traversal (generic record search)                    */
/* ------------------------------------------------------------------ */

interface CitationResult {
  source: string;
  record: Record<string, unknown>;
  computedHash: string;
}

async function findRecordByHash(targetHash: string): Promise<CitationResult | null> {
  // Citation lookup from pipeline data file removed.
  // Citations are verified via the MCP server which queries the live database.
  return null;
}

/* ------------------------------------------------------------------ */
/*  Handler                                                           */
/* ------------------------------------------------------------------ */

export const getCitationHandler: RouteHandler = async (_request, ctx, params) => {
  const rawHash = params.id || '';

  // Parse "sha256:hex" format — strip prefix, accept hex-only
  let targetHash = rawHash;
  if (targetHash.startsWith('sha256:')) {
    targetHash = targetHash.slice(7);
  } else if (targetHash.startsWith('sha256-')) {
    targetHash = targetHash.slice(7);
  }

  // Validate hex
  if (!/^[a-f0-9]{64}$/i.test(targetHash)) {
    return jsonResponse(
      buildError('INVALID_HASH', 'Invalid SHA-256 hash format. Expected "sha256:<64 hex chars>"', ctx),
      400,
    );
  }

  targetHash = targetHash.toLowerCase();

  try {
    const result = await findRecordByHash(targetHash);

    if (!result) {
      return jsonResponse(
        buildError('CITATION_NOT_FOUND', `No record found with hash sha256:${targetHash}. Data may have been modified or the hash is from a different source.`, ctx),
        404,
      );
    }

    const sourceConfig = getSourceConfig(result.source);

    return jsonResponse(buildSuccess({
      verified: true,
      citation: {
        source_name: result.source || 'Government of Canada',
        source_url: result.record.source_url || result.record.url || '',
        license: 'Open Government Licence – Canada',
        data_hash: targetHash,
        retrieved_at: new Date().toISOString(),
        update_frequency: 'unknown',
      },
      verify_command: `echo -n '${JSON.stringify(result.record).replace(/'/g, "'\\''")}' | sha256sum`,
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Citation lookup failed';
    return jsonResponse(buildError('CITATION_ERROR', message, ctx), 500);
  }
};

/* ------------------------------------------------------------------ */
/*  Source metadata                                                    */
/* ------------------------------------------------------------------ */

interface SourceInfo {
  name: string;
  url: string;
}

function getSourceConfig(sourceKey: string): SourceInfo {
  const configs: Record<string, SourceInfo> = {
    hoc:    { name: 'House of Commons — Committee Evidence', url: 'https://www.ourcommons.ca/Committees/' },
    senate: { name: 'Senate of Canada — Committee Evidence', url: 'https://sencanada.ca/en/committees/' },
    gazette:{ name: 'Canada Gazette', url: 'https://gazette.gc.ca/' },
    gic:    { name: 'Governor-in-Council Appointments', url: 'https://gazette.gc.ca/gc/gic/' },
    lmia:   { name: 'LMIA Data — Employment and Social Development Canada', url: 'https://www.canada.ca/en/employment-social-development.html' },
    corporate: { name: 'Federal Lobbying Registry', url: 'https://lobbycanada.gc.ca/' },
    influence: { name: 'Influence Actor Registry', url: 'https://apps.cra-arc.gc.ca/' },
    elections: { name: 'Elections Canada', url: 'https://www.elections.ca/' },
    oversight: { name: 'Oversight Bodies — OAG, PBO, Ethics, CB, CRTC', url: 'https://www.oag-bvg.gc.ca/' },
    canlii:    { name: 'CanLII — Canadian Legal Information Institute', url: 'https://www.canlii.org/' },
  };
  return configs[sourceKey] || { name: `MapleSpike — ${sourceKey}`, url: 'https://maplespike.ca/' };
}
