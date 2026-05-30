// Ontario Provincial Data Ingestion Module
// Ingests data from Ontario Open Data Catalog across health, education, environment, economy domains

import { httpGet, runModule } from '../../utils/http.js';
import { performance } from 'node:perf_hooks';

// Base URL for Ontario Data Catalog (CKAN API)
const ONTARIO_BASE_URL = 'https://data.ontario.ca/api/3/action';

export const metadata = {
  id: 'ontario-provincial',
  name: 'Ontario Provincial Data Ingestion',
  version: '1.0.0',
  description: 'Ingests Ontario Open Data Catalog across health, education, environment, economy domains',
  category: 'provincial',
  juris: ['provincial'],
  provenance: ['ckan'],
  date: '2025-01-09',
  requires: [],
  provides: ['provincial-data', 'ontario-datasets', 'health-data', 'education-data', 'environment-data']
};

export async function healthCheck() {
  try {
    const resp = await httpGet(`${ONTARIO_BASE_URL}/status_show`, { responseType: 'json' });
    return { healthy: resp?.ok || false };
  } catch {
    return { healthy: false };
  }
}

export async function searchOntarioDatasets(options = {}) {
  const { keyword = '', limit = 100, domain = '' } = options;
  const params = new URLSearchParams({
    q: keyword,
    rows: String(limit),
    start: '0'
  });
  if (domain) params.set('domain', domain);
  const url = `${ONTARIO_BASE_URL}/package_search?${params}`;
  const startTime = performance.now();
  const data = await httpGet(url, { responseType: 'json' });
  const parseTime = Date.now() - startTime;
  const result = data.result || {};
  return {
    count: result.count || 0,
    records: result.results?.length || 0,
    parseTime,
    timestamp: Date.now(),
    datasets: result.results || []
  };
}

export async function fetchOntarioDataset(datasetId) {
  const url = `${ONTARIO_BASE_URL}/package_show?id=${encodeURIComponent(datasetId)}`;
  const startTime = performance.now();
  const data = await httpGet(url, { responseType: 'json' });
  const parseTime = Date.now() - startTime;
  const result = data.result || {};
  return {
    id: result.id,
    title: result.title,
    notes: result.notes,
    resources: result.resources?.length || 0,
    parseTime,
    timestamp: Date.now(),
    dataset: result
  };
}

export async function searchByDomain(options = {}) {
  const { domain = 'health', limit = 100 } = options;
  const domains = ['health', 'education', 'environment', 'economy', 'government', 'transport'];
  if (!domains.includes(domain)) {
    throw new Error(`Invalid domain: ${domain}. Valid domains: ${domains.join(', ')}`);
  }
  return searchOntarioDatasets({ keyword: domain, limit });
}

export async function getOntarioDataByOrg(options = {}) {
  const { organization = '', limit = 100 } = options;
  const url = `${ONTARIO_BASE_URL}/organization_show?id=${encodeURIComponent(organization)}&include_datasets=true`;
  const startTime = performance.now();
  const data = await httpGet(url, { responseType: 'json' });
  const parseTime = Date.now() - startTime;
  const result = data.result || {};
  return {
    id: result.id,
    title: result.title,
    datasetCount: result.package_count || 0,
    datasets: result.packages?.length || 0,
    parseTime,
    timestamp: Date.now(),
    organization: result
  };
}

export async function ingestAllOntario(options = {}) {
  const { domains = ['health', 'education', 'environment', 'economy'], limit = 50 } = options;
  const results = [];
  for (const domain of domains) {
    try {
      const data = await searchByDomain({ domain, limit });
      results.push({ domain, success: true, records: data.records });
    } catch (error) {
      results.push({ domain, success: false, error: error.message });
    }
  }
  return {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
    timestamp: Date.now()
  };
}

runModule('ontario-provincial', async () => {
  console.log('Ontario Provincial Data Ingestion Module');
  const health = await healthCheck();
  console.log(`Health Check: ${health.healthy ? 'OK' : 'FAILED'}`);
  const results = await ingestAllOntario({ domains: ['health', 'education'], limit: 50 });
  console.log(`Ingested ${results.successful}/${results.total} domains`);
  return results;
});