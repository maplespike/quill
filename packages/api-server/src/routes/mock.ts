/**
 * Fixture routes.
 *
 * These routes serve synthetic fixtures. They do not call live
 * pipeline modules and they do not return parliamentary or committee
 * records. They stay off unless QUILL_FIXTURES=1. Production stays
 * off unless that variable is set.
 */

import type { RouteHandler, RouteContext } from '../types.js';
import { buildError, buildSuccess, jsonResponse } from '../response.js';
import type { BuildContext } from '../response.js';
import {
  FIXTURE_NOTICE,
  fixtureById,
  fixturesEnabled,
  SYNTHETIC_FIXTURES,
} from '../mock-data.js';

const FIXTURE_HEADERS = {
  'X-Quill-Data': 'fixture',
  'Cache-Control': 'no-store',
};

function mergedEnv(ctx: RouteContext): Record<string, string | undefined> {
  return { ...process.env, ...ctx.env };
}

function buildCtx(ctx: RouteContext): BuildContext {
  return {
    tenant: ctx.tenant,
    requestId: ctx.requestId,
    startTime: ctx.startTime,
    queryOptions: ctx.queryOptions,
    metaOverrides: {
      agent: 'fixtures',
      action: 'serve',
      cacheStatus: 'mock',
      authMethod: 'none',
      creditsCharged: 0,
      durationMs: Date.now() - ctx.startTime,
    },
  };
}

function disabledResponse(ctx: RouteContext): Response {
  const bc = buildCtx(ctx);
  const message =
    'Fixture routes are off. They serve synthetic fixtures. Set QUILL_FIXTURES=1 to enable them. Production stays off until you set that variable.';
  return jsonResponse(
    buildError('FIXTURES_DISABLED', message, bc),
    404,
    FIXTURE_HEADERS,
  );
}

export const fixtureListHandler: RouteHandler = async (_request, ctx) => {
  if (!fixturesEnabled(mergedEnv(ctx))) return disabledResponse(ctx);
  const bc = buildCtx(ctx);
  const body = {
    serves: 'synthetic-fixtures',
    notice: FIXTURE_NOTICE,
    synthetic: true as const,
    marker: 'FIXTURE' as const,
    total: SYNTHETIC_FIXTURES.length,
    records: SYNTHETIC_FIXTURES,
  };
  return jsonResponse(buildSuccess(body, bc, {
    source_name: 'Quill synthetic fixtures',
    source_url: '',
    retrieved_at: null,
    data_hash: '',
    license: 'Synthetic fixture. No upstream record and no reuse of a government work.',
    license_basis: 'no-publisher-declaration',
    update_frequency: 'static',
    original_format: 'JSON',
  }), 200, FIXTURE_HEADERS);
};

export const fixtureItemHandler: RouteHandler = async (_request, ctx, params) => {
  if (!fixturesEnabled(mergedEnv(ctx))) return disabledResponse(ctx);
  const id = params.id || params['0'] || '';
  const row = fixtureById(id);
  const bc = buildCtx(ctx);
  if (!row) {
    return jsonResponse(
      buildError('NOT_FOUND', 'No synthetic fixture uses that id.', bc),
      404,
      FIXTURE_HEADERS,
    );
  }
  const body = {
    serves: 'synthetic-fixtures',
    notice: FIXTURE_NOTICE,
    synthetic: true as const,
    marker: 'FIXTURE' as const,
    record: row,
  };
  return jsonResponse(buildSuccess(body, bc, {
    source_name: 'Quill synthetic fixtures',
    source_url: '',
    retrieved_at: null,
    data_hash: '',
    license: 'Synthetic fixture. No upstream record and no reuse of a government work.',
    license_basis: 'no-publisher-declaration',
    update_frequency: 'static',
    original_format: 'JSON',
  }), 200, FIXTURE_HEADERS);
};
