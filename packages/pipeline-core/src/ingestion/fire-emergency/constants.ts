// SPDX-License-Identifier: AGPL-3.0-only

export const FIRE_DEPARTMENTS = [
  { city: 'Edmonton', province: 'AB', url: 'https://data.edmonton.ca/api/id/c6f4-cgw5.json' },
  { city: 'Montreal', province: 'QC', url: 'https://donnees.montreal.ca/api/3/action/datastore_search?resource_id=7b6b2c1f-c83b-4ba3-84b2-e3d4aef2f36b' },
  { city: 'Quebec City', province: 'QC', url: 'https://www.ville.quebec.qc.ca/open_data/json/donnees_services_incendie.json' },
  { city: 'Sherbrooke', province: 'QC', url: 'https://www.donneesquebec.ca/api/3/action/datastore_search?resource_id=2f5c58a5-6f5e-4f24-a63f-cb96c0c62ef2' },
];

export const FIRE_TIMEOUT_MS = 15_000;
export const FIRE_USER_AGENT = 'MapleSpike-Fire/1.0';
