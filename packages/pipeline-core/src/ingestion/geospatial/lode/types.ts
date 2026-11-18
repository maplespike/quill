// SPDX-License-Identifier: AGPL-3.0-only
/**
 * LODE Data Types — Quill
 *
 * Type definitions for all 12 LODE (Linkable Open Data Environment) databases.
 */

export interface LodeAddress {
  id: string;
  civicNumber: string | null;
  streetName: string | null;
  streetType: string | null;
  municipality: string | null;
  provinceCode: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  fullAddress: string | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface LodeBuilding {
  id: string;
  buildingId: string | null;
  name: string | null;
  address: string | null;
  municipality: string | null;
  provinceCode: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  buildingType: string | null;
  floors: number | null;
  yearBuilt: number | null;
  footprintAreaM2: number | null;
  sourceDataset: string | null;
  primaryUse: string | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface LodeHealthcareFacility {
  id: string;
  name: string;
  facilityType: 'ambulatory_health_care_services' | 'hospital' | 'nursing_residential_care';
  address: string | null;
  municipality: string | null;
  provinceCode: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  languageOfService: string | null;
  dataSource: string | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface LodeRecreationalFacility {
  id: string;
  name: string;
  facilityType: string;
  address: string | null;
  municipality: string | null;
  provinceCode: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  indoorOutdoor: 'indoor' | 'outdoor' | null;
  iceSurface: boolean | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface LodeEducationalFacility {
  id: string;
  name: string;
  institutionType: string | null;
  address: string | null;
  municipality: string | null;
  provinceCode: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  languageOfInstruction: string | null;
  gradeRange: string | null;
  schoolAuthority: string | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface LodeCulturalFacility {
  id: string;
  name: string;
  facilityType: string | null;
  address: string | null;
  municipality: string | null;
  provinceCode: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface LodeBusiness {
  id: string;
  name: string;
  naicsCode: string | null;
  naicsDescription: string | null;
  address: string | null;
  municipality: string | null;
  provinceCode: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  employmentSize: string | null;
  revenueRange: string | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface LodeInfrastructure {
  id: string;
  name: string | null;
  infraType: string;
  subType: string | null;
  location: string | null;
  municipality: string | null;
  provinceCode: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string | null;
  yearBuilt: number | null;
  capacity: string | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface LodeGreenhouse {
  id: string;
  polygonId: string | null;
  areaM2: number | null;
  location: string | null;
  municipality: string | null;
  provinceCode: string | null;
  latitude: number | null;
  longitude: number | null;
  detectionMethod: 'manual' | 'machine_learning' | null;
  version: string | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface LodePedestrianNetwork {
  id: string;
  segmentId: string | null;
  pedestrianType: string;
  surfaceMaterial: string | null;
  widthM: number | null;
  lengthM: number | null;
  municipality: string | null;
  provinceCode: string | null;
  sourceMunicipality: string | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface LodeTransitStop {
  id: string;
  stopId: string | null;
  stopName: string | null;
  stopType: string | null;
  latitude: number | null;
  longitude: number | null;
  municipality: string | null;
  provinceCode: string | null;
  agencyName: string | null;
  routesServed: string | null;
  wheelchairAccessible: boolean | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface LodeTransitRoute {
  id: string;
  routeId: string | null;
  routeName: string | null;
  routeType: string | null;
  agencyName: string | null;
  municipality: string | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface LodeCyclingNetwork {
  id: string;
  segmentId: string | null;
  canBicsClassification: string | null;
  lengthM: number | null;
  widthM: number | null;
  surfaceType: string | null;
  municipality: string | null;
  provinceCode: string | null;
  sourceMunicipality: string | null;
  protected: boolean | null;
  hash: string;
  sourceUrl: string;
  ingestedAt: string;
}

export type LodeRecord =
  | LodeAddress
  | LodeBuilding
  | LodeHealthcareFacility
  | LodeRecreationalFacility
  | LodeEducationalFacility
  | LodeCulturalFacility
  | LodeBusiness
  | LodeInfrastructure
  | LodeGreenhouse
  | LodePedestrianNetwork
  | LodeTransitStop
  | LodeCyclingNetwork;

export interface LodeIngestionResult {
  source: string;
  databaseId: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}

export interface LodeSearchParams {
  databaseId?: string;
  query?: string;
  province?: string;
  municipality?: string;
  facilityType?: string;
  limit?: number;
  offset?: number;
}

export interface LodeSearchResult {
  database: string;
  databaseId: string;
  records: LodeRecord[];
  total: number;
  durationMs: number;
}
