// SPDX-License-Identifier: AGPL-3.0-only
export const CROSS_REF_TIMEOUT_MS = 30_000;
export const CROSS_REF_UA = 'MapleSpike-CrossReference/1.0';
export const MAX_MATCHES_PER_SOURCE = 50;

export const MIN_SOURCES_DEFAULT = 2;
export const MIN_SOURCES_STRICT = 3;
export const MIN_TRUST_HIGH_SENSITIVITY = 60;

/** Module authority scores for trust calculation */
export const MODULE_AUTHORITY: Record<string, number> = {
  statcan: 95,
  elections: 92,
  gic: 90,
  canlii: 88,
  committees: 85,
  lobbying: 82,
  'proactive-disclosure': 80,
  influence: 70,
  'crown-corporations': 75,
  'cra-charity': 78,
};

/** Modules to cross-reference, in priority order */
export const CROSS_REF_MODULES = [
  { id: 'lobbying', name: 'Federal Lobbying Registry', priority: 1 },
  { id: 'gic', name: 'GIC Appointments', priority: 2 },
  { id: 'committees', name: 'Parliamentary Committees', priority: 3 },
  { id: 'elections', name: 'Elections & Campaign Finance', priority: 4 },
  { id: 'proactive-disclosure', name: 'Government Contracts', priority: 5 },
  { id: 'influence', name: 'Influence Tracking', priority: 6 },
  { id: 'canlii', name: 'Court Decisions', priority: 7 },
] as const;
