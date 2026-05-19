/**
 * British Columbia Provincial Data Ingestion — MapleSpike Pipeline
 *
 * Ingests datasets from the BC Open Data Catalogue (catalogue.data.gov.bc.ca)
 * across multiple sectors including health, education, environment, energy,
 * forestry, mining, and more.
 *
 * Pipeline:
 *   1. Fetch datasets from BC CKAN API by sector
 *   2. Normalize and enrich with metadata
 *   3. Return structured BCDataset records with SHA-256 citations
 *
 * Designed for cron-based ingestion and ad-hoc queries.
 */

import { fetchAllBCDeep, fetchBCDatasets, searchBCDatasets } from './fetcher.js';
import type { BCDataset, BCIngestionResult } from './types.js';

export async function ingestBC(): Promise<BCIngestionResult> {
  return fetchAllBCDeep();
}

export async function ingestAllBCDeep(): Promise<BCIngestionResult> {
  return fetchAllBCDeep();
}

export async function searchBC(query: string, options?: { limit?: number }): Promise<BCDataset[]> {
  return searchBCDatasets(query, options);
}

export { fetchBCDatasets } from './fetcher.js';
export type { BCDataset, BCIngestionResult };
