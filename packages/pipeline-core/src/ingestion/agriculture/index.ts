import { computeHash } from '../../verification/hashing.js';
import type { AgricultureRecord, AgricultureIngestionResult } from './types.js';

export async function ingestAllAgriculture(): Promise<AgricultureIngestionResult> {
  const startTime = Date.now();
  const records: AgricultureRecord[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await fetch('https://open.canada.ca/data/api/3/action/package_search?q=agriculture+crops', {
      signal: AbortSignal.timeout(15000),
    });
    if (resp.ok) {
      const body = await resp.json() as any;
      const results = body?.result?.results ?? body?.result?.resources ?? [];
      for (const item of results.slice(0, 200)) {
        const id = await computeHash(`agriculture:${item.id ?? item.name ?? Math.random()}`, 'sha256');
        records.push({
          id,
          year: new Date().getFullYear(),
          category: item.notes?.substring(0, 80) ?? item.title ?? '',
          value: 1,
          description: item.title ?? item.name ?? '',
          region: 'Canada',
          sourceUrl: item.url ?? item.source_url ?? '',
          ingestedAt: now,
        });
      }
    }
  } catch (err) {
    errors.push(`${err instanceof Error ? err.message : 'unknown'}`);
  }

  return { records, errors, durationMs: Date.now() - startTime };
}

export async function searchAgriculture(query: string): Promise<AgricultureIngestionResult> {
  const all = await ingestAllAgriculture();
  const q = query.toLowerCase();
  return {
    records: all.records.filter(r =>
      r.description.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)),
    errors: all.errors,
    durationMs: all.durationMs,
  };
}

export type { AgricultureRecord, AgricultureIngestionResult } from './types.js';
