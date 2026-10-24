// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { FederalDataset } from './types.js';

/**
 * Create FederalDataset from CIHI filename
 */
export async function toFederalDatasetFromCihi(filename: string): Promise<FederalDataset> {
  const now = new Date().toISOString();
  return {
    agency: 'CIHI',
    dataset: filename,
    year: new Date().getFullYear(),
    title: `CIHI Wait Times: ${filename}`,
    url: `https://www.cihi.ca/sites/default/files/document/${filename}`,
    format: 'XLSX',
    description: 'CIHI hospital wait times and emergency department data',
    hash: await computeHash(`cihi-${filename}`, 'sha256'),
    ingestedAt: now,
  };
}

/**
 * Create FederalDataset from CKAN package
 */
export async function toFederalDatasetFromCkan(agency: string, pkg: any): Promise<FederalDataset | null> {
  if (!pkg || typeof pkg !== 'object') return null;

  const now = new Date().toISOString();
  const year = pkg.metadata_created?.substring(0, 4) ? parseInt(pkg.metadata_created.substring(0, 4)) : new Date().getFullYear();

  return {
    agency,
    dataset: pkg.title || pkg.name,
    year,
    title: pkg.title || '',
    url: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
    format: 'CKAN',
    description: (pkg.notes || '').substring(0, 200),
    hash: await computeHash(`fed-${pkg.id}`, 'sha256'),
    ingestedAt: now,
  };
}

/**
 * Parse CKAN search results into FederalDataset array
 */
export async function parseCkanSearchResults(agency: string, results: any[], maxRecords: number, currentCount: number): Promise<FederalDataset[]> {
  if (!Array.isArray(results)) return [];

  const datasets: FederalDataset[] = [];
  for (const pkg of results) {
    if (datasets.length + currentCount >= maxRecords) break;
    const dataset = await toFederalDatasetFromCkan(agency, pkg);
    if (dataset) datasets.push(dataset);
  }

  return datasets;
}