// SPDX-License-Identifier: AGPL-3.0-only
import { computeHash } from '../../verification/hashing.js';

export const SOURCE_AUTHORITY: Record<string, number> = {
  'statcan': 95,
  'elections': 92,
  'gic': 90,
  'canlii': 88,
  'committees': 85,
  'lobbying': 82,
  'proactive-disclosure': 80,
  'influence': 70,
};

export const MIN_SOURCES_DEFAULT = 2;
export const MIN_TRUST_HIGH_SENSITIVITY = 60;

export interface TrustScore {
  overall: number;
  sourceAuthority: number;
  recencyScore: number;
  consistencyScore: number;
  nSourceConfidence: number;
  minSourcesRequired: number;
  passedThreshold: boolean;
  citationHash: string;
}

function recencyScore(dateStr: string): number {
  if (!dateStr) return 50;
  const d = new Date(dateStr).getTime();
  const now = Date.now();
  const days = (now - d) / 86400000;
  if (days < 7) return 100;
  if (days < 30) return 90;
  if (days < 90) return 75;
  if (days < 365) return 50;
  return 25;
}

function nSourceConfidence(sourceCount: number, minRequired: number): number {
  if (sourceCount === 0) return 0;
  if (sourceCount >= minRequired + 2) return 100;
  if (sourceCount >= minRequired + 1) return 80;
  if (sourceCount >= minRequired) return 60;
  return 30;
}

function consistencyScore(sourceCount: number): number {
  return Math.min(sourceCount * 15, 100);
}

export async function calculateTrustScore(
  sourceAuthorities: number[],
  dates: string[],
  entity: string,
  moduleNames: string[],
  options?: { minSources?: number; highSensitivity?: boolean },
): Promise<TrustScore> {
  const minRequired = options?.minSources ?? MIN_SOURCES_DEFAULT;
  const highSens = options?.highSensitivity ?? false;

  const avgAuthority = sourceAuthorities.length > 0
    ? sourceAuthorities.reduce((a, b) => a + b, 0) / sourceAuthorities.length
    : 0;

  const avgRecency = dates.length > 0
    ? dates.reduce((a, b) => a + recencyScore(b), 0) / dates.length
    : 0;

  const uniqueModules = new Set(moduleNames).size;
  const consistency = consistencyScore(uniqueModules);
  const nSourceConf = nSourceConfidence(uniqueModules, minRequired);

  const overall = Math.round(
    avgAuthority * 0.35 + avgRecency * 0.25 + consistency * 0.2 + nSourceConf * 0.2,
  );

  const threshold = highSens ? MIN_TRUST_HIGH_SENSITIVITY : 0;

  const contentForHash = JSON.stringify({
    entity,
    sources: moduleNames.sort(),
    authority: Math.round(avgAuthority),
    recency: Math.round(avgRecency),
    consistency,
    score: overall,
    timestamp: new Date().toISOString(),
  });
  const citationHash = await computeHash(contentForHash, 'sha256');

  return {
    overall,
    sourceAuthority: Math.round(avgAuthority),
    recencyScore: Math.round(avgRecency),
    consistencyScore: Math.round(consistency),
    nSourceConfidence: Math.round(nSourceConf),
    minSourcesRequired: minRequired,
    passedThreshold: overall >= threshold,
    citationHash,
  };
}
