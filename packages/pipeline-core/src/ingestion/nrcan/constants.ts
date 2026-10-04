/**
 * NRCan Constants — Quill
 *
 * Configuration for Natural Resources Canada data sources.
 */

/**
 * Open.canada.ca CKAN portal endpoint
 */
export const CKAN_BASE = 'https://open.canada.ca/data/en';

/**
 * CKAN package IDs for NRCan datasets
 */
export const NRCAN_PACKAGES = {
  MINING_ACTIVITIES: 'mining-activities',
  TOPOGRAPHIC_MAPS: 'topographic-maps',
} as const;

/**
 * Mining project stages
 */
export const MINING_STAGES = [
  'exploration',
  'development',
  'production',
  'closure',
  'reclamation',
  'unknown',
] as const;

/**
 * Common commodities in Canadian mining
 */
export const MINING_COMMODITIES = [
  'gold',
  'copper',
  'iron-ore',
  'nickel',
  'zinc',
  'potash',
  'diamonds',
  'uranium',
  'lithium',
  'cobalt',
  'rare-earth',
  'coal',
  'other',
] as const;