// SPDX-License-Identifier: AGPL-3.0-only
/**
 * SearXNG Health Check Tool
 *
 * Monitors SearXNG engine health: which engines are failing, suspended, or rate-limited.
 * Calls SearXNG's /stats endpoint to get engine status.
 */

import type { ToolDefinition, ToolHandler } from './types.js';

export const definition: ToolDefinition = {
  name: 'searxng_health',
  description: 'Check SearXNG engine health: which engines are failing, suspended, or rate-limited. Returns engine success rates, suspension times, and error counts.',
  inputSchema: {
    type: 'object',
    properties: {
      checkEngines: {
        type: 'boolean',
        default: true,
        description: 'Whether to run live engine tests (adds ~5s latency)'
      },
      maxResults: {
        type: 'integer',
        default: 10,
        minimum: 1,
        maximum: 50,
        description: 'Max results to return per engine test'
      }
    },
  },
};

export const handler: ToolHandler = async (params) => {
  const { checkEngines = true, maxResults = 10 } = params;

  // SearXNG URL from env or default to cluster service
  const SEARXNG_URL = process.env.SEARXNG_URL || 'http://searxng.search.svc.cluster.local:8080';

  try {
    // Get engine status from /stats endpoint
    const statusResponse = await fetch(`${SEARXNG_URL}/stats`);

    if (!statusResponse.ok) {
      return {
        content: [{
          type: 'text',
          text: `Error: Failed to fetch SearXNG stats (HTTP ${statusResponse.status})`,
        }],
      };
    }

    const stats: any = await statusResponse.json();

    let engineHealth: any = {};

    if (checkEngines) {
      // Test each engine with a simple query
      const testQuery = 'test';
      const engines = stats.engines || [];

      const results = await Promise.all(
        engines.map(async (engine: string) => {
          try {
            const response = await fetch(
              `${SEARXNG_URL}/search?q=${encodeURIComponent(testQuery)}&format=json&engines=${engine}&pageno=1`,
              {
                signal: AbortSignal.timeout(5000) // 5s timeout per engine
              }
            );
            const data: any = await response.json();
            return {
              engine,
              status: 'ok',
              results: data.results?.length || 0,
              error: null,
            };
          } catch (error: any) {
            return {
              engine,
              status: 'error',
              error: error.message || 'Unknown error',
            };
          }
        })
      );

      engineHealth = {
        engines: results,
        total: results.length,
        healthy: results.filter((r: any) => r.status === 'ok').length,
        failing: results.filter((r: any) => r.status === 'error').length,
      };
    }

    // Parse engine status from stats
    const engineStats = stats.engine_stats || {};
    const suspendedEngines = Object.entries(engineStats)
      .filter(([_, stats]: any) => stats.suspension_time && stats.suspension_time > 0)
      .map(([name, stats]: any) => ({
        name,
        suspension_time: stats.suspension_time,
        suspension_count: stats.suspension_count || 0,
      }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          summary: {
            timestamp: new Date().toISOString(),
            searxng_url: SEARXNG_URL,
            total_engines: stats.engines?.length || 0,
            healthy_engines: engineHealth.healthy || 0,
            failing_engines: engineHealth.failing || 0,
            suspended_engines: suspendedEngines.length,
          },
          suspendedEngines,
          engineHealth: checkEngines ? engineHealth : undefined,
          fullStats: stats,
        }, null, 2),
      }],
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `Error checking SearXNG health: ${error.message}`,
      }],
    };
  }
};
