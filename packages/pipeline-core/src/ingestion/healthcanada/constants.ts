/**
 * Health Canada Constants — MapleSpike Pipeline
 *
 * Source configurations and mappings for Health Canada data ingestion.
 */

export const HEALTH_CANADA_SOURCES = {
  /** Food recalls from open.canada.ca */
  foodRecalls: {
    name: 'Food Recalls',
    ckanPackageId: 'food-recalls',
    baseUrl: 'https://open.canada.ca/data/en/dataset',
    updateFrequency: 'daily',
    healthCheckUrl: 'https://open.canada.ca/data',
  },

  /** Drug products database */
  drugProducts: {
    name: 'Drug Products Database',
    baseUrl: 'https://health-products.canada.ca/dpd-bdpp',
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://health-products.canada.ca',
  },

  /** Health advisories and safety alerts */
  advisories: {
    name: 'Health Advisories',
    baseUrl: 'https://www.canada.ca/en/health-canada/services/drugs-health-products/recalls-alerts',
    updateFrequency: 'daily',
    healthCheckUrl: 'https://www.canada.ca',
  },
} as const;

export const HEALTH_CANADA_CATEGORIES = [
  'food',
  'drug',
  'device',
  'consumer',
  'advisory',
] as const;

export const RECALL_CLASSIFICATION_MAP: Record<string, string> = {
  'Class I': 'Class I',
  'Class II': 'Class II',
  'Class III': 'Class III',
  'Advisory': 'Advisory',
  'Safety Alert': 'Safety Alert',
};

export const RISK_LEVEL_MAP: Record<string, 'low' | 'moderate' | 'high' | 'critical'> = {
  'Class I': 'critical',
  'Class II': 'high',
  'Class III': 'moderate',
  'Advisory': 'moderate',
  'Safety Alert': 'low',
};

export const TRUST_THRESHOLD = 0.6; // 60% threshold for citation acceptance