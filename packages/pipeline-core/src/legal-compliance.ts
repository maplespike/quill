// SPDX-License-Identifier: AGPL-3.0-only
import { ConsoleAuditLogger } from './audit/logger.js';
import type { AuditEntry, AuditLogger } from './audit/logger.js';

const AUDIT_LOGGER: AuditLogger = new ConsoleAuditLogger();

export interface ComplianceResult {
  package: string;
  license: string;
  attributionRequired: boolean | null;
  sourceAttributed: boolean | null;
  packagesChecked: number;
  recordsModified: number;
}

export interface AttributionRecord {
  package: string;
  sourceUrl: string | null;
  hasAttribution: boolean;
}

export interface ComplianceAuditEntry {
  package: string;
  action: string;
  license: string;
  source: string;
  success: boolean;
  detail?: string;
}

const DECLARATION_UNRESOLVED = 'License declarations conflict; rights-holder review required.';

// This endpoint previously presented a hand-written package map as a resolved
// compliance result. Repository metadata and file-level notices conflict, so
// do not convert those observations into a license or attribution conclusion.
const REVIEWED_PACKAGES = [
  'pipeline-core',
  'engine',
  'api-server',
  'quill-mcp',
  'sdk',
  'sdk-python',
  'legal-core',
  'legislation',
];

export async function logComplianceEvent(entry: ComplianceAuditEntry): Promise<void> {
  const auditEntry: Omit<AuditEntry, 'timestamp'> = {
    operation: 'ingestion',
    model: 'none',
    inputPreview: `${entry.action} on ${entry.package}`,
    outputSummary: entry.detail || `${entry.action} - ${entry.success ? 'OK' : 'FAIL'}`,
    confidence: null,
    success: entry.success,
    durationMs: 0,
  };
  await AUDIT_LOGGER.log(auditEntry);
}

export function getComplianceCheck(packageName: string): ComplianceResult {
  return {
    package: packageName,
    license: DECLARATION_UNRESOLVED,
    attributionRequired: null,
    sourceAttributed: null,
    packagesChecked: REVIEWED_PACKAGES.includes(packageName) ? 1 : 0,
    recordsModified: 0,
  };
}

export function getFullComplianceReport(): ComplianceResult[] {
  return REVIEWED_PACKAGES.map((name) => getComplianceCheck(name));
}

export function getPackageLicense(packageName: string): string | null {
  return REVIEWED_PACKAGES.includes(packageName) ? DECLARATION_UNRESOLVED : null;
}

export function getAllLicensedPackages(): string[] {
  // Legacy API name retained for compatibility; entries are under review, not
  // affirmatively licensed or cleared by this package.
  return [...REVIEWED_PACKAGES];
}
