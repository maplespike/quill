// SPDX-License-Identifier: AGPL-3.0-only
/**
 * LODE (Linkable Open Data Environment) Constants — Quill
 *
 * All 12 LODE databases from Statistics Canada's Linkable Open Data Environment.
 * Each entry includes configured download URLs, source metadata, and field information; review terms for each dataset separately.
 *
 * Sources: https://www.statcan.gc.ca/eng/lode/databases
 * Terms: the catalog aggregates datasets from multiple publishers. Consult the
 * license declaration and restrictions for each LODE dataset before reuse.
 */

export const LODE_UA = 'MapleSpike-LODE/1.0';
export const LODE_TIMEOUT_MS = 30_000;
export const LODE_MAX_RECORDS = 50_000;

export interface LodeDatabaseInfo {
  id: string;
  name: string;
  nameFr: string;
  version: string;
  releaseDate: string;
  description: string;
  csvUrl: string | null;
  geoUrl: string | null;
  serviceUrl: string | null;
  metadataUrl: string | null;
  ckanId: string | null;
  recordCount: number;
  frequency: string;
  formats: string[];
  keywords: string[];
}

export const LODE_DATABASES: Record<string, LodeDatabaseInfo> = {
  ODA: {
    id: 'oda',
    name: 'Open Database of Addresses',
    nameFr: 'Base de données ouvertes sur les adresses',
    version: '1.0',
    releaseDate: '2021-04-29',
    description: 'Civic addresses and their geo-locations across Canada. Contains over 10 million addresses. Developed in collaboration with OpenAddresses.',
    csvUrl: null,
    geoUrl: null,
    serviceUrl: null,
    metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/oda',
    ckanId: null,
    recordCount: 10_000_000,
    frequency: 'irregular',
    formats: ['CSV'],
    keywords: ['addresses', 'geolocation', 'civic addresses', 'postal', 'geocoding'],
  },
  ODB: {
    id: 'odb',
    name: 'Open Database of Buildings',
    nameFr: 'Base de données ouvertes sur les immeubles',
    version: '3.0',
    releaseDate: '2025-04-15',
    description: 'Approximately 14.4 million building features compiled from 530 datasets originating from 107 government sources of open data across Canada.',
    csvUrl: null,
    geoUrl: 'https://ftp.maps.canada.ca/pub/statcan_statcan/Buildings_Immeubles/ODB_BDOI/ODB_BDOI.gdb.zip',
    serviceUrl: 'https://maps-cartes.services.geo.ca/server2_serveur2/rest/services/StatCan/OpenDatabaseBuildings/MapServer',
    metadataUrl: 'https://www150.statcan.gc.ca/n1/pub/34-26-0001/342600012018001-eng.htm',
    ckanId: '40e37a0f-1393-4e91-bd00-334dceb26e34',
    recordCount: 14_400_000,
    frequency: 'irregular',
    formats: ['FGDB/GDB', 'ESRI REST', 'WMS'],
    keywords: ['buildings', 'structures', 'infrastructure', 'footprints', '3d'],
  },
  ODHF: {
    id: 'odhf',
    name: 'Open Database of Healthcare Facilities',
    nameFr: 'Base de données ouvertes sur les établissements de santé',
    version: '1.1',
    releaseDate: '2020-08-07',
    description: 'Names, addresses, and geo-coordinates of healthcare facilities across Canada. Classified by type: ambulatory, hospital, nursing/residential. ~7,000 records.',
    csvUrl: 'https://ftp.maps.canada.ca/pub/statcan_statcan/Health-care-facilities_Etablissement-de-sante/ODHF_BDOES/odhf_bdoes_v1.csv',
    geoUrl: 'https://ftp.maps.canada.ca/pub/statcan_statcan/Health-care-facilities_Etablissement-de-sante/ODHF_BDOES/ODHF_BDOES.gdb.zip',
    serviceUrl: 'https://maps-cartes.services.geo.ca/server2_serveur2/rest/services/StatCan/OpenDatabaseHealthFacilities/MapServer',
    metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odhf',
    ckanId: 'a1bcd4ee-8e57-499b-9c6f-94f6902fdf32',
    recordCount: 7_000,
    frequency: 'irregular',
    formats: ['CSV', 'FGDB/GDB', 'ESRI REST', 'WMS'],
    keywords: ['healthcare', 'hospitals', 'clinics', 'medical', 'health facilities'],
  },
  ODRSF: {
    id: 'odrsf',
    name: 'Open Database of Recreational and Sport Facilities',
    nameFr: 'Base de données ouvertes sur les installations récréatives et sportives',
    version: '1.0',
    releaseDate: '2021-09-28',
    description: 'Names and locations of major recreational spaces and amenities across Canada including arenas, public pools, ski resorts, parks, sports fields, and community centres. ~182,000 records.',
    csvUrl: null,
    geoUrl: null,
    serviceUrl: null,
    metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odrsf',
    ckanId: null,
    recordCount: 182_000,
    frequency: 'irregular',
    formats: ['CSV'],
    keywords: ['recreation', 'sports', 'arenas', 'pools', 'parks', 'fitness', 'ski'],
  },
  ODEF: {
    id: 'odef',
    name: 'Open Database of Educational Facilities',
    nameFr: 'Base de données ouvertes sur les établissements d\'enseignement',
    version: '3.0',
    releaseDate: '2024-12-13',
    description: 'Addresses of educational facilities across Canada. ~19,000 records compiled from open sources and publicly available data.',
    csvUrl: null,
    geoUrl: null,
    serviceUrl: null,
    metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odef',
    ckanId: null,
    recordCount: 19_000,
    frequency: 'irregular',
    formats: ['CSV'],
    keywords: ['education', 'schools', 'universities', 'colleges', 'daycares'],
  },
  ODCAF: {
    id: 'odcaf',
    name: 'Open Database of Cultural and Art Facilities',
    nameFr: 'Base de données ouvertes sur les installations culturelles et artistiques',
    version: '1.0',
    releaseDate: '2020-10-02',
    description: 'Names, addresses, and geo-coordinates of cultural and art facilities across Canada including museums, galleries, libraries, art centres. ~8,000 records.',
    csvUrl: null,
    geoUrl: null,
    serviceUrl: null,
    metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odcaf',
    ckanId: null,
    recordCount: 8_000,
    frequency: 'irregular',
    formats: ['CSV'],
    keywords: ['culture', 'arts', 'museums', 'galleries', 'libraries', 'heritage'],
  },
  ODBusiness: {
    id: 'odbusiness',
    name: 'Open Database of Businesses',
    nameFr: 'Base de données ouvertes sur les entreprises',
    version: '1.0',
    releaseDate: '2023-11-28',
    description: 'Business information including names, addresses, locations, industry classification (NAICS), and other characteristics.',
    csvUrl: null,
    geoUrl: null,
    serviceUrl: null,
    metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odbus',
    ckanId: null,
    recordCount: 500_000,
    frequency: 'irregular',
    formats: ['CSV'],
    keywords: ['businesses', 'companies', 'NAICS', 'industry', 'establishments'],
  },
  ODI: {
    id: 'odi',
    name: 'Open Database of Infrastructure',
    nameFr: 'Base de données ouvertes sur les infrastructures',
    version: '2.0',
    releaseDate: '2024-11-13',
    description: 'Data across 11 infrastructure types: electric grid, oil and gas, low carbon, bridges and tunnels, airports, ports and marinas, railways, potable water, solid waste, wastewater and stormwater, and telecommunications.',
    csvUrl: null,
    geoUrl: null,
    serviceUrl: 'https://maps-cartes.services.geo.ca/server2_serveur2/rest/services/StatCan/OpenDatabaseInfrastructure/MapServer',
    metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odi',
    ckanId: null,
    recordCount: 100_000,
    frequency: 'irregular',
    formats: ['CSV', 'FGDB/GDB', 'ESRI REST'],
    keywords: ['infrastructure', 'electric grid', 'transportation', 'water', 'energy'],
  },
  ODG: {
    id: 'odg',
    name: 'Open Database of Greenhouses',
    nameFr: 'Base de données ouvertes sur les serres',
    version: '2.0',
    releaseDate: '2025-08-18',
    description: 'Approximately 3,900 manually digitized greenhouses from open-source earth observation imagery. Version 2.0 added 1,006 ML-detected footprints.',
    csvUrl: null,
    geoUrl: null,
    serviceUrl: null,
    metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odg',
    ckanId: null,
    recordCount: 3_900,
    frequency: 'irregular',
    formats: ['GIS', 'GeoJSON'],
    keywords: ['greenhouses', 'agriculture', 'horticulture', 'earth observation'],
  },
  CPND: {
    id: 'cpnd',
    name: 'Canadian Pedestrian Network Database',
    nameFr: 'Base de données du réseau piétonnier canadien',
    version: '1.0',
    releaseDate: '2025-03-19',
    description: 'National collection of pedestrian infrastructure compiled from 55 municipalities. Sidewalks, paths, multi-use paths, unpaved paths, pedestrian zones, crosswalks, bridges, underpasses, stairways.',
    csvUrl: null,
    geoUrl: null,
    serviceUrl: 'https://maps-cartes.services.geo.ca/server2_serveur2/rest/services/StatCan/PedestrianNetwork/MapServer',
    metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/cpnd',
    ckanId: null,
    recordCount: 500_000,
    frequency: 'irregular',
    formats: ['GeoJSON', 'ESRI REST', 'FGDB/GDB'],
    keywords: ['pedestrian', 'sidewalks', 'walkability', 'transportation', 'urban'],
  },
  CPTND: {
    id: 'cptnd',
    name: 'Canadian Public Transit Network Database',
    nameFr: 'Base de données du réseau de transport en commun canadien',
    version: '1.0',
    releaseDate: '2025-01-31',
    description: 'National compilation of over 100 public transit services in GTFS and geospatial formats. Stops, stop times, trips, routes, calendars.',
    csvUrl: null,
    geoUrl: null,
    serviceUrl: null,
    metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/cptnd',
    ckanId: null,
    recordCount: 1_000_000,
    frequency: 'annual',
    formats: ['GTFS', 'GeoJSON', 'FGDB/GDB'],
    keywords: ['transit', 'public transport', 'bus', 'subway', 'LRT', 'GTFS'],
  },
  CCND: {
    id: 'ccnd',
    name: 'Canadian Cycling Network Database',
    nameFr: 'Base de données du réseau cyclable canadien',
    version: '1.0',
    releaseDate: '2025-01-30',
    description: 'National dataset of cycling infrastructure compiled from 75 municipalities. Standardized using the Canadian Bikeway Comfort and Safety (Can-BICS) classification system.',
    csvUrl: null,
    geoUrl: null,
    serviceUrl: 'https://maps-cartes.services.geo.ca/server2_serveur2/rest/services/StatCan/CyclingNetwork/MapServer',
    metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/ccnd',
    ckanId: null,
    recordCount: 250_000,
    frequency: 'irregular',
    formats: ['GeoJSON', 'ESRI REST', 'FGDB/GDB'],
    keywords: ['cycling', 'bike lanes', 'bicycle', 'infrastructure', 'Can-BICS'],
  },
};

