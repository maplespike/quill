// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Live upstreams must never gate a deploy. deploy-prod runs the suite with
// SKIP_NETWORK_TESTS=1; PR CI and local runs exercise these for real.
const SKIP_LIVE = process.env.SKIP_NETWORK_TESTS === '1';
const SKIP_LIVE_REASON = 'SKIP_NETWORK_TESTS=1';

describe('gtfs-transit Module', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestGTFSAgency, 'function', 'Should export ingestGTFSAgency');
    assert.equal(typeof mod.ingestAllAgencies, 'function', 'Should export ingestAllAgencies');
    assert.equal(typeof mod.parseGtfsZip, 'function', 'Should export parseGtfsZip');
    assert.equal(typeof mod.parseGtfsRouteCsv, 'function', 'Should export parseGtfsRouteCsv');
    assert.equal(typeof mod.parseGtfsStopCsv, 'function', 'Should export parseGtfsStopCsv');
  });

  it('GTFS_AGENCIES has 30 agencies', async () => {
    const { GTFS_AGENCIES } = await import('../index.js');
    assert.ok(GTFS_AGENCIES.length >= 30, `Expected 30+ agencies, got ${GTFS_AGENCIES.length}`);
    const provinces = [...new Set(GTFS_AGENCIES.map(a => a.province))];
    assert.ok(provinces.length >= 8, `Expected 8+ provinces, got ${provinces.length}`);
  });

  it('parser parses GTFS route CSV', async () => {
    const { parseGtfsRouteCsv } = await import('../index.js');
    const csv = 'route_id,route_short_name,route_long_name,route_type\n101,101,Downtown Express,3\n202,202,Uptown Local,3\n';
    const routes = parseGtfsRouteCsv(csv);
    assert.equal(routes.length, 2);
    assert.equal(routes[0].routeId, '101');
    assert.equal(routes[1].routeLongName, 'Uptown Local');
  });

  it('parser handles empty CSV', async () => {
    const { parseGtfsRouteCsv } = await import('../index.js');
    const routes = parseGtfsRouteCsv('');
    assert.equal(routes.length, 0);
  });

  it('parser parses GTFS stop CSV', async () => {
    const { parseGtfsStopCsv } = await import('../index.js');
    const csv = 'stop_id,stop_name,stop_lat,stop_lon\nS1,Main St,45.5,-73.6\nS2,Elm Ave,45.6,-73.7\n';
    const stops = parseGtfsStopCsv(csv);
    assert.equal(stops.length, 2);
    assert.equal(stops[0].stopName, 'Main St');
    assert.equal(stops[1].stopLat, 45.6);
  });

  it('parser parses trip CSV', async () => {
    const { parseGtfsTripCsv } = await import('../parser.js');
    const csv = 'route_id,service_id,trip_id,direction_id\n101,S1,trip1,0\n202,S2,trip2,1\n';
    const trips = parseGtfsTripCsv(csv);
    assert.equal(trips.length, 2);
    assert.equal(trips[0].routeId, '101');
    assert.equal(trips[1].tripId, 'trip2');
  });

  it('parser parses calendar CSV', async () => {
    const { parseGtfsCalendarCsv } = await import('../parser.js');
    const csv = 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nS1,1,1,1,1,1,0,0,20240101,20241231\n';
    const calendars = parseGtfsCalendarCsv(csv);
    assert.equal(calendars.length, 1);
    assert.equal(calendars[0].serviceId, 'S1');
    assert.ok(calendars[0].days.includes('monday'));
    assert.ok(!calendars[0].days.includes('sunday'));
  });

  it('parser handles CSV with quoted fields', async () => {
    const { parseGtfsRouteCsv } = await import('../index.js');
    const csv = 'route_id,route_short_name,route_long_name,route_type\n101,"10","Downtown Express",3\n';
    const routes = parseGtfsRouteCsv(csv);
    assert.equal(routes.length, 1);
    assert.equal(routes[0].routeLongName, 'Downtown Express');
  });

  it('ingestAllAgencies returns results for all agencies', async () => {
    const { ingestAllAgencies } = await import('../index.js');
    const results = await ingestAllAgencies();
    assert.equal(results.length, (await import('../index.js')).GTFS_AGENCIES.length);
    // All should have at least an agency ID
    results.forEach(r => assert.ok(r.agencyId, 'Each result must have agencyId'));
  });

  it('ingestGTFSAgency returns error for unknown agency', async () => {
    const { ingestGTFSAgency } = await import('../index.js');
    const result = await ingestGTFSAgency('nonexistent');
    assert.ok(result.errors.length > 0);
  });

  it('all agencies have provinces', async () => {
    const { GTFS_AGENCIES } = await import('../index.js');
    for (const a of GTFS_AGENCIES) {
      assert.ok(a.province, `Agency ${a.id} has no province`);
      assert.ok(a.name, `Agency ${a.id} has no name`);
      assert.ok(a.url, `Agency ${a.id} has no url`);
    }
  });
});
