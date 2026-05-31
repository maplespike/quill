// SPDX-License-Identifier: AGPL-3.0-or-later

export const POLICE_AGENCIES = [
  { city: 'Edmonton', province: 'AB', url: 'https://data.edmonton.ca/api/id/3g2k-6k6q.json' },
  { city: 'Montreal', province: 'QC', url: 'https://donnees.montreal.ca/api/3/action/datastore_search?resource_id=939bdd77-db08-42da-a24f-16c79cf35dd3' },
  { city: 'Quebec City', province: 'QC', url: 'https://www.ville.quebec.qc.ca/open_data/json/donnees_police.json' },
  { city: 'Sherbrooke', province: 'QC', url: 'https://www.donneesquebec.ca/recherche/api/3/action/datastore_search?resource_id=b9d3e1a7-6a8a-4f2b-9b0b-5df5c5c5c5c5' },
  { city: 'Calgary', province: 'AB', url: 'https://data.calgary.ca/api/id/78rh-nagg.json' },
  { city: 'Vancouver', province: 'BC', url: 'https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/police-data/records' },
];

export const POLICE_TIMEOUT_MS = 15_000;
export const POLICE_USER_AGENT = 'MapleSpike-Police/1.0';
