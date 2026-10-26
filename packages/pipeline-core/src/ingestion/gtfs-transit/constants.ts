// SPDX-License-Identifier: AGPL-3.0-only

export interface Agency {
  id: string;
  name: string;
  province: string;
  url: string;
  type: string;
}

export const GTFS_AGENCIES: Agency[] = [
  // ── British Columbia ─────────────────────────────────────────
  { id: 'translink', name: 'TransLink (Vancouver)', province: 'BC', url: 'https://www.translink.ca/about-us/doing-business-with-translink/app-developer-resources/gtfs/gtfs-data', type: 'urban' },
  { id: 'bctransit', name: 'BC Transit', province: 'BC', url: 'https://www.bctransit.com/open-data', type: 'regional' },
  { id: 'bcferries', name: 'BC Ferries', province: 'BC', url: 'https://www.bcferries.com', type: 'ferry' },

  // ── Alberta ──────────────────────────────────────────────────
  { id: 'calgary', name: 'Calgary Transit', province: 'AB', url: 'https://data.calgary.ca/Transportation-Transit/Calgary-Transit-Scheduling-Data/npk7-z3bj', type: 'urban' },
  { id: 'edmonton', name: 'Edmonton Transit (ETS)', province: 'AB', url: 'https://data.edmonton.ca/Transit/GTFS-Downloads/yiem-dcbw', type: 'urban' },
  { id: 'lethbridge', name: 'Lethbridge Transit', province: 'AB', url: 'https://www.lethbridge.ca', type: 'urban' },
  { id: 'red-deer', name: 'Red Deer Transit', province: 'AB', url: 'https://www.reddeer.ca', type: 'urban' },

  // ── Saskatchewan ─────────────────────────────────────────────
  { id: 'saskatoon', name: 'Saskatoon Transit', province: 'SK', url: 'https://www.saskatoon.ca/moving-around/transit/open-data-saskatoon-transit', type: 'urban' },
  { id: 'regina', name: 'Regina Transit', province: 'SK', url: 'https://opendata.regina.ca', type: 'urban' },

  // ── Manitoba ─────────────────────────────────────────────────
  { id: 'winnipeg', name: 'Winnipeg Transit', province: 'MB', url: 'https://api.winnipegtransit.com/', type: 'urban' },

  // ── Ontario ──────────────────────────────────────────────────
  { id: 'ttc', name: 'TTC (Toronto)', province: 'ON', url: 'https://open.toronto.ca/dataset/ttc-routes-and-schedules/', type: 'urban' },
  { id: 'oc-transpo', name: 'OC Transpo (Ottawa)', province: 'ON', url: 'https://www.octranspo.com/en/plan-your-trip/travel-tools/developers/dev-doc', type: 'urban' },
  { id: 'go-transit', name: 'GO Transit', province: 'ON', url: 'https://www.gotransit.com/en/partner-with-us/software-developers', type: 'regional' },
  { id: 'miway', name: 'MiWay (Mississauga)', province: 'ON', url: 'https://www.mississauga.ca/miway-transit/developer-download/', type: 'urban' },
  { id: 'brampton', name: 'Brampton Transit', province: 'ON', url: 'https://geohub.brampton.ca/pages/brampton-transit', type: 'urban' },
  { id: 'yrt', name: 'York Region Transit', province: 'ON', url: 'https://www.yrt.ca/en/about/open-data.aspx', type: 'regional' },
  { id: 'durham', name: 'Durham Region Transit', province: 'ON', url: 'https://www.durhamregiontransit.com/en/about-us/region-of-durham-open-data-program.aspx', type: 'regional' },
  { id: 'hsr', name: 'Hamilton Street Railway', province: 'ON', url: 'https://open.hamilton.ca', type: 'urban' },
  { id: 'london', name: 'London Transit', province: 'ON', url: 'https://data.london.ca', type: 'urban' },
  { id: 'grand-river', name: 'Grand River Transit (Waterloo)', province: 'ON', url: 'https://open.kitchener.ca', type: 'urban' },
  { id: 'windsor', name: 'Windsor Transit', province: 'ON', url: 'https://www.citywindsor.ca', type: 'urban' },
  { id: 'guelph', name: 'Guelph Transit', province: 'ON', url: 'https://guelph.ca', type: 'urban' },

  // ── Quebec ───────────────────────────────────────────────────
  { id: 'stm', name: 'STM (Montreal)', province: 'QC', url: 'https://www.stm.info/en/about/developers', type: 'urban' },
  { id: 'exo', name: 'Exo (Montreal)', province: 'QC', url: 'https://exo.quebec/en/open-data', type: 'regional' },
  { id: 'sto', name: 'STO (Gatineau)', province: 'QC', url: 'https://www.sto.ca/open-data', type: 'urban' },
  { id: 'rtc', name: 'RTC (Quebec City)', province: 'QC', url: 'https://www.rtcquebec.ca', type: 'urban' },
  { id: 'rtl', name: 'RTL (Longueuil)', province: 'QC', url: 'https://www.rtl-longueuil.qc.ca', type: 'urban' },

  // ── Nova Scotia ──────────────────────────────────────────────
  { id: 'halifax', name: 'Halifax Transit', province: 'NS', url: 'https://www.halifax.ca/transportation/halifax-transit/transit-technology/general-transit-feed-gtfs', type: 'urban' },

  // ── New Brunswick ────────────────────────────────────────────
  { id: 'codiac', name: 'Codiac Transpo (Moncton)', province: 'NB', url: 'https://www.moncton.ca', type: 'urban' },

  // ── Newfoundland ─────────────────────────────────────────────
  { id: 'metrobus', name: 'Metrobus (St. John\'s)', province: 'NL', url: 'https://www.metrobus.com', type: 'urban' },

  // ── Intercity ────────────────────────────────────────────────
  { id: 'viarail', name: 'VIA Rail', province: 'CA', url: 'https://www.viarail.ca', type: 'rail' },
];

