// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import type { GTFSRoute, GTFSStop, GTFSTrip, Agency } from './types.js';
import { GTFS_AGENCIES } from './types.js';

export async function ingestGTFSAgency(agencyId: string) {
  const agency = GTFS_AGENCIES.find(a => a.id === agencyId);
  if (!agency) {
    throw new Error(`Unknown GTFS agency: ${agencyId}`);
  }

  const attribution = buildAttribution(agency.name, {
    sourceUrl: agency.url,
    license: 'Open Data License',
    attributionText: `Source: ${agency.name} Open Data`,
  });

  const data = {
    routes: [] as GTFSRoute[],
    stops: [] as GTFSStop[],
    trips: [] as GTFSTrip[],
    agency: agency as Agency,
  };

  return withAttribution(data, attribution);
}

export async function ingestAllAgencies() {
  const results: Array<{ agencyId: string; success: boolean; error?: string }> = [];

  for (const agency of GTFS_AGENCIES) {
    try {
      await ingestGTFSAgency(agency.id);
      results.push({ agencyId: agency.id, success: true });
    } catch (error) {
      results.push({ agencyId: agency.id, success: false, error: String(error) });
    }
  }

  return results;
}
