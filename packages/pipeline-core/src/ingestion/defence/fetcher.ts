// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Real CKAN fetchers for National Defence data.
 */
import { httpGet } from '../../utils/http.js';
import { DND_DATASETS } from './constants.js';
import type { DndPersonnelRecord, DndProcurementRecord } from './types.js';

async function fetchCkanPackage(ckanId: string): Promise<any | null> {
  try {
    const resp = await httpGet(`https://open.canada.ca/data/api/3/action/package_show?id=${ckanId}`, {
      timeoutMs: 15000,
    });
    if (resp.statusCode >= 400) return null;
    const body: any = await resp.json();
    return body?.result ?? null;
  } catch { return null; }
}

async function fetchCsv(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, { timeoutMs: 30000 });
    if (resp.statusCode >= 400) return null;
    return resp.body;
  } catch { return null; }
}

/** Fetch DND Regular Force personnel by rank from CKAN CSV */
export async function fetchRegularForcePersonnel(): Promise<DndPersonnelRecord[]> {
  const pkg = await fetchCkanPackage(DND_DATASETS.REGULAR_FORCE_RANK.id);
  if (!pkg) return [];

  const csvResources = (pkg.resources || [])
    .filter((r: any) => r.format?.toUpperCase() === 'CSV')
    .sort((a: any, b: any) => b.created?.localeCompare(a.created || ''));

  if (!csvResources.length) return [];

  const raw = await fetchCsv(csvResources[0].url);
  if (!raw) return [];

  const lines = raw.split('\n').filter((l: string) => l.trim());
  if (lines.length < 2) return [];

  const h = lines[0].split(',').map((c: string) => c.trim().toLowerCase());
  const yi = h.indexOf('year'), mi = h.indexOf('month'), ri = h.indexOf('rank') >= 0 ? h.indexOf('rank') : h.indexOf('classification');
  const ci = h.indexOf('component') >= 0 ? h.indexOf('component') : -1;
  const gi = h.indexOf('gender') >= 0 ? h.indexOf('gender') : -1;
  const vi = h.findIndex((x: string) => x.includes('count') || x.includes('number') || x.includes('value') || x === 'v');

  const results: DndPersonnelRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c: string) => c.trim());
    const val = parseFloat(cols[vi] || '0');
    if (isNaN(val) || val <= 0) continue;
    results.push({
      year: parseInt(cols[yi] || '0') || 0,
      month: parseInt(cols[mi] || '0') || 0,
      rank: cols[ri] || '',
      component: ci >= 0 ? cols[ci] : 'Regular Force',
      gender: gi >= 0 ? cols[gi] : undefined,
      count: val,
    });
  }
  return results;
}

/** Fetch defence procurement contracts from proactive disclosure */
export async function fetchDefenceProcurement(): Promise<DndProcurementRecord[]> {
  const pkg = await fetchCkanPackage(DND_DATASETS.DEFENCE_PROCUREMENT.id);
  if (!pkg) return [];
  const csvResources = (pkg.resources || [])
    .filter((r: any) => r.format?.toUpperCase() === 'CSV')
    .sort((a: any, b: any) => b.created?.localeCompare(a.created || ''));
  if (!csvResources.length) return [];
  const raw = await fetchCsv(csvResources[0].url);
  if (!raw) return [];
  const lines = raw.split('\n').filter((l: string) => l.trim());
  if (lines.length < 2) return [];
  const h = lines[0].split(',').map((c: string) => c.trim().toLowerCase());
  const yi = h.indexOf('year') >= 0 ? h.indexOf('year') : 0;
  const vi = h.findIndex((x: string) => x.includes('vendor') || x.includes('contract'));
  const di = h.findIndex((x: string) => x.includes('description') || x.includes('subject'));
  const vli = h.findIndex((x: string) => x.includes('value') || x.includes('amount') || x.includes('contract'));
  const results: DndProcurementRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c: string) => c.trim());
    if (cols.length < 3) continue;
    const val = parseFloat(cols[vli]?.replace(/[$,]/g, '') || '0');
    if (isNaN(val)) continue;
    results.push({ year: parseInt(cols[yi] || '0') || 0, vendor: cols[vi] || '', description: cols[di] || '', value: val });
  }
  return results;
}
