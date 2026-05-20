// SPDX-License-Identifier: Apache-2.0
import type { RouteHandler, RouteContext } from '../types.js';
import { getAllPackageLicenses, checkLicense } from '../middleware/license-check.js';
import { buildSuccess } from '../response.js';

export const licenseStatusHandler: RouteHandler = async (
  _request: Request,
  ctx: RouteContext
): Promise<Response> => {
  const licenses = getAllPackageLicenses();
  const compliance = checkLicense(ctx);

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        licenses,
        compliance: {
          compliant: compliance.compliant,
          license: compliance.license,
          reason: compliance.reason,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '0.2.0',
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};