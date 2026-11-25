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

/**
 * Software licence for Quill's own code.
 *
 * The rights holder chose AGPL-3.0-only on 2026-10-24 (issue #1044).
 * LICENSE.md is the grant. This report is not a data-source licence.
 */
export const QUILL_SOFTWARE_LICENSE = 'AGPL-3.0-only';

// Reviewed first-party workspaces. Each one declares QUILL_SOFTWARE_LICENSE.
// attributionRequired and sourceAttributed stay null: this report states the
// software licence. It does not judge publisher attribution for source data.
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
  const reviewed = REVIEWED_PACKAGES.includes(packageName);
  return {
    package: packageName,
    license: reviewed ? QUILL_SOFTWARE_LICENSE : 'Not a reviewed Quill workspace package.',
    attributionRequired: null,
    sourceAttributed: null,
    packagesChecked: reviewed ? 1 : 0,
    recordsModified: 0,
  };
}

export function getFullComplianceReport(): ComplianceResult[] {
  return REVIEWED_PACKAGES.map((name) => getComplianceCheck(name));
}

export function getPackageLicense(packageName: string): string | null {
  return REVIEWED_PACKAGES.includes(packageName) ? QUILL_SOFTWARE_LICENSE : null;
}

export function getAllLicensedPackages(): string[] {
  // First-party workspaces covered by the 2026-10-24 AGPL-3.0-only decision.
  return [...REVIEWED_PACKAGES];
}