export const GTFS_TIMEOUT_MS = 60_000;
export const GTFS_USER_AGENT = 'MapleSpike-GTFS/2.0';

export const GTFS_FEED_URLS: Record<string, string> = {
  // BC
  translink: 'https://gtfs-static.translink.ca/gtfs/google_transit.zip',
  bctransit: 'https://bctransit.com/servlet/jbi/gtfs/download',
  bcferries: '',

  // AB
  calgary: 'https://data.calgary.ca/download/npk7-z3bj/application/zip',
  edmonton: 'https://gtfs.edmonton.ca/TMGTFSRealTimeWebService/GTFS/gtfs.zip',
  lethbridge: '',
  'red-deer': '',

  // SK
  saskatoon: 'http://apps2.saskatoon.ca/app/data/google_transit.zip',
  regina: '',

  // MB
  winnipeg: 'http://gtfs.winnipegtransit.com/google_transit.zip',

  // ON
  ttc: 'https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/7795b45e-e65a-4465-81fc-c36b9dfff169/resource/cfb6b2b8-6191-41e3-bda1-b175c51148cb/download/TTC%20Routes%20and%20Schedules%20Data.zip',
  'oc-transpo': 'https://oct-gtfs-emasagcnfmcgeham.z01.azurefd.net/public-access/GTFSExport.zip',
  'go-transit': 'https://assets.metrolinx.com/raw/upload/v1683228856/Documents/Metrolinx/Open%20Data/GO-GTFS.zip',
  miway: 'https://www.miapp.ca/GTFS/google_transit.zip',
  brampton: 'https://www.arcgis.com/sharing/rest/content/items/a355aabd5a8c490186bdce559c9c75fb/data',
  yrt: 'https://www.yrt.ca/gtfs/google_transit.zip',
  durham: 'https://maps.durham.ca/OpenDataGTFS/GTFS_Durham_TXT.zip',
  hsr: 'https://opendata.hamilton.ca/GTFS-Static/google_transit.zip',
  london: '',
  'grand-river': '',
  windsor: '',
  guelph: '',

  // QC
  stm: 'https://www.stm.info/sites/default/files/gtfs/gtfs_stm.zip',
  exo: 'https://exo.quebec/data/gtfs/gtfs_exo_2025.zip',
  sto: 'https://www.sto.ca/gtfs/gtfs_sto.zip',
  rtc: '',
  rtl: '',

  // NS
  halifax: 'https://gtfs.halifax.ca/static/google_transit.zip',

  // NB
  codiac: '',

  // NL
  metrobus: '',

  // Intercity
  viarail: '',
};
