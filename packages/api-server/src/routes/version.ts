// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — GET /v1/version
 *
 * Returns the current API server version from config.
 * Used by clients and monitoring for deployment tracking.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, jsonResponse } from '../response.js';
import { loadConfig } from '../config.js';

interface VersionResponse {
  version: string;
  name: string;
  environment: string;
}

export const versionHandler: RouteHandler = async (_request, ctx) => {
  const config = loadConfig(ctx.env);
  const body: VersionResponse = {
    version: config.version,
    name: config.name,
    environment: config.environment,
  };
  return jsonResponse(buildSuccess(body, ctx, {}));
};
