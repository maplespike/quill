/**
 * LODE Geospatial — Constants
 *
 * Known Canadian WFS/WMS geospatial service endpoints.
 *
 * BC LODE:  BC Land Ownership Data Exchange (WFS)
 * GeoMet:   Environment and Climate Change Canada weather geo data (WMS/WFS)
 */

export const WFS_VERSION = '2.0.0';
export const WMS_VERSION = '1.3.0';

export const LODE_SOURCES = {
  BC_LODE: {
    name: 'BC Land Ownership Data Exchange',
    url: 'https://clss.landownersregistry.ca/',
    type: 'WFS' as const,
    jurisdiction: 'bc',
    description: 'BC land ownership and parcel data via WFS',
  },
  GEOMET: {
    name: 'GeoMet Weather Canada',
    url: 'https://geo.weather.gc.ca/',
    type: 'WMS' as const,
    jurisdiction: 'federal',
    description: 'Environment Canada weather, climate, and hydrological geospatial data',
  },
} as const;

export type LodeSourceKey = keyof typeof LODE_SOURCES;
