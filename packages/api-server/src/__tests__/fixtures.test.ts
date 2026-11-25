/**
 * Synthetic fixture routes.
 *
 * The records must be obviously fake, and the routes must stay off
 * unless QUILL_FIXTURES=1, including when NODE_ENV is production.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  FIXTURE_MARKER,
  FIXTURE_NOTICE,
  SYNTHETIC_FIXTURES,
  fixturesEnabled,
} from '../mock-data.js';
import { fixtureItemHandler, fixtureListHandler } from '../routes/mock.js';
import { isFreeTierRoute } from '../feature-gates.js';
import type { RouteContext } from '../types.js';

const REAL_CONTENT = [
  /trudeau/i,
  /poilievre/i,
  /standing committee/i,
  /house of commons/i,
  /senate of canada/i,
  /parliament of canada/i,
  /bill c-\d/i,
  /bill s-\d/i,
];

function ctx(env: Record<string, string | undefined>): RouteContext {
  return {
    tenant: {
      id: 'fixture-test',
      name: 'Fixture Tester',
      emailVerified: true,
      tier: 'free',
      isActive: true,
      journalismMode: false,
    },
    apiKeyId: '',
    requestId: 'fixture-req',
    startTime: Date.now(),
    env,
    db: {} as RouteContext['db'],
    cache: {} as RouteContext['cache'],
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await response.text()) as Record<string, unknown>;
}

describe('synthetic fixtures', () => {
  it('marks every record as a fake FIXTURE', () => {
    assert.ok(SYNTHETIC_FIXTURES.length >= 3);
    const blob = JSON.stringify(SYNTHETIC_FIXTURES);
    for (const row of SYNTHETIC_FIXTURES) {
      assert.equal(row.synthetic, true);
      assert.equal(row.marker, FIXTURE_MARKER);
      assert.match(row.id, /^fixture-/);
      assert.match(`${row.title} ${row.actor}`, /Fixture|Example|Sample/);
    }
    for (const pattern of REAL_CONTENT) {
      assert.equal(pattern.test(blob), false, `fixture text matched ${pattern}`);
    }
    assert.match(FIXTURE_NOTICE, /synthetic fixtures/i);
  });

  it('stays off in production unless QUILL_FIXTURES=1', () => {
    assert.equal(fixturesEnabled({ NODE_ENV: 'production' }), false);
    assert.equal(fixturesEnabled({ NODE_ENV: 'production', QUILL_FIXTURES: '' }), false);
    assert.equal(fixturesEnabled({ NODE_ENV: 'development' }), false);
    assert.equal(fixturesEnabled({ NODE_ENV: 'test' }), false);
    assert.equal(fixturesEnabled({ QUILL_FIXTURES: '0', NODE_ENV: 'production' }), false);
    assert.equal(fixturesEnabled({ NODE_ENV: 'production', QUILL_FIXTURES: '1' }), true);
    assert.equal(fixturesEnabled({ QUILL_FIXTURES: 'true' }), true);
    assert.equal(fixturesEnabled({ QUILL_FIXTURES: 'yes' }), true);
  });

  it('serves fixtures only when enabled, and says so', async () => {
    const off = await fixtureListHandler(
      new Request('http://localhost/v1/fixtures'),
      ctx({ NODE_ENV: 'production' }),
      {},
    );
    assert.equal(off.status, 404);
    const offBody = await readJson(off);
    const offText = JSON.stringify(offBody);
    assert.match(offText, /synthetic fixtures/i);
    assert.match(offText, /QUILL_FIXTURES=1/);
    assert.match(offText, /Production stays off/);
    assert.equal(offText.includes('Alex Exampleton'), false);
    assert.equal(off.headers.get('X-Quill-Data'), 'fixture');

    const on = await fixtureListHandler(
      new Request('http://localhost/v1/fixtures'),
      ctx({ NODE_ENV: 'production', QUILL_FIXTURES: '1' }),
      {},
    );
    assert.equal(on.status, 200);
    const onBody = await readJson(on);
    const data = onBody.data as {
      serves: string;
      notice: string;
      synthetic: boolean;
      marker: string;
      records: Array<{ synthetic: boolean; marker: string }>;
    };
    assert.equal(data.serves, 'synthetic-fixtures');
    assert.equal(data.synthetic, true);
    assert.equal(data.marker, 'FIXTURE');
    assert.match(data.notice, /synthetic fixtures/i);
    assert.equal(data.records.length, SYNTHETIC_FIXTURES.length);
    for (const row of data.records) {
      assert.equal(row.synthetic, true);
      assert.equal(row.marker, 'FIXTURE');
    }
  });

  it('returns one fixture by id and 404 for an unknown id', async () => {
    const enabled = { QUILL_FIXTURES: '1' };
    const hit = await fixtureItemHandler(
      new Request('http://localhost/v1/fixtures/fixture-person-001'),
      ctx(enabled),
      { id: 'fixture-person-001' },
    );
    assert.equal(hit.status, 200);
    const hitBody = await readJson(hit);
    const data = hitBody.data as { serves: string; record: { actor: string; synthetic: boolean } };
    assert.equal(data.serves, 'synthetic-fixtures');
    assert.equal(data.record.actor, 'Blair Fixture');
    assert.equal(data.record.synthetic, true);

    const miss = await fixtureItemHandler(
      new Request('http://localhost/v1/fixtures/not-a-record'),
      ctx(enabled),
      { id: 'not-a-record' },
    );
    assert.equal(miss.status, 404);
    const missText = JSON.stringify(await readJson(miss));
    assert.match(missText, /synthetic fixture/i);
    assert.equal(missText.includes('Alex Exampleton'), false);
  });

  it('does not call the live pipeline, and the router leaves the route free', () => {
    const source = readFileSync(fileURLToPath(new URL('../mock-data.ts', import.meta.url)), 'utf8');
    const route = readFileSync(fileURLToPath(new URL('../routes/mock.ts', import.meta.url)), 'utf8');
    const index = readFileSync(fileURLToPath(new URL('../index.ts', import.meta.url)), 'utf8');
    assert.equal(source.includes('runModule'), false);
    assert.equal(source.includes('@maplespike/pipeline-core'), false);
    assert.match(route, /serve synthetic fixtures/i);
    assert.match(index, /fixtureListHandler/);
    assert.match(index, /\/v1\/fixtures/);
    assert.equal(isFreeTierRoute('/v1/fixtures'), true);
    assert.equal(isFreeTierRoute('/v1/fixtures/fixture-committee-001'), true);
  });
});
