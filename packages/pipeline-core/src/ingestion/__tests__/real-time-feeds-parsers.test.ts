// SPDX-License-Identifier: AGPL-3.0-only
/**
 * real-time-feeds parser tests (GH#921) — fixture-based, no network.
 *
 * The fixtures mirror the live upstream shapes captured 2026-09-23:
 *  - GeoAPI weather-alerts FeatureCollection (api.weather.gc.ca) — the
 *    replacement for the removed flat CAP index
 *  - CBSA #bwttaf HTML table (menu-eng.html) — the replacement for the
 *    removed bwt_taf-eng.json feed
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseGeoApiAlerts, parseCbsaBordersHtml } from '../real-time-feeds/fetcher.js';

/** GeoJSON feature as returned by /collections/weather-alerts/items (live shape). */
const GEOAPI_FIXTURE = {
  type: 'FeatureCollection',
  features: [
    {
      id: '132605352802317227202609200503_fea1-1314',
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[-83.99, 47.22]]] },
      properties: {
        alert_code: 'FTA',
        alert_type: 'advisory',
        alert_name_en: 'frost advisory',
        alert_name_fr: 'avis de gel',
        publication_datetime: '2026-09-23T13:06:18.575Z',
        expiration_datetime: '2026-09-24T05:06:18.575Z',
        alert_text_en: 'Patchy frost will return Thursday morning.',
        risk_colour_en: 'yellow',
        feature_name_en: 'Searchmont - Montreal River Harbour - Batchawan',
      },
    },
    {
      id: 'b-fea2',
      type: 'Feature',
      geometry: null,
      properties: {
        alert_code: 'WRN',
        alert_type: 'warning',
        alert_name_en: 'rainfall warning',
        publication_datetime: '2026-09-23T14:00:00.000Z',
        expiration_datetime: null,
        alert_text_en: 'Heavy rain expected.',
        risk_colour_en: 'red',
        feature_name_en: 'Metro Vancouver',
      },
    },
  ],
  numberMatched: 2,
  numberReturned: 2,
};

describe('parseGeoApiAlerts (ECCC GeoAPI replacement)', () => {
  it('parses features into realtime records with title, region, severity', () => {
    const records = parseGeoApiAlerts(GEOAPI_FIXTURE);
    assert.equal(records.length, 2);

    const [advisory, warning] = records;
    assert.equal(advisory.source, 'eccc-weather-alerts');
    assert.equal(advisory.title, 'Searchmont - Montreal River Harbour - Batchawan — frost advisory');
    assert.equal(advisory.region, 'Searchmont - Montreal River Harbour - Batchawan');
    assert.equal(advisory.publishedAt, '2026-09-23T13:06:18.575Z');
    assert.match(advisory.summary, /Patchy frost/);
    assert.match(advisory.summary, /expires 2026-09-24T05:06:18\.575Z/);

    // alert_type drives severity: warning > advisory.
    assert.equal(advisory.severity, 'low');
    assert.equal(warning.severity, 'high');
  });

  it('returns [] for payloads without a features array', () => {
    assert.deepEqual(parseGeoApiAlerts(null), []);
    assert.deepEqual(parseGeoApiAlerts({}), []);
    assert.deepEqual(parseGeoApiAlerts({ features: 'nope' }), []);
    assert.deepEqual(parseGeoApiAlerts({ features: [null, 5, {}] }), []);
  });
});

/** #bwttaf table row shape as served by menu-eng.html (live, 2026-09-23). */
const CBSA_FIXTURE = `
<html><body>
<table id="bwttaf" class="table">
<thead><tr class="bg-primary">
    <th scope="col">Port of entry<br>Canada/US crossing</th>
    <th scope="col">Commercial flow</th>
    <th scope="col">Travellers flow</th>
    <th scope="col">Updated</th>
</tr></thead>
<tbody>
<tr><th><b>St. Stephen 3rd Bridge</b><br />St. Stephen, NB/Calais, ME<br /></th><td>No Delay</td><td>No Delay</td><td><time datetime="2026-09-23T20:15:16.640-03:00">2026-09-23 20:15 ADT</time></td></tr>
<tr><th><b>St-Bernard-de-Lacolle: Highway 15</b><br />Saint-Bernard-de-Lacolle, QC/Champlain, NY<br /></th><td>No Delay</td><td>45 minutes</td><td><time datetime="2026-09-23T20:00:00.000-04:00">2026-09-23 20:00 EDT</time></td></tr>
<tr><th><b>Niagara Falls Rainbow Bridge</b><br />Niagara Falls, ON/Niagara Falls, NY<br /></th><td>Not Applicable</td><td>2 minutes</td><td><time datetime="2026-09-23T19:54:00.000-04:00">2026-09-23 19:54 EDT</time></td></tr>
</tbody>
</table>
</body></html>
`;

describe('parseCbsaBordersHtml (CBSA HTML replacement)', () => {
  it('parses one record per crossing row, skipping the header', () => {
    const records = parseCbsaBordersHtml(CBSA_FIXTURE);
    assert.equal(records.length, 3);

    const [third, lacolle, rainbow] = records;
    assert.equal(third.source, 'cbsa-border-wait-times');
    assert.equal(third.title, 'St. Stephen 3rd Bridge — travellers No Delay, commercial No Delay');
    assert.equal(third.region, 'St. Stephen, NB/Calais, ME');
    assert.equal(third.publishedAt, '2026-09-23T20:15:16.640-03:00');
    // "No Delay" is a real zero → low severity, not "N/A".
    assert.equal(third.severity, 'low');

    // 45 minutes > 30 → high.
    assert.equal(lacolle.severity, 'high');
    assert.match(lacolle.title, /45 minutes/);

    // "Not Applicable" commercial is fine; travellers 2 minutes → low.
    assert.equal(rainbow.severity, 'low');
  });

  it('returns [] when the bwttaf table is absent (page structure changed)', () => {
    assert.deepEqual(parseCbsaBordersHtml('<html><body>No table here</body></html>'), []);
    assert.deepEqual(parseCbsaBordersHtml('<table id="other"><tr><td>x</td></tr></table>'), []);
  });
});
