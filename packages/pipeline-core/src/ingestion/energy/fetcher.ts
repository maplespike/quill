// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { CER_CKAN, ENERGY_TIMEOUT_MS, ENERGY_UA } from './constants.js';
import type { EnergyRecord, EnergyIngestionResult } from './types.js';

async function searchCkan(query: string, rows = 10) {
  try {
    const resp = await httpGet(`${CER_CKAN}?q=${encodeURIComponent(query)}&rows=${rows}`, {
      timeoutMs: ENERGY_TIMEOUT_MS, headers: { 'User-Agent': ENERGY_UA },
    });
    if (resp.statusCode >= 400) return [];
    const data = JSON.parse(resp.body);
    return (data?.result?.results ?? []).map((r: any) => ({
      id: r.id, title: r.title || '',
      description: (r.notes || '').substring(0, 300),
      url: `https://open.canada.ca/data/en/dataset/${r.id}`,
      date: r.metadata_created?.substring(0, 10) || '',
      license: r.license,
      license_id: r.license_id,
      license_title: r.license_title,
      license_url: r.license_url,
      attribution: r.attribution,
    }));
  } catch { return []; }
}

export async function ingestOilProduction(): Promise<EnergyIngestionResult> {
  const start = Date.now();
  const records = (await searchCkan('crude oil production canada', 10)).map((r: any) => ({ ...r, sector: 'oil', category: 'energy' }));
  return { source: 'oil-production', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestGasProduction(): Promise<EnergyIngestionResult> {
  const start = Date.now();
  const records = (await searchCkan('natural gas production canada', 10)).map((r: any) => ({ ...r, sector: 'gas', category: 'energy' }));
  return { source: 'gas-production', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestElectricity(): Promise<EnergyIngestionResult> {
  const start = Date.now();
  const records = (await searchCkan('electricity generation canada', 10)).map((r: any) => ({ ...r, sector: 'electricity', category: 'energy' }));
  return { source: 'electricity', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestMining(): Promise<EnergyIngestionResult> {
  const start = Date.now();
  const records = (await searchCkan('mineral production canada', 10)).map((r: any) => ({ ...r, sector: 'mining', category: 'energy' }));
  return { source: 'mining', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestPipelineData(): Promise<EnergyIngestionResult> {
  const start = Date.now();
  const records = (await searchCkan('pipeline capacity throughput canada', 10)).map((r: any) => ({ ...r, sector: 'pipeline', category: 'energy' }));
  return { source: 'pipeline-data', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestRenewableEnergy(): Promise<EnergyIngestionResult> {
  const start = Date.now();
  const records = (await searchCkan('renewable energy wind solar canada', 10)).map((r: any) => ({ ...r, sector: 'renewable', category: 'energy' }));
  return { source: 'renewable-energy', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestAllEnergy(): Promise<Record<string, EnergyIngestionResult>> {
  const [oil, gas, elec, mining, pipeline, renewable] = await Promise.all([
    ingestOilProduction(), ingestGasProduction(), ingestElectricity(),
    ingestMining(), ingestPipelineData(), ingestRenewableEnergy(),
  ]);
  return { 'oil-production': oil, 'gas-production': gas, electricity: elec, mining, 'pipeline-data': pipeline, 'renewable-energy': renewable };
}
