// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Species at Risk Registry Types — Quill
 *
 * Strongly-typed interfaces for Canada's Species at Risk Act (SARA) registry.
 * Tracks federal listing decisions, recovery strategies, and critical habitat
 * identifications for species at risk across Canada.
 *
 * Primary source:
 *   https://species-registry.canada.ca/index-en.html (JSON API)
 *   https://species-registry.canada.ca/registre-especes/api/v1/
 *
 * Cross-reference opportunities:
 *   - Geospatial: critical habitat mapping
 *   - NPRI: pollutant releases in species habitat areas
 *   - Impact Assessment: federal project assessments affecting species
 *   - Provincial: provincial species-at-risk programs
 */

/* ------------------------------------------------------------------ */
/*  Status Types                                                       */
/* ------------------------------------------------------------------ */

/**
 * SARA assessment status — the risk category assigned by COSEWIC.
 */
export type SpeciesStatus =
  | 'extirpated'        // No longer exists in the wild in Canada
  | 'endangered'        // Facing imminent extirpation or extinction
  | 'threatened'        // Likely to become endangered if limiting factors not reversed
  | 'special_concern'   // May become threatened or endangered because of a combination of characteristics
  | 'not_at_risk'       // Assessed and found not at risk
  | 'data_deficient';   // Insufficient information to assess status

/* ------------------------------------------------------------------ */
/*  Core Record Type                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single Species at Risk record — a listing decision or recovery strategy.
 */
export interface SpeciesAtRiskRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Common English/French name of the species */
  speciesName: string;

  /** Scientific (binomial) name */
  scientificName: string | null;

  /** Taxonomic group (e.g. Mammals, Birds, Reptiles, Fish, Vascular Plants) */
  taxonomicGroup: string | null;

  /** COSEWIC assessment status */
  status: SpeciesStatus;

  /** Date of COSEWIC assessment (ISO-8601) */
  assessmentDate: string | null;

  /** Date added to Schedule 1 of SARA (ISO-8601) */
  listingDate: string | null;

  /** URL to the recovery strategy document */
  recoveryStrategyUrl: string | null;

  /** Whether critical habitat has been identified (true/false/partial) */
  criticalHabitat: boolean | null;

  /** Province or territory where the species is found */
  provinceTerritory: string | null;

  /** SARA API species ID */
  saraSpeciesId: string | null;

  /** Source URL */
  sourceUrl: string;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Raw Fetch Types                                                    */
/* ------------------------------------------------------------------ */

/** Shape of a raw SARA API species response. */
export interface RawSaraSpecies {
  id: string;
  commonNameEnglish?: string;
  commonNameFrench?: string;
  scientificName?: string;
  taxonomicGroup?: string;
  status?: string;
  assessmentDate?: string;
  listingDate?: string;
  recoveryStrategyUrl?: string;
  criticalHabitatIdentified?: boolean | string;
  provinceTerritory?: string;
  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/** Shape of the SARA API list response. */
export interface SaraApiResponse {
  data: RawSaraSpecies[];
  total?: number;
  page?: number;
  pageSize?: number;
  links?: {
    self?: string;
    next?: string;
    prev?: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface SaraIngestionOptions {
  /** Taxonomic groups to fetch (default: all) */
  taxonomicGroups?: string[];
  /** Status filter */
  status?: SpeciesStatus;
  /** Max records to process */
  maxRecords?: number;
  /** Force re-ingest of already-ingested records */
  force?: boolean;
  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;
  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface SaraIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perStatus: Record<string, {
    recordsFound: number;
    recordsIngested: number;
  }>;
  durationMs: number;
}
