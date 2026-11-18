/**
 * Quill — GET /v1/financial-regulation
 * Quill — GET /v1/financial-regulation/cross-reference
 *
 * Live financial regulator ingestion via pipeline-core. Pulls OSFI capital
 * adequacy, CDIC member institutions, FCAC complaints, CSA enforcement,
 * OBSI ombudsman data — and runs the banking/lobbying cross-reference report.
 *
 * The cross-reference BankingLobbyingReport returns institutionsScanned,
 * matchedInstitutions, complaintsOnly, lobbyingOnly, generatedAt — we surface
 * all of those via runLivePipeline().metadata rather than fabricating zeros.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { ingestAllFinancialRegulation } from '@maplespike/pipeline-core/financial-regulation';
import { crossReferenceBankingLobbying } from '@maplespike/pipeline-core/financial-regulation';
import { canAccess } from '../feature-gates.js';
import { portalHost } from '@maplespike/pipeline-core/config/public-base-url';
import { runLivePipeline, normalizeFilterString } from './_live.js';

const REGULATOR_ALIASES: Record<string, string> = {
  osfi: 'osfi',
  bank: 'osfi',
  cdic: 'cdic',
  deposit: 'cdic',
  fcac: 'fcac',
  consumer: 'fcac',
  csa: 'csa',
  securities: 'csa',
  obsi: 'obsi',
  ombudsman: 'obsi',
};

export const finRegDataHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const regulator = url.searchParams.get('regulator');
  const category = url.searchParams.get('category');
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  const cacheKey = `finreg:${url.searchParams.toString() || 'all'}`;

  const live = await runLivePipeline(ctx, cacheKey, async () => ingestAllFinancialRegulation(), {
    ttlSeconds: 600, // regulatory updates: every 10 min
  });

  let records = live.records;
  if (regulator) {
    const wantedRaw = REGULATOR_ALIASES[regulator.toLowerCase()] ?? regulator.toLowerCase();
    const wantedNorm = normalizeFilterString(wantedRaw);
    const wantedAlt = normalizeFilterString(regulator);
    records = records.filter((r) => {
      const rec = r as { regulator?: string; source?: string };
      const regNorm = normalizeFilterString(rec.regulator ?? '');
      const srcNorm = normalizeFilterString(rec.source ?? '');
      return regNorm === wantedNorm || regNorm === wantedAlt || srcNorm === wantedNorm || srcNorm === wantedAlt;
    });
  }
  if (category) {
    const wantedNorm = normalizeFilterString(category);
    records = records.filter((r) => {
      const cat = (r as { category?: string }).category ?? '';
      return normalizeFilterString(cat) === wantedNorm;
    });
  }
  records = records.slice(0, limit);

  return jsonResponse(
    buildSuccess(
      {
        domain: 'financial-regulation',
        regulators: ['osfi', 'cdic', 'fcac', 'csa', 'obsi'],
        records,
        provenance: live.provenance,
        filters: { regulator: regulator || null, category: category || null, limit },
      },
      ctx,
    ),
  );
};

export const finRegCrossRefHandler: RouteHandler = async (request, ctx) => {
  if (!canAccess(ctx.tenant.tier, 'crossReferenceReports')) {
    return jsonResponse(
      buildError(
        'UPGRADE_REQUIRED',
        `Cross-reference reports require a Business plan or higher. Upgrade at ${portalHost()}/billing.`,
        ctx,
      ),
      402,
    );
  }

  const url = new URL(request.url);
  const institution = url.searchParams.get('institution');

  const cacheKey = `finreg-xref:${institution ?? 'all'}`;

  const live = await runLivePipeline(
    ctx,
    cacheKey,
    async () => crossReferenceBankingLobbying(institution ? [institution] : undefined),
    { ttlSeconds: 600 },
  );

  // Surface real meta from the cross-reference report (institutionsScanned,
  // matchedInstitutions, complaintsOnly, lobbyingOnly, generatedAt) instead of
  // fabricating zeros.
  const meta = live.metadata as {
    institutionsScanned?: number;
    matchedInstitutions?: number;
    complaintsOnly?: number;
    lobbyingOnly?: number;
    generatedAt?: string;
  };

  return jsonResponse(
    buildSuccess(
      {
        domain: 'financial-regulation.cross-reference',
        institution: institution || null,
        records: live.records,
        matched: meta.matchedInstitutions ?? live.records.length,
        institutionsScanned: meta.institutionsScanned ?? 0,
        complaintsOnly: meta.complaintsOnly ?? 0,
        lobbyingOnly: meta.lobbyingOnly ?? 0,
        generatedAt: meta.generatedAt ?? new Date().toISOString(),
        provenance: live.provenance,
        filters: { institution: institution || null },
      },
      ctx,
    ),
  );
};
