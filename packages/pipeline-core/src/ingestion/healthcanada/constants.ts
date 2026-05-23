/**
 * Health Canada Ingestion — MapleSpike Pipeline
 *
 * Constants and data source configurations for Health Canada modules.
 */

const USER_AGENT = 'MapleSpike/0.2 (+https://maplespike.lan)';
const HC_CKAN_BASE = 'https://open.canada.ca/data/en';

// CKAN dataset IDs for Health Canada modules
const DATASET_IDS = {
  drugApprovals: 'drug-approvals',
  medicalDevices: 'medical-devices',
  foodRecalls: 'food-recalls',
  adverseReactions: 'pharmacovigilance',
  pesticideRegistrations: 'pesticide-registrations',
  cannabisLicences: 'cannabis-licences',
  controlledSubstances: 'controlled-substances',
} as const;

// Dataset metadata
const DATASET_INFO = {
  drugApprovals: {
    title: 'Drug Approvals',
    description: 'Health Canada drug product approval decisions',
    category: 'health',
    updateFrequency: 'weekly',
    trustThreshold: 0.6,
  },
  medicalDevices: {
    title: 'Medical Devices',
    description: 'Health Canada medical device licences and authorizations',
    category: 'health',
    updateFrequency: 'weekly',
    trustThreshold: 0.6,
  },
  foodRecalls: {
    title: 'Food Recalls',
    description: 'Health Canada food safety recalls and consumer advisories',
    category: 'health',
    updateFrequency: 'daily',
    trustThreshold: 0.6,
  },
  adverseReactions: {
    title: 'Pharmacovigilance',
    description: 'Health Canada adverse drug reaction reports',
    category: 'health',
    updateFrequency: 'monthly',
    trustThreshold: 0.6,
  },
  pesticideRegistrations: {
    title: 'Pesticide Registrations',
    description: 'Health Canada pesticide product registrations',
    category: 'health',
    updateFrequency: 'monthly',
    trustThreshold: 0.6,
  },
  cannabisLicences: {
    title: 'Cannabis Licences',
    description: 'Health Canada cannabis production and sales licences',
    category: 'health',
    updateFrequency: 'monthly',
    trustThreshold: 0.6,
  },
  controlledSubstances: {
    title: 'Controlled Substances',
    description: 'Health Canada controlled substances authorizations',
    category: 'health',
    updateFrequency: 'quarterly',
    trustThreshold: 0.6,
  },
} as const;

// Organization info
const ORGANIZATION = {
  name: 'Health Canada',
  title: 'Health Canada',
  jurisdiction: 'federal',
  category: 'health',
};

// Resource resource endpoints (typical for CKAN packages)
function getResourceUrl(datasetId: string): string {
  return `${HC_CKAN_BASE}/dataset/${datasetId}/resource`;
}

export { 
  USER_AGENT, 
  DATASET_IDS, 
  DATASET_INFO, 
  getResourceUrl,
  ORGANIZATION,
};