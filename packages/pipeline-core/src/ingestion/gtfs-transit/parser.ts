// SPDX-License-Identifier: AGPL-3.0-only

import { unzipSync } from 'node:zlib';
import type { GTFSRoute, GTFSStop, GTFSTrip, GTFSCalendar } from './types.js';

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

function parseCsv<T>(csvText: string, rowFn: (headers: string[], cols: string[]) => T | null): T[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const results: T[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCsvLine(line);
    const row = rowFn(headers, cols);
    if (row) results.push(row);
  }
  return results;
}

export function parseGtfsRouteCsv(csvData: string): GTFSRoute[] {
  return parseCsv<GTFSRoute>(csvData, (headers, cols) => {
    const routeId = cols[headers.indexOf('route_id')];
    const routeShortName = cols[headers.indexOf('route_short_name')] ?? '';
    const routeLongName = cols[headers.indexOf('route_long_name')] ?? '';
    const routeType = parseInt(cols[headers.indexOf('route_type')] ?? '0', 10);
    const routeColor = cols[headers.indexOf('route_color')] ?? undefined;
    if (routeId && routeLongName) {
      return { routeId, agency: '', routeShortName, routeLongName, routeType, routeColor };
    }
    return null;
  });
}

export function parseGtfsStopCsv(csvData: string): GTFSStop[] {
  return parseCsv<GTFSStop>(csvData, (headers, cols) => {
    const stopId = cols[headers.indexOf('stop_id')];
    const stopName = cols[headers.indexOf('stop_name')];
    const stopLat = parseFloat(cols[headers.indexOf('stop_lat')] ?? '0');
    const stopLon = parseFloat(cols[headers.indexOf('stop_lon')] ?? '0');
    if (stopId && stopName) {
      return { stopId, stopName, stopLat, stopLon, agency: '' };
    }
    return null;
  });
}

export function parseGtfsTripCsv(csvData: string): GTFSTrip[] {
  return parseCsv<GTFSTrip>(csvData, (headers, cols) => {
    const tripId = cols[headers.indexOf('trip_id')];
    const routeId = cols[headers.indexOf('route_id')];
    const serviceId = cols[headers.indexOf('service_id')];
    const direction = cols[headers.indexOf('direction_id')] ?? '0';
    if (tripId && routeId) {
      return { tripId, routeId, serviceId: serviceId ?? '', direction, agency: '' };
    }
    return null;
  });
}

export function parseGtfsCalendarCsv(csvData: string): GTFSCalendar[] {
  return parseCsv<GTFSCalendar>(csvData, (headers, cols) => {
    const serviceId = cols[headers.indexOf('service_id')];
    const startDate = cols[headers.indexOf('start_date')] ?? '';
    const endDate = cols[headers.indexOf('end_date')] ?? '';
    if (!serviceId) return null;
    const dayFields = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const days: string[] = [];
    for (const day of dayFields) {
      const idx = headers.indexOf(day);
      if (idx >= 0 && cols[idx] === '1') days.push(day);
    }
    return { serviceId, startDate, endDate, days };
  });
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

function extractZipBuffer(zipBuf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  // Minimal ZIP parser: look for local file headers (PK\x03\x04)
  let pos = 0;
  while (pos < zipBuf.length - 30) {
    if (zipBuf[pos] === 0x50 && zipBuf[pos + 1] === 0x4b && zipBuf[pos + 2] === 0x03 && zipBuf[pos + 3] === 0x04) {
      const compressMethod = zipBuf.readUInt16LE(pos + 8);
      const compressSize = zipBuf.readUInt32LE(pos + 18);
      const uncompSize = zipBuf.readUInt32LE(pos + 22);
      const nameLen = zipBuf.readUInt16LE(pos + 26);
      const extraLen = zipBuf.readUInt16LE(pos + 28);
      const name = zipBuf.subarray(pos + 30, pos + 30 + nameLen).toString('utf-8');
      const dataStart = pos + 30 + nameLen + extraLen;
      let data: Buffer;
      if (compressMethod === 0) {
        data = Buffer.from(zipBuf.subarray(dataStart, dataStart + uncompSize));
      } else if (compressMethod === 8) {
        data = Buffer.from(unzipSync(zipBuf.subarray(dataStart, dataStart + compressSize)));
      } else {
        pos = dataStart + compressSize;
        continue;
      }
      entries.push({ name, data });
      pos = dataStart + compressSize;
    } else {
      pos++;
    }
  }
  return entries;
}

export function parseGtfsZip(zipBuf: Buffer, agencyName: string): {
  routes: GTFSRoute[];
  stops: GTFSStop[];
  trips: GTFSTrip[];
  calendars: GTFSCalendar[];
  errors: string[];
} {
  const entries = extractZipBuffer(zipBuf);
  const errors: string[] = [];
  let routes: GTFSRoute[] = [];
  let stops: GTFSStop[] = [];
  let trips: GTFSTrip[] = [];
  let calendars: GTFSCalendar[] = [];

  const findEntry = (name: string, required = false): string | null => {
    // Exact match first, then subdirectory entries (name inside a nested
    // folder). The exact match prevents mis-matching stops.txt when looking
    // for routes.txt, etc.
    const entry = entries.find(e => e.name === name || e.name.endsWith('/' + name));
    if (!entry) {
      if (required) errors.push(`Missing required GTFS file: ${name}`);
      return null;
    }
    return entry.data.toString('utf-8');
  };

  const routesCsv = findEntry('routes.txt', true);
  if (routesCsv) {
    routes = parseGtfsRouteCsv(routesCsv);
    routes.forEach(r => r.agency = agencyName);
  }

  const stopsCsv = findEntry('stops.txt', true);
  if (stopsCsv) {
    stops = parseGtfsStopCsv(stopsCsv);
    stops.forEach(s => s.agency = agencyName);
  }

  const tripsCsv = findEntry('trips.txt', true);
  if (tripsCsv) {
    trips = parseGtfsTripCsv(tripsCsv);
    trips.forEach(t => t.agency = agencyName);
  }

  const calendarCsv = findEntry('calendar.txt');
  if (calendarCsv) {
    calendars = parseGtfsCalendarCsv(calendarCsv);
  }

  // Try calendar_dates as fallback
  if (calendars.length === 0) {
    const calDatesCsv = findEntry('calendar_dates.txt');
    if (calDatesCsv) {
      calendars = parseCsv<GTFSCalendar>(calDatesCsv, (headers, cols) => {
        const serviceId = cols[headers.indexOf('service_id')];
        const date = cols[headers.indexOf('date')] ?? '';
        if (!serviceId) return null;
        return { serviceId, startDate: date, endDate: date, days: [] };
      });
    }
  }

  return { routes, stops, trips, calendars, errors };
}
