/**
 * Health Canada Ingestion — MapleSpike Pipeline
 *
 * Fetcher for Health Canada datasets via CKAN portal.
 */

import { httpGet } from '../../utils/http.js';
import { USER_AGENT, getResourceUrl } from './constants.js';

/**
 * Fetch the primary data resource (usually CSV or JSON) for a Health Canada dataset.
 * Returns the raw resource content.
 */
export async function fetchHealthCanadaDataset(
  datasetKey: 'drugApprovals' | 'medicalDevices' | 'foodRecalls' | 'adverseReactions' | 'pesticideRegistrations' | 'cannabisLicences' | 'controlledSubstances',
  options: { limit?: number } = {},
): Promise<string> {
  const url = getResourceUrl(String(datasetKey));

  try {
    const resp = await httpGet(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeoutMs: 30000,
    });

    if (resp.statusCode >= 400) {
      throw new Error(`Health Canada error (${datasetKey}): ${resp.statusCode}`);
    }

    // Parse JSON to get resource URLs, then fetch the most recent
    const data = JSON.parse(resp.body || '');
    if (!data.success || !data.result?.results) {
      throw new Error(`No resources found for Health Canada dataset: ${datasetKey}`);
    }

    const resources = (Array.isArray(data.result.results) ? data.result.results : []);
    if (resources.length === 0) {
      throw new Error(`No resources found for Health Canada dataset: ${datasetKey}`);
    }

    // Get the most recently updated resource
    const primaryResource = resources[0];
    const resourceUrl = primaryResource.url;

    const dataResp = await httpGet(resourceUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeoutMs: 30000,
    });

    if (dataResp.statusCode >= 400) {
      throw new Error(`Failed to fetch Health Canada data (${datasetKey}): ${dataResp.statusCode}`);
    }

    return dataResp.body || '';
  } catch (error) {
    console.error(`Health Canada fetch failed (${datasetKey}):`, (error as Error).message);
    throw error;
  }
}