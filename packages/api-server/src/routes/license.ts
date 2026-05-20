// SPDX-License-Identifier: Apache-2.0
import type { RouteHandler, RouteContext } from '../types.js';
import { getAllPackageLicenses, checkLicense } from '../middleware/license-check.js';
import { buildSuccess, jsonResponse } from '../response.js';

export const licenseStatusHandler: RouteHandler = async (
  _request: Request,
  ctx: RouteContext
): Promise<Response> => {
  const licenses = getAllPackageLicenses();
  const compliance = checkLicense(ctx);

  const response = buildSuccess(
    {
      licenses,
      compliance: {
        compliant: compliance.compliant,
        license: compliance.license,
        reason: compliance.reason,
      },
    },
    {
      tenant: ctx.tenant,
      requestId: ctx.requestId,
      startTime: ctx.startTime,
    }
  );

  return jsonResponse(response);
};