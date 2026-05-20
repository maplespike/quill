
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Legal Compliance Automation for MapleSpike
 *
 * Automatically ensures:
 * - License compliance across all packages
 * - Attribution notices in API responses
 * - Data source tracking
 * - Audit trail for modifications
 */

interface DataRecord {
  citation_hash: string;
  source_url: string;
  license: string;
  attribution_text?: string;
}

interface ComplianceContext {
  package?: string;
  license?: string;
  source?: string;
  modified?: boolean;
}

/**
 * Standard OGL-CA attribution text
 */
export const OGL_ATTRIBUTION = "Source: Open Government Licence - Canada. " +
  "Original data from open.canada.ca. " +
  "Contains modified data from MapleSpike pipeline-core under AGPL-3.0.";

/**
 * Add attribution to API response record
 */
export function addAttribution(record: DataRecord): DataRecord {
  return {
    ...record,
    attribution_text: `${OGL_ATTRIBUTION} Citation: sha256:${record.citation_hash}`
  };
}

/**
 * Check if package license allows given use
 */
export function checkLicenseCompliance(
  packageLicense: string,
  intendedUse: "internal" | "proprietary" | "commercial"
): { compliant: boolean; reason?: string } {
  const AGPL_LICENSES = ["AGPL-3.0", "AGPL-3.0-or-later"];

  switch (intendedUse) {
    case "internal":
      return { compliant: true };
    case "proprietary":
      if (AGPL_LICENSES.some(lic => packageLicense.includes(lic))) {
        return {
          compliant: false,
          reason: "AGPL-3.0 requires source disclosure for network use. " +
                  "Purchase commercial license or use MIT/Apache packages."
        };
      }
      return { compliant: true };
    case "commercial":
      // Commercial use requires explicit license verification
      // AGPL packages require commercial license purchase
      if (AGPL_LICENSES.some(lic => packageLicense.includes(lic))) {
        return {
          compliant: false,
          reason: "AGPL-3.0 requires commercial license purchase for proprietary use. " +
                  "Contact MapleSpike for commercial licensing options."
        };
      }
      return { compliant: true };
    default:
      return { compliant: false, reason: "Unknown use case" };
  }
}

/**
 * Generate audit trail entry
 */
export function logComplianceEvent(
  action: "data_fetch" | "data_modify" | "code_change" | "api_access",
  context: ComplianceContext
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    license: context.license || "unknown",
    package: context.package || "unknown",
    source: context.source || "unknown",
    modified: context.modified || false
  };

  // Write to compliance log - use structured logging for production
  // In production, this should write to a persistent audit store
  console.log(JSON.stringify({ level: "info", type: "compliance", ...entry }));
}

/**
 * Verify all attribution fields present
 */
export function verifyAttribution(records: DataRecord[]): {
  valid: number;
  missing: number;
  rate: number;
} {
  const total = records.length;
  const missing = records.filter(r => !r.attribution_text).length;
  const valid = total - missing;

  return {
    valid,
    missing,
    rate: total > 0 ? valid / total : 0
  };
}
||||||| e980c07
 origin/main
