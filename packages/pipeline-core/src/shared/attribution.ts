// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Data Source Attribution Metadata
 *
 * Carries source and publisher-provided terms through Quill. This module does
 * not infer rights from a source's jurisdiction, portal, or public availability.
 */

export const NO_REUSE_LICENSE_NOTICE =
  "The publisher license was not declared in the metadata returned to Quill. Quill does not grant rights in source material; consult the publisher's terms.";

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
    return {
      license: basis === 'no-publisher-declaration' ? NO_REUSE_LICENSE_NOTICE : nestedLicense,
      ...(existingUrl ? { licenseUrl: existingUrl } : {}),
      attributionText: nestedAttributionText ?? (basis === 'no-publisher-declaration' ? NO_REUSE_LICENSE_NOTICE : nestedLicense),
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
    return {
      license: nestedLicense,
      ...(existingUrl ? { licenseUrl: existingUrl } : {}),
      attributionText: nestedAttributionText ?? nestedLicense,
      basis: nestedBasis === 'publisher-metadata' ? 'publisher-metadata' : 'source-configuration',
    };
  }
  const effectiveAttribution = existingAttribution ?? nestedAttributionText;

  // Preserve normalized metadata when a response passes through more than
  // one search/cache layer; do not repeatedly prefix its publisher label.
  if (existingBasis === 'publisher-metadata' && existingLicense) {
    return {
      license: existingLicense,
      ...(existingUrl ? { licenseUrl: existingUrl } : {}),
      attributionText: effectiveAttribution ?? existingLicense,
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

  return {
    license: `Publisher-declared: ${effectiveLabel}`,
    ...(licenseUrl ? { licenseUrl } : {}),
    attributionText: publisherAttribution
      ?? `Publisher-declared license: ${effectiveLabel}${licenseUrl ? ` (${licenseUrl})` : ''}. Follow the publisher's attribution and exclusions.`,
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
