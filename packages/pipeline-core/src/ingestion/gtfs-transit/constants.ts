// SPDX-License-Identifier: AGPL-3.0-or-later

export const GTFS_AGENCIES = [
  { id: 'bctransit', name: 'BC Transit', province: 'BC', url: 'https://www.bctransit.com/open-data', type: 'regional' },
  { id: 'stm', name: 'STM (Montreal)', province: 'QC', url: 'https://www.stm.info/en/about/developers', type: 'urban' },
  { id: 'exo', name: 'Exo (Montreal)', province: 'QC', url: 'https://exo.quebec/en/open-data', type: 'regional' },
  { id: 'sto', name: 'STO (Gatineau)', province: 'QC', url: 'https://www.sto.ca/open-data', type: 'urban' },
  { id: 'ttc', name: 'TTC (Toronto)', province: 'ON', url: 'https://www.ttc.ca/About-the-TTC/Open-Data', type: 'urban' },
  { id: 'oc-transpo', name: 'OC Transpo (Ottawa)', province: 'ON', url: 'https://www.octranspo.com/en/plan-your-trip/open-data', type: 'urban' },
  { id: 'yrt', name: 'York Region Transit', province: 'ON', url: 'https://www.yrt.ca/en/about/open-data.aspx', type: 'regional' },
];

export const GTFS_TIMEOUT_MS = 30_000;
export const GTFS_USER_AGENT = 'MapleSpike-GTFS/1.0';

export const GTFS_FEED_URLS: Record<string, string> = {
  bctransit: 'https://bctransit.com/servlet/jbi/gtfs/download',
  stm: 'https://www.stm.info/sites/default/files/gtfs/gtfs_stm.zip',
  exo: 'https://exo.quebec/data/gtfs/2024/gtfs_exo_2024.zip',
  sto: 'https://www.sto.ca/gtfs/gtfs_sto.zip',
  ttc: 'https://www.ttc.ca/GTFS/gtfs.zip',
  'oc-transpo': 'https://www.octranspo.com/gtfs/gtfs.zip',
  yrt: 'https://www.yrt.ca/gtfs/google_transit.zip',
};
