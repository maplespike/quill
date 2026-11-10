// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { SOURCES } from './constants.js';
import type { SpaceMission, ResearchGrant } from './types.js';
import { toSpaceMission } from './parser.js';

export async function fetchCsaMissions(): Promise<{ missions: SpaceMission[]; grants: ResearchGrant[] }> {
  const missions: SpaceMission[] = [];
  const grants: ResearchGrant[] = [];
  const errors: string[] = [];

  try {
    const resp = await httpGet(`${SOURCES.CSA.baseUrl}/api/missions`, {
      headers: { Accept: 'application/json' },
      timeoutMs: 10000,
    });

    if (resp.statusCode < 400) {
      const data = (await resp.json()) as Record<string, unknown>[];
      const now = new Date().toISOString();

      for (const raw of data) {
        const parsed = await toSpaceMission(raw, now);
        if (parsed) {
          parsed.sourceUrl = `${SOURCES.CSA.baseUrl}/eng/missions/${raw.id ?? ''}`;
          missions.push(parsed);
        }
      }
    }
  } catch (err) {
    errors.push(`CSA missions: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  return { missions, grants };
}
