/**
 * LODE Geospatial — Type definitions
 *
 * Types for BC Land Ownership Data Exchange (LODE) and
 * GeoMet Weather Canada WFS/WMS geospatial data ingestion.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GeoFeature {
  id: string;
  type: string;
  geometry: { type: string; coordinates: number[][] };
  properties: Record<string, any>;
  bbox?: BoundingBox;
}

export interface GeoLayer {
  name: string;
  title: string;
  crs: string;
  features: number;
  bbox: BoundingBox;
}

export interface LODEResult {
  features: GeoFeature[];
  layers: GeoLayer[];
  errors: string[];
  durationMs: number;
}
