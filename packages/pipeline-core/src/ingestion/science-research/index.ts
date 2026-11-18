// SPDX-License-Identifier: AGPL-3.0-only
import { fetchCsaMissions } from './csa.js';
import { fetchMitacsGrants } from './mitacs.js';
import { fetchOceanObservations, fetchPolarRecords } from './onc.js';
import type { ScienceIngestionResult } from './types.js';

export { fetchCsaMissions } from './csa.js';
export { fetchMitacsGrants } from './mitacs.js';
export { fetchOceanObservations, fetchPolarRecords } from './onc.js';
export type { ResearchGrant, SpaceMission, OceanObservation, PolarRecord, ScienceIngestionResult } from './types.js';

export async function ingestAllScience(): Promise<ScienceIngestionResult> {
  const [csa, mitacs, [observations, polar]] = await Promise.all([
    fetchCsaMissions(),
    fetchMitacsGrants(),
    Promise.all([fetchOceanObservations(), fetchPolarRecords()]),
  ]);

  return {
    grants: [...csa.grants, ...mitacs],
    missions: csa.missions,
    observations,
    polar,
    errors: [],
  };
}

export async function searchScience(query: string): Promise<ScienceIngestionResult> {
  const all = await ingestAllScience();
  const q = query.toLowerCase();

  return {
    grants: all.grants.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.recipient.toLowerCase().includes(q) ||
      g.program.toLowerCase().includes(q)
    ),
    missions: all.missions.filter(m =>
      m.mission.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q)
    ),
    observations: all.observations.filter(o =>
      o.station.toLowerCase().includes(q) ||
      o.region.toLowerCase().includes(q)
    ),
    polar: all.polar.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.investigator.toLowerCase().includes(q) ||
      p.organization.toLowerCase().includes(q)
    ),
    errors: [],
  };
}