export const LODE_SOURCE_NAMES = {
  ODA: 'lode-addresses',
  ODB: 'lode-buildings',
  ODHF: 'lode-healthcare',
  ODRSF: 'lode-recreation',
  ODEF: 'lode-education',
  ODCAF: 'lode-culture',
  ODBusiness: 'lode-businesses',
  ODI: 'lode-infrastructure',
  ODG: 'lode-greenhouses',
  CPND: 'lode-pedestrian',
  CPTND: 'lode-transit',
  CCND: 'lode-cycling',
} as const;

export const LODE_GEOCODING = {
  EPSG_4326: 'EPSG:4326',
  EPSG_4269: 'EPSG:4269',
  EPSG_3978: 'EPSG:3978',
  EPSG_3347: 'EPSG:3347',
} as const;

export const ODI_INFRASTRUCTURE_TYPES = [
  'electric_grid', 'oil_gas', 'low_carbon', 'bridges_tunnels',
  'airports', 'ports_marinas', 'railways', 'potable_water',
  'solid_waste', 'wastewater_stormwater', 'telecommunications',
] as const;

export type OdiInfrastructureType = typeof ODI_INFRASTRUCTURE_TYPES[number];

export const CAN_BICS_CLASSIFICATIONS = [
  'cycle_track', 'local_street_bikeway', 'multi_use_path',
  'painted_bike_lane', 'paved_shoulder', 'signed_route',
] as const;

export type CanBicsClassification = typeof CAN_BICS_CLASSIFICATIONS[number];

export const ODHF_FACILITY_TYPES = [
  'ambulatory_health_care_services', 'hospital', 'nursing_residential_care',
] as const;

export type OdhfFacilityType = typeof ODHF_FACILITY_TYPES[number];
