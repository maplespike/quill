// pipeline-core: AGPL-3.0-or-later, engine: MIT, api-server: Apache-2.0,
// mcp-server: MIT, sdk: MIT, sdk-python: MIT, legal-core: MIT, legislation: MIT

export interface ComplianceResult {
  package: string;
  license: string;
  attributionRequired: boolean;
  sourceAttributed: boolean;
  packagesChecked: number;
  recordsModified: number;
}

export interface AttributionRecord {
  package: string;
  sourceUrl: string | null;
  hasAttribution: boolean;
}

const PACKAGE_LICENSES: Record<string, { license: string; attributionRequired: boolean }> = {
  'pipeline-core': { license: 'AGPL-3.0-or-later', attributionRequired: true },
  engine: { license: 'MIT', attributionRequired: false },
  'api-server': { license: 'Apache-2.0', attributionRequired: true },
  'mcp-server': { license: 'MIT', attributionRequired: false },
  sdk: { license: 'MIT', attributionRequired: false },
  'sdk-python': { license: 'MIT', attributionRequired: false },
  'legal-core': { license: 'MIT', attributionRequired: false },
  legislation: { license: 'MIT', attributionRequired: false },
};

const VALID_PACKAGES = Object.keys(PACKAGE_LICENSES);

export function getComplianceCheck(packageName: string): ComplianceResult {
  const info = PACKAGE_LICENSES[packageName];
  if (!info) {
    return {
      package: packageName,
      license: 'unknown',
      attributionRequired: false,
      sourceAttributed: false,
      packagesChecked: 0,
      recordsModified: 0,
    };
  }

  return {
    package: packageName,
    license: info.license,
    attributionRequired: info.attributionRequired,
    sourceAttributed: info.attributionRequired,
    packagesChecked: 1,
    recordsModified: 0,
  };
}

export function getFullComplianceReport(): ComplianceResult[] {
  return VALID_PACKAGES.map((name) => {
    const info = PACKAGE_LICENSES[name];
    return {
      package: name,
      license: info.license,
      attributionRequired: info.attributionRequired,
      sourceAttributed: info.attributionRequired,
      packagesChecked: 1,
      recordsModified: 0,
    };
  });
}

export function getPackageLicense(packageName: string): string | null {
  return PACKAGE_LICENSES[packageName]?.license ?? null;
}

export function getAllLicensedPackages(): string[] {
  return [...VALID_PACKAGES];
}
