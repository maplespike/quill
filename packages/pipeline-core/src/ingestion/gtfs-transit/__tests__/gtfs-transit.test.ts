import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('gtfs-transit Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestGTFSAgency, 'function', 'Should export ingestGTFSAgency');
    assert.equal(typeof mod.ingestAllAgencies, 'function', 'Should export ingestAllAgencies');
  });

  it('parser parses GTFS route CSV', async () => {
    const { parseGtfsRouteCsv } = await import('../parser.js');
    const csv = 'route_id,route_short_name,route_long_name,route_type\n101,101,Downtown Express,3\n202,202,Uptown Local,3\n';
    const routes = parseGtfsRouteCsv(csv);
    assert.equal(routes.length, 2);
    assert.equal(routes[0].routeId, '101');
    assert.equal(routes[1].routeLongName, 'Uptown Local');
  });

  it('parser handles empty CSV', async () => {
    const { parseGtfsRouteCsv } = await import('../parser.js');
    const routes = parseGtfsRouteCsv('');
    assert.equal(routes.length, 0);
  });

  it('parser parses GTFS stop CSV', async () => {
    const { parseGtfsStopCsv } = await import('../parser.js');
    const csv = 'stop_id,stop_name,stop_lat,stop_lon\nS1,Main St,45.5,-73.6\nS2,Elm Ave,45.6,-73.7\n';
    const stops = parseGtfsStopCsv(csv);
    assert.equal(stops.length, 2);
    assert.equal(stops[0].stopName, 'Main St');
    assert.equal(stops[1].stopLat, 45.6);
  });
});
