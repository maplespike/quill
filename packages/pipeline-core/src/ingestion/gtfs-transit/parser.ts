// SPDX-License-Identifier: AGPL-3.0-or-later

export function parseGtfsRouteCsv(csvData: string): Array<{
  routeId: string; routeShortName: string; routeLongName: string; routeType: number;
}> {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const results: Array<{ routeId: string; routeShortName: string; routeLongName: string; routeType: number }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const routeId = cols[header.indexOf('route_id')]?.trim();
    const routeShortName = cols[header.indexOf('route_short_name')]?.trim() ?? '';
    const routeLongName = cols[header.indexOf('route_long_name')]?.trim() ?? '';
    const routeType = parseInt(cols[header.indexOf('route_type')]?.trim() ?? '0', 10);
    if (routeId && routeLongName) {
      results.push({ routeId, routeShortName, routeLongName, routeType });
    }
  }
  return results;
}

export function parseGtfsStopCsv(csvData: string): Array<{
  stopId: string; stopName: string; stopLat: number; stopLon: number;
}> {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const results: Array<{ stopId: string; stopName: string; stopLat: number; stopLon: number }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const stopId = cols[header.indexOf('stop_id')]?.trim();
    const stopName = cols[header.indexOf('stop_name')]?.trim();
    const stopLat = parseFloat(cols[header.indexOf('stop_lat')]?.trim() ?? '0');
    const stopLon = parseFloat(cols[header.indexOf('stop_lon')]?.trim() ?? '0');
    if (stopId && stopName) {
      results.push({ stopId, stopName, stopLat, stopLon });
    }
  }
  return results;
}
