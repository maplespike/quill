// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Data Source Attribution Metadata
 *
 * Carries source and publisher-provided terms through Quill. This module does
 * not infer rights from a source's jurisdiction, portal, or public availability.
 */

export const NO_REUSE_LICENSE_NOTICE =
  "The publisher license was not declared in the metadata returned to Quill. Quill does not grant rights in source material; consult the publisher's terms.";

/**
 * Licences with a fixed, published attribution statement. When a publisher
 * declares one of these licences and supplies no attribution text of its own,
 * the licence's own required statement is the correct default. The statements
 * are the licences' wording, not a Quill grant. Matching is intentionally
 * narrow — anything that is not one of these exact licences falls through
 * unchanged.
 */
export const OGL_CANADA_LICENCE_URL = 'https://open.canada.ca/en/open-government-licence-canada';
export const OGL_CANADA_ATTRIBUTION_STATEMENT =
  'Contains information licensed under the Open Government Licence – Canada.';
export const LOBBYING_ODLA_LICENCE_URL =
  'https://lobbycanada.gc.ca/en/open-data/open-data-licence-agreement/';
export const LOBBYING_ODLA_ATTRIBUTION_STATEMENT =
  'Contains information licensed under the Open Data Licence Agreement — Office of the Commissioner of Lobbying.';

interface FixedLicenceAttribution {
  pattern: RegExp;
  statement: string;
  url: string;
}

const FIXED_LICENCE_ATTRIBUTIONS: FixedLicenceAttribution[] = [
  {
    pattern: /open government licence\s*[–—-]\s*canada\b/i,
    statement: OGL_CANADA_ATTRIBUTION_STATEMENT,
    url: OGL_CANADA_LICENCE_URL,
  },
  {
    pattern: /open data licence agreement\s*[–—-]\s*office of the commissioner of lobbying\b/i,
    statement: LOBBYING_ODLA_ATTRIBUTION_STATEMENT,
    url: LOBBYING_ODLA_LICENCE_URL,
  },
];

/**
 * Match a licence label a publisher already declared against licences with a
 * fixed, published attribution statement. Returns `undefined` for anything
 * else — no statement and no URL is ever invented for other licences.
 */
export function fixedLicenceAttributionFor(label: string): FixedLicenceAttribution | undefined {
  return FIXED_LICENCE_ATTRIBUTIONS.find((f) => f.pattern.test(label));
}

export type LicenseMetadataBasis =
  | 'publisher-metadata'
  | 'source-configuration'
  | 'no-publisher-declaration';

export interface PublisherLicenseMetadata {
  license: string;
  licenseUrl?: string;
  attributionText: string;
  basis: LicenseMetadataBasis;
}

/** Add normalized license metadata without changing the source record fields. */
export function withPublisherLicense<T extends Record<string, unknown>>(record: T): T & {
  license: string;
  license_basis: LicenseMetadataBasis;
  license_url?: string;
  attribution_text: string;
} {
  const terms = resolvePublisherLicense(record);
  return {
    ...record,
    license: terms.license,
    ...(terms.licenseUrl ? { license_url: terms.licenseUrl } : {}),
    license_basis: terms.basis,
    attribution_text: terms.attributionText,
  };
}

/**
 * Resolve license information on a dataset/catalog record. This is an
 * evidence-preserving adapter, not a legal determination: a publisher label
 * may not cover third-party material or every use of the dataset.
 */
