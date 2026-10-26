// SPDX-License-Identifier: AGPL-3.0-only

import { memoryStore } from './memory-store.js';

export async function briefsHandler(req: Request, ctx: any, params: Record<string, string>): Promise<Response> {
  const briefs = memoryStore.getBriefs(50);
  return new Response(JSON.stringify({
    success: true,
    data: { briefs },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
