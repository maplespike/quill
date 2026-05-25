// SPDX-License-Identifier: Apache-2.0

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
