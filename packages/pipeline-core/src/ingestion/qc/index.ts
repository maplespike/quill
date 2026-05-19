/**
 * Quebec Provincial Data Ingestion — MapleSpike Pipeline
 *
 * Ingests datasets from Donnees Quebec (www.donneesquebec.ca)
 * across multiple sectors including health (sante), education, environment,
 * energy, agriculture, transport, and more.
 *
 * Pipeline:
 *   1. Fetch datasets from QC CKAN API by sector
 *   2. Normalize and enrich with metadata
 *   3. Return structured QCDataset records with SHA-256 citations
 *
 * Designed for cron-based ingestion and ad-hoc queries.
 */

import { fetchAllQCDeep, fetchQCDatasets, searchQCDatasets } from './fetcher.js';
import type { QCDataset, QCIngestionResult } from './types.js';

export async function ingestQC(): Promise<QCIngestionResult> {
  return fetchAllQCDeep();
}

export async function ingestAllQCDeep(): Promise<QCIngestionResult> {
  return fetchAllQCDeep();
}

export async function searchQC(query: string, options?: { limit?: number }): Promise<QCDataset[]> {
  return searchQCDatasets(query, options);
}

export { fetchQCDatasets } from './fetcher.js';
export type { QCDataset, QCIngestionResult };