export function resolvePublisherLicense(
  record: Record<string, unknown>,
): PublisherLicenseMetadata {
  const existingLicense = typeof record.license === 'string' ? record.license.trim() : '';
  const existingBasis = record.license_basis ?? record.licenseBasis;
  const existingAttribution = typeof record.attribution_text === 'string'
    ? record.attribution_text
    : typeof record.attributionText === 'string'
      ? record.attributionText
      : undefined;
  const nestedAttribution = record.attribution && typeof record.attribution === 'object'
    ? record.attribution as Record<string, unknown>
    : undefined;
  const existingUrl = firstString(record, ['license_url', 'licenseUrl', 'rights_url', 'rightsUrl'], true)
    ?? firstString(nestedAttribution ?? {}, ['licenseUrl', 'license_url'], true);
  const nestedLicense = typeof nestedAttribution?.license === 'string'
    ? nestedAttribution.license.trim()
    : '';
  const nestedBasis = nestedAttribution?.licenseBasis ?? nestedAttribution?.license_basis;
  const nestedAttributionText = typeof nestedAttribution?.attributionText === 'string'
    ? nestedAttribution.attributionText
    : typeof nestedAttribution?.attribution_text === 'string'
      ? nestedAttribution.attribution_text
      : undefined;
  const hasAttributionEnvelope = nestedAttribution !== undefined && (
    record.data !== undefined || nestedAttribution.retrievedAt !== undefined
  );

  // withAttribution() wraps data in a Quill-owned metadata envelope. Its
  // configured terms are evidence of Quill configuration, not publisher
  // metadata, unless the adapter explicitly marked them as publisher-supplied.
  if (!existingLicense && nestedLicense && hasAttributionEnvelope) {
    const basis: LicenseMetadataBasis = nestedBasis === 'publisher-metadata'
      ? 'publisher-metadata'
      : nestedBasis === 'no-publisher-declaration' || nestedLicense === NO_REUSE_LICENSE_NOTICE
        ? 'no-publisher-declaration'
        : 'source-configuration';
    const fixed = basis === 'publisher-metadata' ? fixedLicenceAttributionFor(nestedLicense) : undefined;
    const resolvedUrl = existingUrl ?? fixed?.url;
    return {
      license: basis === 'no-publisher-declaration' ? NO_REUSE_LICENSE_NOTICE : nestedLicense,
      ...(resolvedUrl ? { licenseUrl: resolvedUrl } : {}),
      attributionText: nestedAttributionText ?? fixed?.statement ?? (basis === 'no-publisher-declaration' ? NO_REUSE_LICENSE_NOTICE : nestedLicense),
      basis,
    };
  }
  if (!existingLicense && nestedBasis === 'no-publisher-declaration' && nestedLicense) {
    return {
      license: NO_REUSE_LICENSE_NOTICE,
      attributionText: nestedAttributionText ?? NO_REUSE_LICENSE_NOTICE,
      basis: 'no-publisher-declaration',
    };
  }
  if (!existingLicense && nestedLicense && nestedBasis !== 'no-publisher-declaration') {
    const basis: LicenseMetadataBasis = nestedBasis === 'publisher-metadata' ? 'publisher-metadata' : 'source-configuration';
    const fixed = basis === 'publisher-metadata' ? fixedLicenceAttributionFor(nestedLicense) : undefined;
    const resolvedUrl = existingUrl ?? fixed?.url;
    return {
      license: nestedLicense,
      ...(resolvedUrl ? { licenseUrl: resolvedUrl } : {}),
      attributionText: nestedAttributionText ?? fixed?.statement ?? nestedLicense,
      basis,
    };
  }
  const effectiveAttribution = existingAttribution ?? nestedAttributionText;

  // Preserve normalized metadata when a response passes through more than
  // one search/cache layer; do not repeatedly prefix its publisher label.
  if (existingBasis === 'publisher-metadata' && existingLicense) {
    const fixed = fixedLicenceAttributionFor(existingLicense);
    const resolvedUrl = existingUrl ?? fixed?.url;
    return {
      license: existingLicense,
      ...(resolvedUrl ? { licenseUrl: resolvedUrl } : {}),
      attributionText: effectiveAttribution ?? fixed?.statement ?? existingLicense,
      basis: 'publisher-metadata',
    };
  }
  if (existingBasis === 'source-configuration' && existingLicense) {
    return {
      license: existingLicense,
      ...(existingUrl ? { licenseUrl: existingUrl } : {}),
      attributionText: effectiveAttribution ?? 'License information supplied by Quill source configuration; confirm scope and conditions with the publisher.',
      basis: 'source-configuration',
    };
  }
  if (existingBasis === 'no-publisher-declaration' && existingLicense) {
    return {
      license: NO_REUSE_LICENSE_NOTICE,
      attributionText: effectiveAttribution ?? NO_REUSE_LICENSE_NOTICE,
      basis: 'no-publisher-declaration',
    };
  }

  const publisherAttribution = firstString(record, [
    'attribution_text', 'attributionText', 'attribution', 'required_attribution', 'copyright_notice',
  ]) ?? nestedAttributionText;
  const licenseUrl = firstString(record, [
    'license_url', 'licenseUrl', 'rights_url', 'rightsUrl', 'license',
  ], true) ?? existingUrl;
  const declaredLabel = firstString(record, [
    'license_title', 'licenseTitle', 'license_id', 'licenseId', 'rights', 'accessRights',
  ]) ?? (licenseUrl ? firstString(record, ['license']) : undefined);
  const label = declaredLabel && !/^https?:\/\//i.test(declaredLabel) ? declaredLabel : undefined;

  const effectiveLabel = label ?? (licenseUrl ? `terms at ${licenseUrl}` : undefined);
  if (!effectiveLabel) {
    return {
      license: NO_REUSE_LICENSE_NOTICE,
      attributionText: publisherAttribution
        ?? "The returned dataset metadata contains no publisher license declaration. Consult the publisher's terms.",
      basis: 'no-publisher-declaration',
    };
  }

  const fixed = fixedLicenceAttributionFor(effectiveLabel);
  const resolvedUrl = licenseUrl ?? fixed?.url;
  return {
    license: `Publisher-declared: ${effectiveLabel}`,
    ...(resolvedUrl ? { licenseUrl: resolvedUrl } : {}),
    attributionText: publisherAttribution
      ?? fixed?.statement
      ?? `Publisher-declared license: ${effectiveLabel}${resolvedUrl ? ` (${resolvedUrl})` : ''}. Follow the publisher's attribution and exclusions.`,
    basis: 'publisher-metadata',
  };
}

