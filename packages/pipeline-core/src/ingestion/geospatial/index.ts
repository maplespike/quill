/**
 * Geospatial Data Ingestion — Quill
 *
 * Fetches geospatial datasets from open.canada.ca CKAN across
 * 18 query categories. Also includes all 12 LODE (Linkable Open
 * Data Environment) StatCan databases for authoritative geospatial data.
 */

import { ingestAllGeospatial } from './fetcher.js';
import type { GeospatialRecord, GeospatialIngestionResult } from './types.js';

export { ingestAllGeospatial };
export type { GeospatialRecord, GeospatialIngestionResult };

// LODE (Linkable Open Data Environment) — 12 StatCan geospatial databases
export {
  ingestLodeDatabaseById,
  ingestAllLode,
  searchLode,
  listLodeDatabases,
  getLodeDatabaseInfo,
  LODE_DATABASES,
  LODE_SOURCE_NAMES,
} from './lode/index.js';
export { parseGeospatialRecord, parseGeospatialRecords, normalizeDate, parseNumeric } from './parser.js';
export type {
  LodeDatabaseInfo,
  LodeAddress,
  LodeBuilding,
  LodeHealthcareFacility,
  LodeRecreationalFacility,
  LodeEducationalFacility,
  LodeCulturalFacility,
  LodeBusiness,
  LodeInfrastructure,
  LodeGreenhouse,
  LodePedestrianNetwork,
  LodeTransitStop,
  LodeTransitRoute,
  LodeCyclingNetwork,
  LodeRecord,
  LodeIngestionResult,
  LodeSearchParams,
  LodeSearchResult,
} from './lode/index.js';
