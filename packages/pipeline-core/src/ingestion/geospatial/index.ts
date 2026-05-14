/**
 * Geospatial Data Ingestion — MapleSpike Pipeline
 *
 * Fetches geospatial datasets from open.canada.ca CKAN across
 * 18 query categories: addresses, buildings, boundaries, land
 * parcels, transportation, water features, topography, and more.
 */

import { ingestAllGeospatial } from './fetcher.js';
import type { GeospatialRecord, GeospatialIngestionResult } from './types.js';

export { ingestAllGeospatial };
export type { GeospatialRecord, GeospatialIngestionResult };
