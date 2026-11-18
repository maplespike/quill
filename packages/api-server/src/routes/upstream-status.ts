// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — GET /v1/upstream/status
 *
 * Public, auth-exempt: the site banner reads it before anyone signs in, and the
 * payload carries only host names, states and copy that the sources themselves
 * publish. No tenant data, no probe credentials, no personal data.
 *
 * The payload is built by the prober (`src/upstream/prober.ts`), which owns the
 * N-of-M logic and the hysteresis. This handler only shapes the response — it
 * never makes a network call, so an unreachable upstream can never slow it.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, jsonResponse } from '../response.js';
import { upstreamProber } from '../upstream/prober.js';

export const upstreamStatusHandler: RouteHandler = async (_request, ctx) => {
  const payload = upstreamProber.status();
  return jsonResponse(buildSuccess(payload, ctx, {}));
};
