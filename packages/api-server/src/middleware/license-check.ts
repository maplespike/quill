// SPDX-License-Identifier: Apache-2.0
/**
 * License Compliance Middleware for MapleSpike API
 *
 * Enforces license compliance for organizations using pipeline-core
 * in proprietary products. Prevents AGPL violations by enterprises.
 */

import type { RouteContext } from '../types.js';
import { checkLicenseCompliance, logComplianceEvent } from '@maplespike/pipeline-core';

interface LicenseCheckResult {
  compliant: boolean;
  license?: string;
  reason?: string;
}

/**
 * Package license mapping for compliance checks
 * Based on README.md: core (AGPL), interface (Apache-2.0), client (MIT)
 */
const PACKAGE_LICENSES: Record<string, string> = {
  'pipeline-core': 'AGPL-3.0-or-later',
  'engine': 'MIT',
  'database': 'AGPL-3.0-or-later',
  'api-server': 'Apache-2.0',
  'mcp-server': 'MIT',
  'portal': 'MIT',
  'docs': 'Apache-2.0',
  'sdk': 'MIT',
  'sdk-python': 'MIT',
  'legal-core': 'MIT',
  'legislation': 'MIT',
};

/**
 * Check license compliance for a request context
 */
export function checkLicense(
  ctx: RouteContext,
  packageName: string = 'pipeline-core'
): LicenseCheckResult {
  const license = PACKAGE_LICENSES[packageName] || 'unknown';
  const tenantTier = ctx.tenant?.tier || 'free';

  // Log the compliance check
  logComplianceEvent('api_access', {
    package: packageName,
    license,
    source: ctx.tenant?.id || 'anonymous',
  });

  // Check if the tenant's use case is compliant
  const useCase = determineUseCase(tenantTier);
  const result = checkLicenseCompliance(license, useCase);

  return {
    compliant: result.compliant,
    license,
    reason: result.reason,
  };
}

/**
 * Determine use case from tenant tier
 */
function determineUseCase(tier: string): 'internal' | 'proprietary' | 'commercial' {
  switch (tier) {
    case 'free':
      return 'internal';
    case 'pro':
      return 'internal';
    case 'business':
      return 'commercial';
    case 'enterprise':
      return 'commercial';
    default:
      return 'internal';
  }
}

/**
 * Middleware wrapper for license compliance
 */
export function withLicenseCheck(
  ctx: RouteContext,
  packageName: string = 'pipeline-core'
): { allowed: boolean; error?: Response } {
  const result = checkLicense(ctx, packageName);

  if (!result.compliant) {
    return {
      allowed: false,
      error: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'LICENSE_VIOLATION',
            message: result.reason || 'License compliance violation detected',
            license: result.license,
          },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  return { allowed: true };
}

/**
 * Get all package licenses for status endpoint
 */
export function getAllPackageLicenses(): Record<string, string> {
  return { ...PACKAGE_LICENSES };
}