import { SOURCES } from './constants.js';
import type { SpaceMission, ResearchGrant } from './types.js';
import { computeHash } from '../../verification/hashing.js';

export async function fetchCsaMissions(): Promise<{ missions: SpaceMission[]; grants: ResearchGrant[] }> {
  const missions: SpaceMission[] = [];
  const grants: ResearchGrant[] = [];
  const errors: string[] = [];

  try {
    const resp = await fetch(`${SOURCES.CSA.baseUrl}/api/missions`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (resp.ok) {
      const data = (await resp.json()) as Record<string, unknown>[];
      const now = new Date().toISOString();

      for (const raw of data) {
        const id = await computeHash(`csa:mission:${raw.id ?? raw.name}`, 'sha256');
        missions.push({
          id,
          mission: String(raw.name ?? ''),
          agency: 'csa',
          status: mapStatus(String(raw.status ?? '')),
          launchYear: raw.launchYear ? Number(raw.launchYear) : null,
          description: String(raw.description ?? ''),
          budgetCad: raw.budget ? Number(raw.budget) : null,
          sourceUrl: `${SOURCES.CSA.baseUrl}/eng/missions/${raw.id ?? ''}`,
          ingestedAt: now,
        });
      }
    }
  } catch (err) {
    errors.push(`CSA missions: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  return { missions, grants };
}

function mapStatus(raw: string): SpaceMission['status'] {
  const s = raw.toLowerCase();
  if (s.includes('operational') || s.includes('active')) return 'active';
  if (s.includes('complete') || s.includes('ended')) return 'completed';
  if (s.includes('plan') || s.includes('future')) return 'planned';
  if (s.includes('cancel')) return 'cancelled';
  return 'planned';
}
