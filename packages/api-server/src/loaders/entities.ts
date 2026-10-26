// SPDX-License-Identifier: AGPL-3.0-only

import { memoryStore } from './memory-store.js';

export async function entitiesHandler(req: Request, ctx: any, params: Record<string, string>): Promise<Response> {
  const entities = memoryStore.getEntities();
  return new Response(JSON.stringify({
    success: true,
    data: {
      entities,
      links: [],
      totalEntities: entities.length,
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
