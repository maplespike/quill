// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { TRIBUNAL_SOURCES } from './constants.js';
import type { TribunalDecision, TribunalCase, TribunalIngestionResult, TribunalName } from './types.js';
import { toTribunalDecision } from './parser.js';

export { TRIBUNAL_SOURCES } from './constants.js';
export type { TribunalDecision, TribunalCase, TribunalIngestionResult, TribunalName } from './types.js';

async function fetchTribunalDecisions(tribunal: TribunalName): Promise<TribunalDecision[]> {
  const source = TRIBUNAL_SOURCES[tribunal];
  if (!source.hasDecisions) return [];

  const decisions: TribunalDecision[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(source.searchUrl, {
      headers: { Accept: 'text/html,application/json' },
      timeoutMs: 10000,
    });

    if (resp.statusCode >= 400) return decisions;

    const html = resp.body;

    if (html.includes('{') && html.includes('"')) {
      try {
        const json = JSON.parse(html) as Record<string, unknown>;
        const items = (json.results || json.data || json.items || []) as Record<string, unknown>[];
        for (const item of items) {
          const parsed = await toTribunalDecision(item, tribunal, source.name, source.baseUrl, now);
          if (parsed) decisions.push(parsed);
        }
      } catch {
      }
    }
  } catch {
  }

  return decisions;
}

export async function ingestAllTribunals(): Promise<TribunalIngestionResult> {
  const results = await Promise.allSettled(
    (Object.keys(TRIBUNAL_SOURCES) as TribunalName[]).map(fetchTribunalDecisions),
  );

  const decisions: TribunalDecision[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      decisions.push(...result.value);
    } else {
      errors.push(result.reason?.message ?? 'unknown');
    }
  }

  return { decisions, cases: [], errors };
}

export async function searchTribunals(query: string): Promise<TribunalIngestionResult> {
  const all = await ingestAllTribunals();
  const q = query.toLowerCase();

  return {
    decisions: all.decisions.filter(d =>
      d.title.toLowerCase().includes(q) ||
      d.caseNumber.toLowerCase().includes(q) ||
      d.applicant.toLowerCase().includes(q) ||
      d.tribunal.toLowerCase().includes(q)
    ),
    cases: [],
    errors: all.errors,
  };
}
