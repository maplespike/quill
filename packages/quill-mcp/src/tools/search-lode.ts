/**
 * LODE Geospatial MCP Tool — MapleSpike
 *
 * Query all 12 Statistics Canada LODE (Linkable Open Data Environment)
 * databases: addresses, buildings, healthcare, recreation, education,
 * culture, businesses, infrastructure, greenhouses, pedestrian networks,
 * transit networks, and cycling networks.
 */
import type { ToolDefinition, ToolHandler } from './types.js';

const LODE_DATABASE_LIST = [
  { id: 'oda', name: 'Open Database of Addresses', nameFr: 'Base de données ouvertes sur les adresses', records: '~10,000,000', version: '1.0', releaseDate: '2021-04-29', description: 'Civic addresses and geo-locations across Canada. Over 10 million addresses.', formats: ['CSV'], csvUrl: null, metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/oda' },
  { id: 'odb', name: 'Open Database of Buildings', nameFr: 'Base de données ouvertes sur les immeubles', records: '~14,400,000', version: '3.0', releaseDate: '2025-04-15', description: 'Building features compiled from 530 datasets from 107 government sources.', formats: ['FGDB/GDB', 'ESRI REST', 'WMS'], csvUrl: null, metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odb' },
  { id: 'odhf', name: 'Open Database of Healthcare Facilities', nameFr: 'Base de données ouvertes sur les établissements de santé', records: '~7,000', version: '1.1', releaseDate: '2020-08-07', description: 'Names, addresses, and locations of healthcare facilities across Canada.', formats: ['CSV', 'FGDB/GDB', 'ESRI REST', 'WMS'], csvUrl: 'https://ftp.maps.canada.ca/pub/statcan_statcan/Health-care-facilities_Etablissement-de-sante/ODHF_BDOES/odhf_bdoes_v1.csv', metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odhf' },
  { id: 'odrsf', name: 'Open Database of Recreational and Sport Facilities', nameFr: 'Base de données ouvertes sur les installations récréatives et sportives', records: '~182,000', version: '1.0', releaseDate: '2021-09-28', description: 'Recreational spaces and amenities: arenas, pools, ski resorts, parks, sports fields, community centres.', formats: ['CSV'], csvUrl: null, metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odrsf' },
  { id: 'odef', name: 'Open Database of Educational Facilities', nameFr: 'Base de données ouvertes sur les établissements d\'enseignement', records: '~19,000', version: '3.0', releaseDate: '2024-12-13', description: 'Educational facility addresses across Canada.', formats: ['CSV'], csvUrl: null, metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odef' },
  { id: 'odcaf', name: 'Open Database of Cultural and Art Facilities', nameFr: 'Base de données ouvertes sur les installations culturelles et artistiques', records: '~8,000', version: '1.0', releaseDate: '2020-10-02', description: 'Museums, galleries, libraries, art centres, heritage sites.', formats: ['CSV'], csvUrl: null, metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odcaf' },
  { id: 'odbusiness', name: 'Open Database of Businesses', nameFr: 'Base de données ouvertes sur les entreprises', records: '~500,000', version: '1.0', releaseDate: '2023-11-28', description: 'Business names, addresses, NAICS classification, locations.', formats: ['CSV'], csvUrl: null, metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odbus' },
  { id: 'odi', name: 'Open Database of Infrastructure', nameFr: 'Base de données ouvertes sur les infrastructures', records: '~100,000', version: '2.0', releaseDate: '2024-11-13', description: '11 infrastructure types: electric grid, oil/gas, low carbon, bridges/tunnels, airports, ports, railways, water, waste, wastewater, telecom.', formats: ['ESRI REST', 'FGDB/GDB'], csvUrl: null, metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odi' },
  { id: 'odg', name: 'Open Database of Greenhouses', nameFr: 'Base de données ouvertes sur les serres', records: '~3,900', version: '2.0', releaseDate: '2025-08-18', description: 'Greenhouse footprints digitized from earth observation imagery. ML-assisted detection.', formats: ['GIS', 'GeoJSON'], csvUrl: null, metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/odg' },
  { id: 'cpnd', name: 'Canadian Pedestrian Network Database', nameFr: 'Base de données du réseau piétonnier canadien', records: '~500,000', version: '1.0', releaseDate: '2025-03-19', description: 'Pedestrian infrastructure from 55 municipalities. Sidewalks, paths, crosswalks, bridges.', formats: ['ESRI REST', 'FGDB/GDB', 'GeoJSON'], csvUrl: null, metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/cpnd' },
  { id: 'cptnd', name: 'Canadian Public Transit Network Database', nameFr: 'Base de données du réseau de transport en commun canadien', records: '~1,000,000', version: '1.0', releaseDate: '2025-01-31', description: 'Over 100 public transit services in GTFS and geospatial formats.', formats: ['GTFS', 'GeoJSON', 'FGDB/GDB'], csvUrl: null, metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/cptnd' },
  { id: 'ccnd', name: 'Canadian Cycling Network Database', nameFr: 'Base de données du réseau cyclable canadien', records: '~250,000', version: '1.0', releaseDate: '2025-01-30', description: 'Cycling infrastructure from 75 municipalities. Can-BICS classified.', formats: ['ESRI REST', 'FGDB/GDB', 'GeoJSON'], csvUrl: null, metadataUrl: 'https://www.statcan.gc.ca/eng/lode/databases/ccnd' },
];

export const definition: ToolDefinition = {
  name: 'search_lode',
  description:
    'Query Statistics Canada LODE (Linkable Open Data Environment) geospatial databases. ' +
    'Record counts below are the figures Statistics Canada publishes in its own metadata for each ' +
    'database, carried in this tool\'s catalogue — they are not counts Quill verified by download. ' +
    '12 databases covering addresses (~10M buildings), buildings (~14.4M features), ' +
    'healthcare (~7K), recreation (~182K), education (~19K), culture (~8K), businesses ' +
    '(~500K), infrastructure (11 types), greenhouses (~3.9K), pedestrian networks, ' +
    'public transit networks, and cycling networks. ' +
    'Use databaseId to target a specific database, or list=true to see the catalog.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — e.g., "hospitals Ottawa", "arena Toronto", "cycling Vancouver"',
      },
      databaseId: {
        type: 'string',
        description: 'Target specific LODE database. Omit for all. Options: oda, odb, odhf, odrsf, odef, odcaf, odbusiness, odi, odg, cpnd, cptnd, ccnd',
      },
      province: {
        type: 'string',
        description: 'Filter by province code (e.g., ON, QC, BC)',
      },
      municipality: {
        type: 'string',
        description: 'Filter by municipality name',
      },
      list: {
        type: 'boolean',
        description: 'Set true to list all 12 LODE databases with metadata and download links',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Maximum results (default: 10)',
      },
    },
  },
};

export const handler: ToolHandler = async (args) => {
  const list = args.list as boolean;
  const query = (args.query as string) ?? '';
  const databaseId = (args.databaseId as string) ?? '';
  const limit = Math.min((args.limit as number) ?? 10, 100);

  // List mode: return LODE database catalog
  if (list) {
    return {
      content: {
        tool: 'search_lode',
        list: true,
        databases: LODE_DATABASE_LIST,
        totalCount: LODE_DATABASE_LIST.length,
        metadata: {
          source: 'Statistics Canada Linkable Open Data Environment (LODE)',
          license: 'Dataset-specific publisher license declarations are not included in this catalog response; consult each publisher dataset page.',
          portal: 'https://www.statcan.gc.ca/eng/lode/databases',
          cachedAt: new Date().toISOString(),
        },
        note: 'Most LODE databases require direct download from StatCan due to large file sizes. ' +
          'CSV available for ODHF (healthcare). Others available via ESRI REST services. ' +
          'Pipeline ingestion provides metadata records for search integration.',
      },
    };
  }

  // Filter databases if specific ID requested
  const dbs = databaseId
    ? LODE_DATABASE_LIST.filter(d => d.id === databaseId)
    : LODE_DATABASE_LIST;

  // Return LODE database metadata (geospatial datasets are multi-GB files served via StatCan)
  let results = dbs.map(db => ({
    id: db.id,
    name: db.name,
    version: db.version,
    releaseDate: db.releaseDate,
    recordCount: db.records,
    description: db.description,
    formats: db.formats,
    csvUrl: db.csvUrl,
    metadataUrl: db.metadataUrl,
    _source: `lode-${db.id}`,
    _metadata: true,
  }));
  let total = results.length;

  // If a query is given, filter by query
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(r =>
      JSON.stringify(r).toLowerCase().includes(q)
    );
    total = results.length;
  }

  return {
    content: {
      tool: 'search_lode',
      query: query || undefined,
      databaseId: databaseId || 'all',
      limit: Math.min(results.length, limit),
      results: results.slice(0, limit),
      totalCount: total,
      metadata: {
        source: 'Statistics Canada Linkable Open Data Environment (LODE)',
        license: 'Dataset-specific publisher license declarations are not included in this catalog response; consult each publisher dataset page.',
        portal: 'https://www.statcan.gc.ca/eng/lode/databases',
      },
      note: databaseId
        ? `Results for LODE database "${databaseId}". Download URL: ${LODE_DATABASE_LIST.find(d => d.id === databaseId)?.metadataUrl || ''}. Full data requires direct download from StatCan (files range from MB to GB).`
        : 'All LODE databases listed. Use databaseId to target a specific database for detailed info.',
    },
  };
};
