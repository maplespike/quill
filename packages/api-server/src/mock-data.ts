/**
 * Quill — Mock Data (routed to real pipeline-core modules)
 *
 * Previously contained 800+ lines of hardcoded synthetic data for every
 * agent/action endpoint. All mock data has been removed. The `getMockResponse`
 * function now routes directly to pipeline-core ingestion modules via
 * `runModule()`, returning live data wrapped in the standard envelope.
 *
 * The `_mock=true` query parameter triggers this code path — useful for
 * testing and development without caching or auth enforcement.
 *
 * @deprecated Use the real API endpoints directly (without ?_mock=true)
 *   for production access to pipeline-backed data.
 */

import { getModule, runModule } from '@maplespike/pipeline-core';
import { enrichCitation, buildQualityMeta } from './response.js';
import type { CitationMeta, QualityMeta } from './response.js';

/* ------------------------------------------------------------------ */
/*  Agent → Pipeline Module Name Mapping                               */
/* ------------------------------------------------------------------ */

const AGENT_MODULE_MAP: Record<string, string> = {
  committees: 'committees',
  immigration: 'immigration',
  corporate: 'corporate',
  influence: 'lobbying',
  regulations: 'gazette',
  courts: 'canlii',
  oversight: 'oversight',
  'criminal-justice': 'criminal-justice',
  indigenous: 'indigenous-relations',
  defence: 'defence',
  municipal: 'municipal',
  transport: 'transport-infrastructure',
  realtime: 'real-time-feeds',
  media: 'crtc',
  'bank-of-canada': 'statcan',
  education: 'education-research',
  'cra-charity': 'cra-charity',
  'provincial-regulators': 'regulatory-authorities',
  legislation: 'legislation',
  'goc-spending': 'goc-spending',
  a2aj: 'a2aj',
  'social-programs': 'federal',
  sedi: 'opencorporates',
  unions: 'labour',
  universities: 'universities',
  crtc: 'crtc',
  'real-time-feeds': 'real-time-feeds',
  'indigenous-relations': 'indigenous-relations',
  data: 'statcan',
  energy: 'nrcan',
  'real-estate': 'real-estate',
  'financial-regulation': 'financial-regulation',
  'municipal-long-tail': 'municipal-long-tail',
  'immigration-refugee': 'immigration',
};

/**
 * Resolve a pipeline-core module name from an agent slug.
 * Returns `undefined` if no mapping exists.
 */
function resolveModule(agent: string): string | undefined {
  return AGENT_MODULE_MAP[agent];
}

function countResults(result: unknown): number {
  if (Array.isArray(result)) return result.length;
  return result === null || result === undefined ? 0 : 1;
}

/* ------------------------------------------------------------------ */
/*  getMockResponse — calls runModule() on the real pipeline           */
/* ------------------------------------------------------------------ */

/**
 * Generate a full MapleSpike response envelope by running a real
 * pipeline-core ingestion module for the given agent/action pair.
 *
 * The `_mock=true` query parameter triggers this code path. Instead of
 * returning hardcoded fake data, this routes to `runModule()` which
 * dynamically imports the module and executes its main ingest function.
 *
 * @param agent   Agent slug (e.g. "committees", "courts")
 * @param action  Action name (e.g. "list", "search")
 * @param ctx     Optional request context (requestId, startTime)
 * @param args    Additional arguments forwarded to the module's ingest function
 *
 * @deprecated Use the real API endpoints instead of ?_mock=true.
 */
export async function getMockResponse(
  agent: string,
  action: string,
  ctx?: { requestId?: string; startTime?: number },
  ...args: unknown[]
): Promise<{
  success: boolean;
  data: Record<string, unknown> | null;
  meta: Record<string, unknown>;
  quality: QualityMeta;
  citation: CitationMeta;
}> {
  const moduleName = resolveModule(agent);

  const mockCtx = {
    tenant: {
      id: 'dev',
      name: 'Dev User',
      emailVerified: true,
      tier: 'pro' as const,
      isActive: true,
      journalismMode: false,
    },
    requestId: ctx?.requestId || 'mock-' + crypto.randomUUID().slice(0, 12),
    startTime: ctx?.startTime || Date.now(),
  };

  let data: Record<string, unknown>;
  let citation: CitationMeta;

  if (moduleName) {
    const mod = getModule(moduleName);
    try {
      const result = await runModule(moduleName, ...args);
      data = {
        results: Array.isArray(result) ? result : [result],
        total: countResults(result),
        module: moduleName,
        action,
        _note: 'Live data from pipeline-core module — use real API endpoints for production',
      };

      citation = enrichCitation({
        source_name: `Quill — ${mod?.name ?? moduleName}`,
        source_url: `https://api.maplespike.lan/v1/${agent}/${action}`,
        retrieved_at: null,
        data_hash: '',
        license: 'No publisher license declaration was supplied for this response. Quill grants no reuse rights; consult the original source terms.',
        license_basis: 'no-publisher-declaration',
        update_frequency: mod?.updateFrequency ?? 'daily',
        original_format: 'JSON',
      });
    } catch (err) {
      data = {
        results: [],
        total: 0,
        module: moduleName,
        action,
        error:
          err instanceof Error
            ? err.message
            : String(err),
        _note:
          'Module execution failed — upstream may be unreachable or the module may require a database. Use the real API endpoints for production.',
      };

      citation = enrichCitation({
        source_name: `Quill — ${moduleName}`,
        source_url: `https://api.maplespike.lan/v1/${agent}/${action}`,
        retrieved_at: null,
        data_hash: '',
        license: 'No publisher license declaration was supplied for this response. Quill grants no reuse rights; consult the original source terms.',
        license_basis: 'no-publisher-declaration',
        update_frequency: 'unknown',
        original_format: 'JSON',
      });
    }
  } else {
    data = {
      results: [],
      total: 0,
      message: `No pipeline module registered for "${agent}/${action}".`,
      _note:
        'Available modules can be discovered via pipeline-core registry. Use the real API endpoints for production.',
    };

    citation = enrichCitation({
      source_name: 'Quill Data',
      source_url: `https://api.maplespike.lan/v1/${agent}/${action}`,
      retrieved_at: new Date().toISOString(),
      data_hash: '',
      license: 'https://open.canada.ca/en/open-government-licence-canada',
      update_frequency: 'daily',
      original_format: 'JSON',
    });
  }

  const quality: QualityMeta = buildQualityMeta(mockCtx);

  return {
    success: true,
    data,
    meta: {
      requestId: mockCtx.requestId,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      usage: { periodCalls: 0, periodLimit: 1000, tier: 'pro' },
      agent,
      action,
      authMethod: 'api-key',
      creditsCharged: 0,
      cacheStatus: 'mock',
      durationMs: 0,
    },
    quality,
    citation,
  };
}
