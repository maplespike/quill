import { VAC_DATASETS } from './constants.js';
import type { VeteransRecord } from './types.js';
import { computeHash } from '../../verification/hashing.js';

async function fetchCkanPackage(ckanId: string): Promise<any> {
  const resp = await fetch(`https://open.canada.ca/data/api/3/action/package_show?id=${ckanId}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) return null;
  return (await resp.json())?.result ?? null;
}

async function fetchCsv(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    return resp.ok ? await resp.text() : null;
  } catch { return null; }
}

/** Fetch VAC facts & figures data */
export async function fetchVacFactsFigures(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const pkg = await fetchCkanPackage(VAC_DATASETS.FACTS_FIGURES.id);
  if (!pkg?.resources) return results;

  for (const r of pkg.resources) {
    if (r.format !== 'CSV' && r.format !== 'csv') continue;
    const raw = await fetchCsv(r.url);
    if (!raw) continue;
    const lines = raw.split('\n').filter((l: any) => l.trim());
    if (lines.length < 2) continue;
    const h = lines[0].split(',').map((c: any) => c.trim().toLowerCase());
    const yi = h.indexOf('year');
    const ci = h.findIndex((x: any) => x.includes('category') || x.includes('indicator'));
    const pi = h.findIndex((x: any) => x.includes('program'));
    const vi = h.findIndex((x: any) => x.includes('value') || x.includes('count') || x.includes('number'));
    const ri = h.findIndex((x: any) => x.includes('region') || x.includes('province'));
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c: any) => c.trim());
      const val = parseFloat(cols[vi] || '0');
      if (isNaN(val)) continue;
      results.push({
        id: '',
        year: parseInt(cols[yi] || '0') || 0,
        category: cols[ci] || '',
        program: cols[pi] || '',
        value: val,
        region: ri >= 0 ? cols[ri] : undefined,
      });
    }
  }
  return results;
}
