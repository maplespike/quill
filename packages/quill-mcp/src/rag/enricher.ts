// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MCP RAG Enricher — MapleSpike Quill
 *
 * Enriches MCP tool responses with semantically relevant context
 * from Qdrant vector search.
 *
 * Usage:
 *   import { enrichWithRag } from '../rag/enricher.js';
 *   const enriched = await enrichWithRag('search-contracts', originalResult);
 */

import { searchSimilar } from '../ai/qdrant.js';
import type { QdrantScoredPoint } from '../ai/qdrant.js';

/* ------------------------------------------------------------------ */
/*  RAG Source Entry                                                   */
/* ------------------------------------------------------------------ */

export interface RagSource {
  id: string | number;
  title: string;
  text: string;
  url: string;
  source: string;
  score: number;
}

export interface RagEnrichmentResult {
  ragSources: RagSource[];
}

export interface EnrichOptions {
  /** Max number of RAG results to attach (default: 3) */
  maxResults?: number;
  /** Minimum relevance score (default: 0.7) */
  scoreThreshold?: number;
  /** Collection to search (default: uses qdrant.ts default) */
  collectionName?: string;
}

/* ------------------------------------------------------------------ */
/*  Per-Tool Enrichment Registry                                       */
/* ------------------------------------------------------------------ */

export interface ToolEnrichmentConfig {
  /** Whether enrichment is enabled for this tool */
  enabled: boolean;
  /** Max results for this specific tool (overrides default) */
  maxResults?: number;
  /** Score threshold for this specific tool (overrides default) */
  scoreThreshold?: number;
}

/**
 * Registry mapping tool names to their enrichment configuration.
 *
 * Add entries here to enable RAG enrichment for specific MCP tools.
 * Tools not listed are NOT enriched by default.
 */
const toolEnrichmentRegistry: Record<string, ToolEnrichmentConfig> = {
  'search-canlii':          { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'search-legislation':     { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'search-municipal-data':  { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'search-gazette':         { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'smart-search':           { enabled: true, maxResults: 5, scoreThreshold: 0.6 },
  'search_transportation_data': { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'search_trademarks':      { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'search_technology_data': { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'search_public_safety':   { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'search_patents':         { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'search_official_languages': { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'search_mining_data':     { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'search_indigenous_stats': { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'worldbank-wdi':          { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'un-comtrade':            { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'search-qc-data':         { enabled: true, maxResults: 3, scoreThreshold: 0.7 },
  'bilingual-descriptions': { enabled: true, maxResults: 2, scoreThreshold: 0.75 },
};

/* ------------------------------------------------------------------ */
/*  Main Enrichment Function                                           */
/* ------------------------------------------------------------------ */

/**
 * Check whether a specific tool has RAG enrichment enabled.
 */
export function isEnrichmentEnabled(toolName: string): boolean {
  const config = toolEnrichmentRegistry[toolName];
  return config?.enabled ?? false;
}

/**
 * Get the enrichment configuration for a specific tool.
 */
export function getToolEnrichmentConfig(toolName: string): ToolEnrichmentConfig | null {
  return toolEnrichmentRegistry[toolName] ?? null;
}

/**
 * Register or update enrichment config for one or more tools at runtime.
 */
export function registerToolEnrichment(
  configs: Record<string, ToolEnrichmentConfig>,
): void {
  for (const [toolName, config] of Object.entries(configs)) {
    toolEnrichmentRegistry[toolName] = config;
  }
}

/**
 * Enrich a tool's text result with semantically relevant Qdrant results.
 *
 * Steps:
 *   1. Check if the tool is configured for enrichment (if not, return input as-is)
 *   2. Query Qdrant with the result text as the embedding query
 *   3. Filter results by score threshold
 *   4. Append { rag_sources: [...] } to the response
 *
 * Graceful degradation: if Qdrant is unreachable or enrichment fails,
 * returns the original result text unchanged.
 *
 * @param toolName  - The MCP tool name (used for registry lookup)
 * @param resultText - The text output from the MCP tool handler
 * @param options   - Override enrichment options per-call
 * @returns The original result with enrichment appended, or the original text
 */
export async function enrichWithRag(
  toolName: string,
  resultText: string,
  options?: EnrichOptions,
): Promise<string> {
  // Check if this tool has enrichment enabled
  const toolConfig = toolEnrichmentRegistry[toolName];

  // If the tool isn't explicitly configured, fall back to the options
  if (!toolConfig?.enabled && !options) {
    return resultText;
  }

  const maxResults = options?.maxResults ?? toolConfig?.maxResults ?? 3;
  const scoreThreshold = options?.scoreThreshold ?? toolConfig?.scoreThreshold ?? 0.7;

  try {
    // Query Qdrant with the result text
    const results: QdrantScoredPoint[] = await searchSimilar(
      resultText,
      maxResults,
      scoreThreshold,
    );

    if (!results || results.length === 0) {
      return resultText;
    }

    // Build RAG sources
    const ragSources: RagSource[] = results.map((point) => {
      const payload = point.payload ?? {};
      return {
        id: point.id,
        title: (payload.title as string)
          || (payload.source_title as string)
          || `Source ${point.id}`,
        text: ((payload.chunk_text as string)
          || (payload.description as string)
          || '').substring(0, 300),
        url: (payload.url as string)
          || (payload.source_url as string)
          || '#',
        source: (payload.source as string)
          || (payload.source_module as string)
          || 'Qdrant',
        score: Math.round(point.score * 1000) / 1000,
      };
    });

    // Append RAG sources as JSON
    const enrichment: RagEnrichmentResult = { ragSources };
    const enrichmentJson = JSON.stringify(enrichment, null, 2);

    return `${resultText}\n\n---\n**Related Sources**\n\n${enrichmentJson}`;
  } catch (err) {
    // Graceful degradation — return original on any error
    console.error(`[rag/enricher] Enrichment failed for tool "${toolName}": ${err instanceof Error ? err.message : String(err)}`);
    return resultText;
  }
}

export default { enrichWithRag, isEnrichmentEnabled, registerToolEnrichment };
