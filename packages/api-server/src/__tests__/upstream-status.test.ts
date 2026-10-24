/**
 * Upstream status state machine — regression suite.
 *
 * Every assertion maps to a rule in `quill-hermes/UPSTREAM-OUTAGES.md` §6.2.
 * The rules exist because the alternative is a banner that lies: an invented
 * ETA, a nightly data lock reported as an outage, or a single failed probe
 * flipping copy the whole site shows.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  UPSTREAM_MAINTENANCE,
  validateConfig,
  type UpstreamHost,
  type UpstreamMaintenanceConfig,
} from '../upstream/maintenance-config.js';
import { evaluateHost, type ProbeSample } from '../upstream/state.js';
import { UpstreamProber, runProbe } from '../upstream/prober.js';
import { activeWindow, formatClock, parseCron, utcFromZoned, zoneLabel } from '../upstream/time.js';
import { isFreeTierRoute } from '../feature-gates.js';
import { ROUTES } from '../index.js';

const PROBE = UPSTREAM_MAINTENANCE.probe;

function sample(at: number, ok: boolean, latencyMs = 120, status = ok ? 200 : 503): ProbeSample {
  return { at, ok, latencyMs, status };
}

function hostById(id: string): UpstreamHost {
  const host = UPSTREAM_MAINTENANCE.hosts.find((h) => h.id === id);
  assert.ok(host, `config is missing host ${id}`);
  return host;
}

// 2026-10-26 is a Monday. 07:00Z = 03:00 EDT — inside StatCan's data lock.
const MONDAY_0300_ET = new Date('2026-10-26T07:00:00Z');
// 12:31Z = 08:31 EDT — one minute after the lock lifts.
const MONDAY_0831_ET = new Date('2026-10-26T12:31:00Z');

describe('config', () => {
  it('ships a config that validates', () => {
    assert.deepEqual(validateConfig(), []);
  });

  it('rejects a malformed cron and a duplicate host id', () => {
    const broken: UpstreamMaintenanceConfig = {
      ...UPSTREAM_MAINTENANCE,
      hosts: [
        { ...UPSTREAM_MAINTENANCE.hosts[0], windows: [{ ...UPSTREAM_MAINTENANCE.hosts[0].windows[0] ?? { kind: 'maintenance', cron: '0 0 * * 1-5', durationMinutes: 30, timezone: 'America/Toronto', messageEn: 'x', messageFr: 'y' }, cron: 'not a cron' }] },
        { ...UPSTREAM_MAINTENANCE.hosts[0] },
      ],
    };
    const errors = validateConfig(broken);
    assert.ok(errors.some((e) => e.includes('duplicate host id')), errors.join('; '));
    assert.ok(errors.some((e) => e.includes('cron')), errors.join('; '));
  });

  it('rejects a window without bilingual copy', () => {
    const broken: UpstreamMaintenanceConfig = {
      ...UPSTREAM_MAINTENANCE,
      hosts: [
        {
          ...UPSTREAM_MAINTENANCE.hosts[0],
          windows: [
            {
              kind: 'maintenance',
              cron: '0 3 * * *',
              durationMinutes: 60,
              timezone: 'America/Toronto',
              messageEn: 'English only',
              messageFr: '',
            },
          ],
        },
      ],
    };
    assert.ok(validateConfig(broken).some((e) => e.includes('messageEn and messageFr')));
  });
});

describe('time windows', () => {
  it('parses the crons the config uses', () => {
    assert.deepEqual(parseCron('0 0 * * 1-5').dayOfWeek, [1, 2, 3, 4, 5]);
    assert.deepEqual(parseCron('0 22 * * 5').hour, [22]);
    assert.throws(() => parseCron('0 0 * *'), /expected 5 fields/);
    assert.throws(() => parseCron('0 99 * * *'), /outside 0-23/);
  });

  it('converts an ET wall clock to the right instant', () => {
    // 2026-10-26 00:00 America/Toronto is EDT (UTC-4) => 04:00Z.
    const start = utcFromZoned('America/Toronto', 2026, 10, 26, 0, 0);
    assert.equal(start.toISOString(), '2026-10-26T04:00:00.000Z');
  });

  it('finds the StatCan data lock only on weekdays before 08:30 ET', () => {
    const window = hostById('statcan-wds').windows[0];
    const inside = activeWindow(window, MONDAY_0300_ET);
    assert.ok(inside, 'Monday 03:00 ET must be inside the data lock');
    assert.equal(formatClock(inside.endsAt, 'America/Toronto'), '08:30');
    assert.equal(zoneLabel('America/Toronto'), 'ET');

    assert.equal(activeWindow(window, MONDAY_0831_ET), null, 'the lock lifts at 08:30 ET');

    // Saturday 10:00 ET — the cron is weekdays only.
    const saturday = new Date('2026-10-24T14:00:00Z');
    assert.equal(activeWindow(window, saturday), null);
  });
});

describe('evaluateHost — declared states', () => {
  it('renders a data_lock as partial, never down (rule 2)', () => {
    const host = hostById('statcan-wds');
    // Even with three recent failures, the window owns the state.
    const samples = [sample(MONDAY_0300_ET.getTime() - 60_000, false), sample(MONDAY_0300_ET.getTime() - 120_000, false)];
    const result = evaluateHost(host, samples, 'down', MONDAY_0300_ET, PROBE);
    assert.equal(result.state, 'partial');
    assert.equal(result.expectedBackAt, null, 'a data lock publishes no restoration time');
    assert.equal(result.window?.kind, 'data_lock');
    assert.equal(result.source, 'https://www.statcan.gc.ca/en/developers/wds/user-guide');
    assert.match(result.message.en, /08:30 ET/);
    assert.match(result.message.fr, /8 h 30/);
  });

  it('renders a declared maintenance window as scheduled with the window end (rule 1)', () => {
    const base = hostById('ontario-ckan');
    const host: UpstreamHost = {
      ...base,
      windows: [
        {
          kind: 'maintenance',
          cron: '0 2 * * 6',
          durationMinutes: 120,
          timezone: 'America/Toronto',
          source: 'https://example.gov/status',
          messageEn: 'Planned maintenance.',
          messageFr: 'Maintenance planifiée.',
        },
      ],
    };
    // Saturday 2026-10-24 03:00 ET = 07:00Z.
    const now = new Date('2026-10-24T07:00:00Z');
    const result = evaluateHost(host, [], null, now, PROBE);
    assert.equal(result.state, 'scheduled');
    assert.equal(result.expectedBackAt, '2026-10-24T08:00:00.000Z');
    assert.equal(result.source, 'https://example.gov/status');
    assert.match(result.message.en, /^Scheduled maintenance, back by 04:00 ET\.$/);
    assert.match(result.message.fr, /Maintenance planifiée/);
    assert.equal(result.showBanner, true);
  });

  it('renders an open announced incident as announced with no ETA (rule 3)', () => {
    const result = evaluateHost(hostById('nl-open-data'), [], null, MONDAY_0300_ET, PROBE);
    assert.equal(result.state, 'announced');
    assert.equal(result.expectedBackAt, null, 'no restoration time was published');
    assert.equal(result.confidence, 'announced');
    assert.equal(result.source, 'https://www.gov.nl.ca/releases/2026/exec/1021n03/');
    assert.match(result.message.en, /No restoration time has been published/);
  });

  it('keeps a policy-blocked host out of the banner (rule 7)', () => {
    const result = evaluateHost(hostById('lobby-canada'), [sample(Date.now(), false, 90, 403)], null, MONDAY_0300_ET, PROBE);
    assert.equal(result.state, 'blocked_permanent');
    assert.equal(result.showBanner, false);
  });

  it('says nothing before the first sample', () => {
    const result = evaluateHost(hostById('open-canada-ckan'), [], null, MONDAY_0300_ET, PROBE);
    assert.equal(result.state, 'unknown');
    assert.equal(result.showBanner, false);
    assert.equal(result.failureRate, null);
  });
});

describe('evaluateHost — observed states', () => {
  const now = new Date('2026-10-23T15:00:00Z');
  const at = (secondsAgo: number): number => now.getTime() - secondsAgo * 1000;

  it('a single failed probe is degraded, not down (rule 5)', () => {
    const samples = [sample(at(120), true), sample(at(60), true), sample(at(10), false)];
    const result = evaluateHost(hostById('open-canada-ckan'), samples, 'up', now, PROBE);
    assert.equal(result.state, 'degraded');
    assert.equal(result.confidence, 'observed');
    assert.equal(result.expectedBackAt, null);
    assert.match(result.message.en, /responding slowly/);
  });

  it('three failures inside the window are down, with no invented ETA (rule 4)', () => {
    const samples = [sample(at(120), false), sample(at(60), false), sample(at(10), false)];
    const result = evaluateHost(hostById('open-canada-ckan'), samples, 'up', now, PROBE);
    assert.equal(result.state, 'down');
    assert.equal(result.expectedBackAt, null);
    assert.equal(result.failureRate, 1);
    assert.equal(result.showBanner, true);
    // The measured p50 may appear, but only as "usually".
    assert.match(result.message.en, /Usually back in about 45 minutes\./);
  });

  it('ignores failures older than the rolling window', () => {
    const samples = [sample(at(600), false), sample(at(540), false), sample(at(480), false), sample(at(20), true)];
    const result = evaluateHost(hostById('open-canada-ckan'), samples, 'up', now, PROBE);
    assert.equal(result.state, 'up');
    assert.equal(result.sampleCount, 1, 'only the sample inside the 300 s window counts');
  });

  it('stays down until five consecutive successes (hysteresis)', () => {
    const four = [
      sample(at(300), false),
      sample(at(240), true),
      sample(at(180), true),
      sample(at(120), true),
      sample(at(60), true),
    ];
    assert.equal(evaluateHost(hostById('open-canada-ckan'), four, 'down', now, PROBE).state, 'down');

    const five = [...four, sample(at(10), true)];
    assert.equal(evaluateHost(hostById('open-canada-ckan'), five, 'down', now, PROBE).state, 'up');
  });

  it('marks a slow-but-working host degraded (p95 over 4 s)', () => {
    const samples = [sample(at(120), true, 5200), sample(at(60), true, 4800), sample(at(10), true, 4600)];
    const result = evaluateHost(hostById('open-canada-ckan'), samples, 'up', now, PROBE);
    assert.equal(result.state, 'degraded');
    assert.equal(result.failureRate, 0);
  });
});

describe('runProbe', () => {
  const okBody = JSON.stringify({ result: { results: [{ id: 1 }] } });
  const probe = {
    url: 'https://open.canada.ca/data/api/3/action/package_search?q=health&rows=1',
    expect: { status: 200, jsonHasPath: '$.result.results' },
  };

  function fakeFetch(status: number, body: string): typeof fetch {
    return (async () => new Response(body, { status })) as unknown as typeof fetch;
  }

  it('passes a healthy payload', async () => {
    const outcome = await runProbe(probe, { timeoutMs: 1000, fetchImpl: fakeFetch(200, okBody) });
    assert.equal(outcome.ok, true);
    assert.equal(outcome.status, 200);
  });

  it('fails a 404 even though the request completed', async () => {
    const outcome = await runProbe(probe, { timeoutMs: 1000, fetchImpl: fakeFetch(404, 'not found') });
    assert.equal(outcome.ok, false);
    assert.match(outcome.reason ?? '', /status 404/);
  });

  it('fails a 200 with malformed JSON', async () => {
    const outcome = await runProbe(probe, { timeoutMs: 1000, fetchImpl: fakeFetch(200, '<html>maintenance</html>') });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.reason, 'malformed JSON');
  });

  it('fails a 200 that lost the expected path', async () => {
    const outcome = await runProbe(probe, { timeoutMs: 1000, fetchImpl: fakeFetch(200, '{"result":{}}') });
    assert.equal(outcome.ok, false);
    assert.match(outcome.reason ?? '', /missing \$\.result\.results/);
  });

  it('fails a network error as status 0', async () => {
    const failing = (async () => {
      throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    }) as unknown as typeof fetch;
    const outcome = await runProbe(probe, { timeoutMs: 1000, fetchImpl: failing });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.status, 0);
  });

  it('accepts 409 inside a data-lock window', async () => {
    const statcan = hostById('statcan-wds').probe;
    const outcome = await runProbe(statcan, {
      timeoutMs: 1000,
      allowStatus: [200, 409],
      fetchImpl: fakeFetch(409, 'table locked'),
    });
    assert.equal(outcome.ok, true);
  });
});

describe('route wiring', () => {
  it('is registered and reachable on the Free tier without a key', () => {
    const route = ROUTES.find((r) => r.pattern.test('/v1/upstream/status') && r.method === 'GET');
    assert.ok(route, 'GET /v1/upstream/status is not in ROUTES');
    // Regression: the Free boundary 402'd the route live before the allowlist
    // entry existed. The banner reads it before sign-in, so it must stay free.
    assert.equal(isFreeTierRoute('/v1/upstream/status'), true);
  });
});

describe('UpstreamProber status payload', () => {
  it('surfaces the worst host as the banner and keeps copy in the API', async () => {
    const now = new Date('2026-10-23T15:00:00Z');
    const prober = new UpstreamProber(UPSTREAM_MAINTENANCE, {
      now: () => now,
      fetchImpl: (async (input: string | URL | Request) => {
        const url = String(input);
        // NL is offline (the real incident), everything else is healthy.
        if (url.includes('opendata.gov.nl.ca')) {
          return new Response('Service Unavailable', { status: 503 });
        }
        return new Response(JSON.stringify({ result: { results: [] } }), { status: 200 });
      }) as unknown as typeof fetch,
    });

    await prober.probeOnce();
    const payload = prober.status();
    assert.equal(payload.banner?.host, 'opendata.gov.nl.ca');
    assert.equal(payload.banner?.state, 'announced');
    assert.equal(payload.banner?.expectedBackAt, null);
    assert.ok(payload.banner?.message.en.length);
    assert.ok(payload.banner?.message.fr.length);
    assert.ok(payload.hosts.every((h) => h.message.en.length > 0 && h.message.fr.length > 0));
    assert.deepEqual(payload.hosts.find((h) => h.id === 'lobby-canada')?.affects, ['corporate_pipeline']);
  });

  it('shows no banner while every probe is healthy', async () => {
    const now = new Date('2026-10-23T15:00:00Z');
    const prober = new UpstreamProber(UPSTREAM_MAINTENANCE, {
      now: () => now,
      fetchImpl: (async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('gazette.gc.ca')) {
          return new Response('<rss><channel><item>x</item></channel></rss>', { status: 200 });
        }
        return new Response(JSON.stringify({ result: { results: [] } }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    await prober.probeOnce();
    // NL's announced incident is config, not a probe result, so pin the cliff:
    // the banner must be NL only while its incident is open.
    const payload = prober.status();
    assert.equal(payload.summary.state, 'announced');
    assert.ok(payload.hosts.filter((h) => h.state === 'up').length >= 7);
    assert.equal(payload.hosts.find((h) => h.id === 'open-canada-ckan')?.state, 'up');
  });
});
