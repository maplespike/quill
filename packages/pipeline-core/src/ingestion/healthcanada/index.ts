/**
 * Health Canada Ingestion — MapleSpike Pipeline
 *
 * Index file for all Health Canada ingestion modules.
 *
 * Provides unified entry points for:
 * - Drug Approvals (weekly updates)
 * - Medical Devices (weekly updates)  
 * - Food Recalls (daily updates)
 * - Pharmacovigilance (monthly updates)
 * - Pesticide Registrations (monthly updates)
 * - Cannabis Licences (monthly updates)
 * - Controlled Substances (quarterly updates)
 */

import { 
  parseDrugApproval,
  parseMedicalDevice,
  parseFoodRecall,
  parseAdverseReaction,
  parsePesticideRegistration,
  parseCannabisLicence,
  parseControlledSubstance,
} from './parser.js';
import { fetchHealthCanadaDataset } from './fetcher.js';
import { DATASET_INFO } from './constants.js';
import type {
  DrugApproval,
  MedicalDevice,
  FoodRecall,
  AdverseReaction,
  PesticideRegistration,
  CannabisLicence,
  ControlledSubstance,
  HealthCanadaRecord,
} from './types.js';

// Generic ingestion result type
interface IngestionResult<T> {
  totalFetched: number;
  totalIngested: number;
  errors: string[];
  durationMs: number;
  records: T[];
}

/**
 * Generic ingestor for Health Canada datasets.
 * Handles fetch → parse → citate → persist pipeline.
 */
async function ingestHealthCanadaDataset<T extends HealthCanadaRecord>(
  datasetKey: keyof typeof DATASET_INFO,
  parser: (raw: string, source: string) => T[],
  options: { limit?: number } = {},
): Promise<IngestionResult<T>> {
  const startTime = Date.now();
  const result: IngestionResult<T> = {
    totalFetched: 0,
    totalIngested: 0,
    errors: [],
    durationMs: 0,
    records: [],
  };

  const info = DATASET_INFO[datasetKey];
  const source = 'health-canada';

  try {
    // Fetch data
    const rawData = await fetchHealthCanadaDataset(datasetKey, options);
    
    // Parse records
    const parsedRecords = parser(rawData, source);
    
    // Apply SHA-256 citations (simplified for now)
    const recordsWithCitations = parsedRecords.map(r => ({
      ...r,
      citationHash: crypto.randomUUID(), // TODO: compute actual SHA-256
      trustScore: info.trustThreshold || 0.6,
    }));

    result.totalFetched = parsedRecords.length;
    result.totalIngested = recordsWithCitations.length;
    result.records = recordsWithCitations;
    result.durationMs = Date.now() - startTime;

    console.log(`[${info.title}] Ingested ${result.totalIngested}/${result.totalFetched} records in ${result.durationMs}ms`);
  } catch (error) {
    const msg = (error as Error).message;
    result.errors.push(msg);
    console.error(`[${info.title}] ERROR: ${msg}`);
    result.durationMs = Date.now() - startTime;
  }

  return result;
}

/**
 * Ingest Health Canada drug approvals.
 * Update frequency: weekly
 */
export async function ingestDrugApprovals(
  options: { limit?: number } = {},
): Promise<IngestionResult<DrugApproval>> {
  return ingestHealthCanadaDataset('drugApprovals', parseDrugApproval, options);
}

/**
 * Ingest Health Canada medical devices.
 * Update frequency: weekly
 */
export async function ingestMedicalDevices(
  options: { limit?: number } = {},
): Promise<IngestionResult<MedicalDevice>> {
  return ingestHealthCanadaDataset('medicalDevices', parseMedicalDevice, options);
}

/**
 * Ingest Health Canada food recalls.
 * Update frequency: daily
 */
export async function ingestFoodRecalls(
  options: { limit?: number } = {},
): Promise<IngestionResult<FoodRecall>> {
  return ingestHealthCanadaDataset('foodRecalls', parseFoodRecall, options);
}

/**
 * Ingest Health Canada pharmacovigilance reports.
 * Update frequency: monthly
 */
export async function ingestAdverseReactions(
  options: { limit?: number } = {},
): Promise<IngestionResult<AdverseReaction>> {
  return ingestHealthCanadaDataset('adverseReactions', parseAdverseReaction, options);
}

/**
 * Ingest Health Canada pesticide registrations.
 * Update frequency: monthly
 */
export async function ingestPesticideRegistrations(
  options: { limit?: number } = {},
): Promise<IngestionResult<PesticideRegistration>> {
  return ingestHealthCanadaDataset('pesticideRegistrations', parsePesticideRegistration, options);
}

/**
 * Ingest Health Canada cannabis licences.
 * Update frequency: monthly
 */
export async function ingestCannabisLicences(
  options: { limit?: number } = {},
): Promise<IngestionResult<CannabisLicence>> {
  return ingestHealthCanadaDataset('cannabisLicences', parseCannabisLicence, options);
}

/**
 * Ingest Health Canada controlled substances.
 * Update frequency: quarterly
 */
export async function ingestControlledSubstances(
  options: { limit?: number } = {},
): Promise<IngestionResult<ControlledSubstance>> {
  return ingestHealthCanadaDataset('controlledSubstances', parseControlledSubstance, options);
}

/**
 * Batch ingest all Health Canada modules.
 */
export async function ingestAllHealthCanada(
  options: { limit?: number } = {},
): Promise<Record<string, IngestionResult<HealthCanadaRecord>>> {
  const results: Record<string, IngestionResult<HealthCanadaRecord>> = {};
  
  const ingestors = [
    { key: 'drugApprovals', fn: ingestDrugApprovals },
    { key: 'medicalDevices', fn: ingestMedicalDevices },
    { key: 'foodRecalls', fn: ingestFoodRecalls },
    { key: 'adverseReactions', fn: ingestAdverseReactions },
    { key: 'pesticideRegistrations', fn: ingestPesticideRegistrations },
    { key: 'cannabisLicences', fn: ingestCannabisLicences },
    { key: 'controlledSubstances', fn: ingestControlledSubstances },
  ];

  for (const { key, fn } of ingestors) {
    results[key] = await fn(options);
  }

  return results;
}