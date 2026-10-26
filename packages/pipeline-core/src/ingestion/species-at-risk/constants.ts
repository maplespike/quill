/**
 * Species at Risk Registry Constants — Quill
 *
 * SARA API URLs, status code mappings, DDL, and defaults for
 * ingesting Canada's Species at Risk registry data.
 *
 * Primary source:
 *   https://species-registry.canada.ca/index-en.html (JSON API)
 *   https://species-registry.canada.ca/registre-especes/api/v1/
 */

import type { SpeciesStatus } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const SARA_SOURCES = {
  /** Main species registry portal */
  PORTAL: 'https://species-registry.canada.ca/index-en.html',

  /** JSON API base URL */
  API_BASE: 'https://species-registry.canada.ca/registre-especes/api/v1',

  /** Species endpoints */
  API: {
    /** List all species */
    SPECIES: 'https://species-registry.canada.ca/registre-especes/api/v1/species',
    /** Single species detail */
    SPECIES_DETAIL: 'https://species-registry.canada.ca/registre-especes/api/v1/species',
    /** Recovery strategies */
    RECOVERY_STRATEGIES: 'https://species-registry.canada.ca/registre-especes/api/v1/recoveryStrategies',
    /** Listing decisions */
    LISTING_DECISIONS: 'https://species-registry.canada.ca/registre-especes/api/v1/listingDecisions',
    /** Critical habitat */
    CRITICAL_HABITAT: 'https://species-registry.canada.ca/registre-especes/api/v1/criticalHabitat',
  },

  /** Maximum results per API page */
  PAGE_SIZE: 100,
} as const;

/* ------------------------------------------------------------------ */
/*  Status Code Mappings                                               */
/* ------------------------------------------------------------------ */

/**
 * Maps raw status text from SARA API responses to normalized SpeciesStatus values.
 */
export const SARA_STATUS_MAP: Record<string, SpeciesStatus> = {
  'extirpated': 'extirpated',
  'extirpated (extirpated)': 'extirpated',
  'endangered': 'endangered',
  'endangered (endangered)': 'endangered',
  'threatened': 'threatened',
  'threatened (threatened)': 'threatened',
  'special concern': 'special_concern',
  'special_concern': 'special_concern',
  'not at risk': 'not_at_risk',
  'not_at_risk': 'not_at_risk',
  'data deficient': 'data_deficient',
  'data_deficient': 'data_deficient',
};

/* ------------------------------------------------------------------ */
/*  Taxonomic Groups                                                   */
/* ------------------------------------------------------------------ */

export const SARA_TAXONOMIC_GROUPS = [
  'Amphibians',
  'Birds',
  'Fishes',
  'Arthropods',
  'Molluscs',
  'Mammals',
  'Reptiles',
  'Vascular Plants',
  'Mosses',
  'Lichens',
  'Fungi',
] as const;

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const SARA_SPECIES_DDL = `
-- Species at Risk — SARA registry listing decisions and recovery strategies
CREATE TABLE IF NOT EXISTS species_at_risk_records (
  id TEXT PRIMARY KEY,

  -- Species identity
  species_name TEXT NOT NULL,
  scientific_name TEXT,
  taxonomic_group TEXT,
  sara_species_id TEXT,

  -- Assessment & listing
  status TEXT NOT NULL CHECK(status IN (
    'extirpated',
    'endangered',
    'threatened',
    'special_concern',
    'not_at_risk',
    'data_deficient'
  )),
  assessment_date TEXT,
  listing_date TEXT,

  -- Recovery
  recovery_strategy_url TEXT,
  critical_habitat INTEGER,

  -- Geography
  province_territory TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'sara-api',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(species_name, status, source_url)
);

CREATE INDEX IF NOT EXISTS idx_sara_species_name ON species_at_risk_records(species_name);
CREATE INDEX IF NOT EXISTS idx_sara_scientific_name ON species_at_risk_records(scientific_name);
CREATE INDEX IF NOT EXISTS idx_sara_status ON species_at_risk_records(status);
CREATE INDEX IF NOT EXISTS idx_sara_taxonomic_group ON species_at_risk_records(taxonomic_group);
CREATE INDEX IF NOT EXISTS idx_sara_province ON species_at_risk_records(province_territory);
CREATE INDEX IF NOT EXISTS idx_sara_assessment_date ON species_at_risk_records(assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_sara_listing_date ON species_at_risk_records(listing_date DESC);
CREATE INDEX IF NOT EXISTS idx_sara_status_group ON species_at_risk_records(status, taxonomic_group);
CREATE INDEX IF NOT EXISTS idx_sara_ingested ON species_at_risk_records(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 1000;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json',
};

/* ------------------------------------------------------------------ */
/*  Error Type                                                         */
/* ------------------------------------------------------------------ */

export class SaraError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'SARA_ERROR',
    public readonly species?: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'SaraError';
  }
}
