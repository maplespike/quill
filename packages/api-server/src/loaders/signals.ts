// SPDX-License-Identifier: AGPL-3.0-only

import { memoryStore } from './memory-store.js';

export async function signalsHandler(req: Request, ctx: any, params: Record<string, string>): Promise<Response> {
  const signals = memoryStore.getSignals(100);
  return new Response(JSON.stringify({
    success: true,
    data: signals.length > 0 ? signals : [],
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: signals.length > 0 ? 200 : 200,
  });
}
