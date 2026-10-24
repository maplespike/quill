// SPDX-License-Identifier: AGPL-3.0-only

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';

export const engineRunHandler: RouteHandler = async (request, ctx) => {
  try {
    // Dynamic import — engine may not be built or installed
    let engine: any = null;
    try {
      engine = await import('@maplespike/engine');
    } catch {
      return jsonResponse(
        buildError('ENGINE_NOT_BUILT', 'Engine package not available. Run pnpm --filter @maplespike/engine build first.', ctx),
        503,
      );
    }

    const url = new URL(request.url);
    const fullRun = url.searchParams.get('full') !== 'false';

    const startTime = Date.now();
    let result: any;

    if (fullRun && engine.EngineOrchestrator) {
      const orchestrator = new engine.EngineOrchestrator();
      result = orchestrator.run();
    } else if (engine.runEnginePipeline) {
      result = await engine.runEnginePipeline();
    } else {
      return jsonResponse(
        buildError('ENGINE_MISSING', 'Engine orchestrator not found in @maplespike/engine', ctx),
        500,
      );
    }

    const durationMs = Date.now() - startTime;

    return jsonResponse(buildSuccess({
      status: 'completed',
      durationMs,
      summary: result?.summary ?? null,
      runAt: new Date().toISOString(),
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(buildError('ENGINE_RUN_FAILED', message, ctx), 500);
  }
};
