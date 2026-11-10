// SPDX-License-Identifier: AGPL-3.0-only
import { randomUUID } from 'node:crypto';

export function addTraceHeaders(response: Response, incomingTraceId?: string): Response {
  const traceId = incomingTraceId || randomUUID();
  response.headers.set('X-MapleSpike-Trace-Id', traceId);
  return response;
}
