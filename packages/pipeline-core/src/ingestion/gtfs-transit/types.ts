// SPDX-License-Identifier: AGPL-3.0-or-later

export interface GTFSRoute {
  routeId: string;
  agency: string;
  routeShortName: string;
  routeLongName: string;
  routeType: number;
  routeColor?: string;
}

export interface GTFSStop {
  stopId: string;
  stopName: string;
  stopLat: number;
  stopLon: number;
  agency: string;
}

export interface GTFSTrip {
  tripId: string;
  routeId: string;
  serviceId: string;
  direction: string;
  agency: string;
}

export interface Agency {
  id: string;
  name: string;
  province: string;
  url: string;
  gtfsFeedUrl?: string;
  type: string;
}

export const GTFS_AGENCIES: Agency[] = [
  { id: 'bctransit', name: 'BC Transit', province: 'BC', url: 'https://www.bctransit.com/open-data', type: 'regional' },
  { id: 'stm', name: 'STM (Montreal)', province: 'QC', url: 'https://www.stm.info/en/about/developers', type: 'urban' },
  { id: 'exo', name: 'Exo (Montreal)', province: 'QC', url: 'https://exo.quebec/en/open-data', type: 'regional' },
  { id: 'sto', name: 'STO (Gatineau)', province: 'QC', url: 'https://www.sto.ca/open-data', type: 'urban' },
  { id: 'ttc', name: 'TTC (Toronto)', province: 'ON', url: 'https://www.ttc.ca/About-the-TTC/Open-Data', type: 'urban' },
  { id: 'oc-transpo', name: 'OC Transpo (Ottawa)', province: 'ON', url: 'https://www.octranspo.com/en/plan-your-trip/open-data', type: 'urban' },
  { id: 'yrt', name: 'York Region Transit', province: 'ON', url: 'https://www.yrt.ca/en/about/open-data.aspx', type: 'regional' },
];
