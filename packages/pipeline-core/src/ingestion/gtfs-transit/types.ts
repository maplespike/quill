// SPDX-License-Identifier: AGPL-3.0-only

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

export interface GTFSCalendar {
  serviceId: string;
  startDate: string;
  endDate: string;
  days: string[];
}

export interface GTFSAgency {
  id: string;
  name: string;
  province: string;
  url: string;
  gtfsFeedUrl?: string;
  type: string;
}

export interface GtfsIngestionResult {
  agencyId: string;
  agencyName: string;
  province: string;
  routes: GTFSRoute[];
  stops: GTFSStop[];
  trips: GTFSTrip[];
  calendars: GTFSCalendar[];
  errors: string[];
  durationMs: number;
}