function firstString(
  record: Record<string, unknown>,
  keys: string[],
  urlOnly = false,
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      const text = value.trim();
      if (!urlOnly || /^https?:\/\//i.test(text)) return text;
    }
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      for (const nestedKey of urlOnly ? ['url', 'href'] : ['title', 'name', 'id']) {
        const nestedValue = nested[nestedKey];
        if (typeof nestedValue === 'string' && nestedValue.trim()) return nestedValue.trim();
      }
    }
  }
  return undefined;
}

export interface AttributionMetadata {
  source: string;
  sourceUrl?: string;
  license?: string;
  licenseUrl?: string;
  licenseBasis?: LicenseMetadataBasis;
  attributionText: string;
  retrievedAt: Date;
  version?: string;
  methodology?: string;
}

export interface AttributedRecord {
  data: unknown;
  attribution: AttributionMetadata;
}

export interface DataSourceInfo {
  name: string;
  url: string;
  license: string;
  attributionFormat: string;
  updateFrequency: string;
}

export function buildAttribution(
  source: string,
  options: {
    sourceUrl?: string;
    license?: string;
    licenseUrl?: string;
    licenseBasis?: LicenseMetadataBasis;
    attributionText?: string;
    retrievedAt?: Date;
    version?: string;
    methodology?: string;
  } = {},
): AttributionMetadata {
  return {
    source,
    sourceUrl: options.sourceUrl,
    license: options.license,
    licenseUrl: options.licenseUrl,
    licenseBasis: options.licenseBasis ?? (options.license ? 'source-configuration' : 'no-publisher-declaration'),
    attributionText: options.attributionText || `Source: ${source}`,
    retrievedAt: options.retrievedAt || new Date(),
    version: options.version,
    methodology: options.methodology,
  };
}

export function withAttribution<T>(data: T, attribution: AttributionMetadata): AttributedRecord {
  return { data, attribution };
}

export function isValidAttribution(attribution: AttributionMetadata): boolean {
  return (
    attribution.source !== '' &&
    attribution.attributionText !== '' &&
    attribution.retrievedAt instanceof Date &&
    !isNaN(attribution.retrievedAt.getTime())
  );
}

export function formatAttribution(attribution: AttributionMetadata): string {
  const parts: string[] = [attribution.attributionText];
  if (attribution.sourceUrl) parts.push(`(${attribution.sourceUrl})`);
  if (attribution.license && attribution.license !== 'public domain') {
    parts.push(`License: ${attribution.license}`);
  }
  if (attribution.licenseUrl) parts.push(`License terms: ${attribution.licenseUrl}`);
  return parts.join(' ');
}
