/**
 * LODE Geospatial ingestion module
 *
 * Canadian geospatial data sources:
 * - BC LODE (land ownership)
 * - GeoMet (weather geo data)
 *
 * @module @civint/pipeline-core/ingestion/geospatial
 */

export { discoverLayers, fetchFeatures, fetchLODEData } from './fetcher.js';
export { LODE_SOURCES, WFS_VERSION, WMS_VERSION } from './constants.js';
export type { LodeSourceKey } from './constants.js';
export type {
  GeoPoint,
  BoundingBox,
  GeoFeature,
  GeoLayer,
  LODEResult,
} from './types.js';
