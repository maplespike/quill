import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { canAccess } from '../feature-gates.js';

const SAMPLE_FINREG = [
  { source: 'osfi', title: 'OSFI Regulatory Data', description: 'Financial institution regulatory filings and capital adequacy', regulator: 'OSFI', jurisdiction: 'federal', category: 'banking' },
  { source: 'cdic', title: 'CDIC Member Institutions', description: 'Deposit insurance member list and coverage data', regulator: 'CDIC', jurisdiction: 'federal', category: 'deposit-insurance' },
  { source: 'fcac', title: 'FCAC Consumer Complaints', description: 'Banking complaint data aggregated by institution', regulator: 'FCAC', jurisdiction: 'federal', category: 'consumer-protection' },
  { source: 'csa', title: 'CSA Securities Regulation', description: 'Canadian Securities Administrators regulatory data', regulator: 'CSA', jurisdiction: 'federal-provincial', category: 'securities' },
  { source: 'obsi', title: 'OBSI Banking Ombudsman', description: 'Banking and investment ombudsman complaint data', regulator: 'OBSI', jurisdiction: 'federal', category: 'ombudsman' },
];

export const finRegDataHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const regulator = url.searchParams.get('regulator');
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  let data = SAMPLE_FINREG;
  if (regulator) data = data.filter(d => d.regulator?.toLowerCase() === regulator.toLowerCase());
  data = data.slice(0, limit);
  return jsonResponse(buildSuccess({ records: data, total: data.length, regulator }, ctx));
};

export const finRegCrossRefHandler: RouteHandler = async (request, ctx) => {
  // ── Feature gate: cross-reference reports require Business tier or higher ──
  if (!canAccess(ctx.tenant.tier, 'crossReferenceReports')) {
    return jsonResponse(buildError('UPGRADE_REQUIRED',
      'Cross-reference reports require a Business plan or higher. Upgrade at maplespike.lan/billing.',
      ctx), 402);
  }

  const url = new URL(request.url);
  const institution = url.searchParams.get('institution');
  return jsonResponse(buildSuccess({
    crossReferenceAvailable: true,
    description: 'Cross-references FCAC banking complaints against federal lobbying registry',
    endpoint: '/v1/financial-regulation/cross-reference',
    institution,
  }, ctx));
};
