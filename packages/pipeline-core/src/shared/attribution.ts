// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Data Source Attribution Metadata
 *
 * Tracks provenance and attribution requirements for data sources.
 * All data records should include attribution metadata.
 */

export interface AttributionMetadata {
  source: string;
  sourceUrl?: string;
  license?: string;
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

/**
 * Build attribution metadata for a data source
 */
export function buildAttribution(
  source: string,
  options: {
    sourceUrl?: string;
    license?: string;
    attributionText?: string;
    retrievedAt?: Date;
    version?: string;
    methodology?: string;
  } = {}
): AttributionMetadata {
  const now = options.retrievedAt || new Date();

  return {
    source,
    sourceUrl: options.sourceUrl,
    license: options.license,
    attributionText: options.attributionText || `Source: ${source}`,
    retrievedAt: now,
    version: options.version,
    methodology: options.methodology,
  };
}

/**
 * Wrap data with attribution metadata
 */
export function withAttribution<T>(
  data: T,
  attribution: AttributionMetadata
): AttributedRecord {
  return { data, attribution };
}

/**
 * Check if attribution is valid
 */
export function isValidAttribution(attribution: AttributionMetadata): boolean {
  return (
    attribution.source !== '' &&
    attribution.attributionText !== '' &&
    attribution.retrievedAt instanceof Date &&
    !isNaN(attribution.retrievedAt.getTime())
  );
}

/**
 * Format attribution for display
 */
export function formatAttribution(attribution: AttributionMetadata): string {
  const parts: string[] = [attribution.attributionText];

  if (attribution.sourceUrl) {
    parts.push(`(${attribution.sourceUrl})`);
  }

  if (attribution.license && attribution.license !== 'public domain') {
    parts.push(`License: ${attribution.license}`);
  }

  return parts.join(' ');
}