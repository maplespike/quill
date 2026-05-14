export const CROSS_REF_TIMEOUT_MS = 30_000;
export const CROSS_REF_UA = 'MapleSpike-CrossReference/1.0';
export const MAX_MATCHES_PER_SOURCE = 50;

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
