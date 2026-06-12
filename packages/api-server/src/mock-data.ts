/**
 * MapleSpike — Mock Data (REMOVED: replaced with real pipeline data)
 *
 * Previously contained 800+ lines of hardcoded synthetic data for every
 * agent/action endpoint. All mock data has been removed. The same public
 * interface is preserved for backward compatibility, but now derives its
 * module catalog from @maplespike/pipeline-core's ingestion registry.
 *
 * Mock data is no longer served. Calling the mock endpoint (_mock=true)
 * returns an informational message directing users to use the real API.
 *
 * @deprecated Use @maplespike/pipeline-core directly for real data.
 */

import {
  getAllModules,
  getModulesByCategory,
  getModule,
} from '@maplespike/pipeline-core';
import type { ModuleInfo } from '@maplespike/pipeline-core';
import { enrichCitation, buildQualityMeta } from './response.js';
import type { CitationMeta, QualityMeta, BuildContext } from './response.js';

/* ------------------------------------------------------------------ */
/*  MOCK_DATA_MAP — replaced with pipeline-core registry               */
/* ------------------------------------------------------------------ */

/**
 * Map of "agent/action" → module metadata derived from pipeline-core registry.
 * Previously contained 50+ hardcoded synthetic entries. Now each entry
 * describes the real pipeline module that backs that endpoint.
 *
 * If a module isn't found in the registry, the entry returns an empty
 * results array with an informational message.
 */

export const MOCK_DATA_MAP: Record<string, Record<string, unknown>> = {};

// Agent → pipeline-core module name mapping
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
  'data': 'statcan',
  'energy': 'nrcan',
  'real-estate': 'real-estate',
  'financial-regulation': 'financial-regulation',
  'municipal-long-tail': 'municipal-long-tail',
  'immigration-refugee': 'immigration',
};

// Common actions shared across agents
const COMMON_ACTIONS = ['list', 'search', 'query', 'status', 'stats'];

// Build MOCK_DATA_MAP from pipeline-core module descriptions
function buildMockDataMap(): void {
  const modules = getAllModules();

  // First pass: map by module name
  for (const mod of modules) {
    const agentName = mod.name;
    const actionName = 'data';
    const key = `${agentName}/${actionName}`;
    MOCK_DATA_MAP[key] = {
      results: [],
      total: 0,
      message: `Real data available via pipeline module "${mod.name}". Use the API directly without ?_mock=true.`,
      module: mod.name,
      description: mod.description,
      category: mod.category,
      status: mod.status || 'active',
      sources: mod.sources,
      updateFrequency: mod.updateFrequency,
    };
  }

  // Second pass: map agent/action pairs from AGENT_MODULE_MAP
  for (const [agent, moduleName] of Object.entries(AGENT_MODULE_MAP)) {
    const mod = getModule(moduleName);
    const description = mod?.description ?? `Data for ${agent} via pipeline module "${moduleName}"`;

    for (const action of COMMON_ACTIONS) {
      const key = `${agent}/${action}`;
      MOCK_DATA_MAP[key] = {
        results: [],
        total: 0,
        message: `Real data available via pipeline module "${moduleName}". Use the API directly without ?_mock=true.`,
        module: moduleName,
        description,
        category: mod?.category ?? 'government',
        status: mod?.status ?? 'active',
        sources: mod?.sources ?? [],
        updateFrequency: mod?.updateFrequency ?? 'unknown',
      };
    }
  }
}

buildMockDataMap();

/* ------------------------------------------------------------------ */
/*  getMockResponse                                                     */
/* ------------------------------------------------------------------ */

/**
 * Generate a full MapleSpike response envelope from pipeline module metadata.
 *
 * @deprecated – Use the real API endpoints instead of mock data.
 */
export function getMockResponse(
  agent: string,
  action: string,
  ctx?: { requestId?: string; startTime?: number },
): {
  success: boolean;
  data: Record<string, unknown> | null;
  meta: Record<string, unknown>;
  quality: QualityMeta;
  citation: CitationMeta;
} {
  const key = `${agent}/${action}`;
  const data = MOCK_DATA_MAP[key] ?? {
    results: [],
    message: `No pipeline module registered for "${agent}/${action}". Available modules can be discovered via pipeline-core registry.`,
  };

  const mockCtx = {
    tenant: { id: 'dev', name: 'Dev User', emailVerified: true, tier: 'pro' as const, isActive: true, journalismMode: false },
    requestId: ctx?.requestId || 'mock-' + crypto.randomUUID().slice(0, 12),
    startTime: ctx?.startTime || Date.now(),
  };

  const citation: CitationMeta = enrichCitation({
    source_name: 'MapleSpike Pipeline Data',
    source_url: `https://api.maplespike.ca/v1/${agent}/${action}`,
    retrieved_at: new Date().toISOString(),
    data_hash: '',
    license: 'https://open.canada.ca/en/open-government-licence-canada',
    update_frequency: 'daily',
    original_format: 'JSON',
  });

  const quality: QualityMeta = buildQualityMeta(mockCtx);

  return {
    success: true,
    data: data as Record<string, unknown>,
    meta: {
      requestId: mockCtx.requestId,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      usage: { periodCalls: 0, periodLimit: 1000, tier: 'pro' },
      agent,
      action,
      authMethod: 'api-key',
      creditsCharged: 0,
      cacheStatus: 'deprecated-mock',
      durationMs: 0,
    },
    quality,
    citation,
  };
}

/* ------------------------------------------------------------------ */
/*  Legacy compatibility (derived from pipeline-core registry)          */
/* ------------------------------------------------------------------ */

export interface MockDataSources {
  [source: string]: Record<string, unknown>[];
}

/**
 * @deprecated Legacy source catalog derived from pipeline-core modules.
 */
export const MOCK_DATA_SOURCES: MockDataSources = {};

// Build MOCK_DATA_SOURCES from pipeline-core modules
function buildSources(): void {
  const modules = getAllModules();
  for (const mod of modules) {
    MOCK_DATA_SOURCES[mod.name] = [
      {
        module: mod.name,
        description: mod.description,
        category: mod.category,
        status: mod.status || 'active',
        sources: mod.sources,
        updateFrequency: mod.updateFrequency,
        note: 'Real data available – use the API directly without ?_mock=true',
      },
    ];
  }
}

buildSources();

export const ALL_MOCK_CATEGORIES = Object.keys(MOCK_DATA_SOURCES);

/**
 * @deprecated Returns module catalog instead of mock data.
 */
export function getMockData(source: string): Record<string, unknown>[] {
  return MOCK_DATA_SOURCES[source] || [];
}
