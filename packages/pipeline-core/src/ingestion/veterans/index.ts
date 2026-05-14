import { computeHash } from '../../verification/hashing.js';
import type { VeteransRecord, VeteransIngestionResult } from './types.js';

export async function ingestAllVeterans(): Promise<VeteransIngestionResult> {
  const startTime = Date.now();
  const records: VeteransRecord[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await fetch('https://open.canada.ca/data/api/3/action/package_show?id=460aa2e0-5a37-47cf-a858-98b4327d29de', {
      signal: AbortSignal.timeout(15000),
    });
    if (resp.ok) {
      const body = await resp.json() as any;
      const results = body?.result?.results ?? body?.result?.resources ?? [];
      for (const item of results.slice(0, 200)) {
        const id = await computeHash(`veterans:${item.id ?? item.name ?? Math.random()}`, 'sha256');
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

export async function searchVeterans(query: string): Promise<VeteransIngestionResult> {
  const all = await ingestAllVeterans();
  const q = query.toLowerCase();
  return {
    records: all.records.filter(r => {
      const desc = r.description ?? '';
      return desc.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
    }),
    errors: all.errors,
    durationMs: all.durationMs,
  };
}

export type { VeteransRecord, VeteransIngestionResult } from './types.js';
