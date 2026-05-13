/**
 * MapleSpike Canada — GET /v1/signals
 *
 * Returns detected intelligence signals and briefs from the engine pipeline.
 * Runs the engine orchestrator on pipeline data.
 *
 * Engine uses better-sqlite3 (Node.js native addon), so this route
 * only works in the Node.js dev-server, not in Cloudflare Workers.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';

export const signalsHandler: RouteHandler = async (_request, ctx) => {
  try {
    // Dynamic import — engine uses better-sqlite3 (native) which only works in Node.js
    let EngineOrchestrator: new () => { run(): unknown; close(): void };
    try {
      const mod = await import('../../engine/src/orchestrator.js');
      EngineOrchestrator = mod.EngineOrchestrator;
    } catch {
      // Fallback: try .ts extension for tsx/dev mode
      const mod = await import('../../engine/src/orchestrator.ts');
      EngineOrchestrator = mod.EngineOrchestrator;
    }

    const engine = new EngineOrchestrator();
    try {
      const result = engine.run();

      const body = {
        pipeline: result.pipeline,
        summary: result.summary,
        signals: result.signals.map((s: { id: unknown; title: unknown; signalType: unknown; confidence: unknown; description: unknown; nodes: unknown; sources: unknown; createdAt: unknown }) => ({
          id: s.id,
          title: s.title,
          type: s.signalType,
          confidence: s.confidence,
          description: s.description,
          entities: s.nodes,
          sources: s.sources,
          createdAt: s.createdAt,
        })),
        brief: result.brief
          ? {
              id: result.brief.id,
              title: result.brief.title,
              summary: result.brief.summary,
              sections: result.brief.sections.map((sec: { title: unknown; content: unknown }) => ({
                title: sec.title,
                content: sec.content,
              })),
            }
          : null,
        graph: {
          nodes: result.graph.nodes.length,
          edges: result.graph.edges.length,
          threads: result.graph.threads.length,
        },
      };

      return jsonResponse(buildSuccess(body, ctx));
    } finally {
      engine.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API] Engine error:', message);
    return jsonResponse(
      buildError(
        'ENGINE_ERROR',
        `Failed to run engine pipeline: ${message}`,
        ctx,
      ),
      500,
    );
  }
};
