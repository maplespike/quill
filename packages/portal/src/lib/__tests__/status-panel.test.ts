/**
 * @vitest-environment jsdom
 *
 * The status page renders municipal health, coverage, and freshness.
 * These tests put the panel HTML in a document and read the fields.
 */
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  likelyBlocked,
  renderCoverageInner,
  renderFreshnessInner,
  renderHealthInner,
} from '../status-panel';

const CHECKED = '2026-11-09T20:15:00.000Z';
const SUCCEEDED = '2026-11-09T18:00:00.000Z';
const FETCHED = '2026-11-09T20:14:00.000Z';
const CUTOFF = '2026-11-02T20:15:00.000Z';

function mount(html: string): HTMLElement {
  document.body.innerHTML = `<div id="panel">${html}</div>`;
  return document.getElementById('panel') as HTMLElement;
}

function field(root: ParentNode, name: string): string {
  const el = root.querySelector(`[data-field="${name}"]`);
  return (el?.textContent ?? '').trim();
}

describe('status page freshness panel', () => {
  test('renders the check timestamp, cadence, claim count, and endpoint map', () => {
    const root = mount(renderFreshnessInner({
      timestamp: CHECKED,
      sla: {
        uptime: '99% best-effort monthly',
        freshness: {
          'committees / gazette': 'daily',
          'lobbying / corporate / gic': 'weekly',
        },
      },
      claims: { stored: 42 },
      publicEndpoints: {
        health: '/v1/health',
        status: '/v1/status',
      },
    }, 'en'));

    expect(field(root, 'status-timestamp')).toBe(CHECKED);
    expect(root.querySelector('[data-field="status-timestamp"]')?.getAttribute('datetime')).toBe(CHECKED);
    expect(field(root, 'sla-uptime')).toBe('99% best-effort monthly');
    expect(field(root, 'claims-stored')).toBe('42');
    const windows = [...root.querySelectorAll('[data-field="freshness-window"]')].map((el) => el.textContent);
    expect(windows).toEqual(['committees / gazette', 'lobbying / corporate / gic']);
    const cadences = [...root.querySelectorAll('[data-field="freshness-cadence"]')].map((el) => el.textContent);
    expect(cadences).toEqual(['daily', 'weekly']);
    const paths = [...root.querySelectorAll('[data-field="endpoint-path"]')].map((el) => el.textContent);
    expect(paths).toContain('/v1/status');
  });

  test('renders a French unavailable line when the payload is missing', () => {
    const root = mount(renderFreshnessInner(null, 'fr'));
    expect(field(root, 'freshness-unavailable')).toBe('Cette source n\'a pas répondu.');
  });
});

describe('status page municipal health panel', () => {
  const health = {
    threshold: { stale_after_seconds: 604800, cutoff_iso: CUTOFF },
    summary: {
      cities_total: 3,
      cities_by_status: { cached: 1, stale: 1, uncached: 1 },
      total_cached_records: 12,
      last_check_at: CHECKED,
    },
    cities: [
      {
        city_id: 'montreal',
        label_preferred: 'Montreal',
        label_fr: 'Montréal',
        province: 'QC',
        status: 'cached',
        cached_datasets: 1,
        cached_records: 3,
        freshest_age_seconds: 3600,
        last_succeeded_at: SUCCEEDED,
      },
      {
        city_id: 'toronto',
        label_preferred: 'Toronto',
        province: 'ON',
        status: 'stale',
        cached_datasets: 2,
        cached_records: 9,
        freshest_age_seconds: 864000,
        last_succeeded_at: '2026-10-30T18:00:00.000Z',
      },
      {
        city_id: 'vancouver',
        label_preferred: 'Vancouver',
        province: 'BC',
        status: 'uncached',
        cached_datasets: 0,
        cached_records: 0,
        freshest_age_seconds: null,
        last_succeeded_at: null,
      },
    ],
  };

  test('renders coverage counts, freshness timestamps, and the blocked signal', () => {
    const root = mount(renderHealthInner(health, 'en'));

    expect(field(root, 'cities-total')).toBe('3');
    expect(field(root, 'cities-cached')).toBe('1');
    expect(field(root, 'cities-stale')).toBe('1');
    expect(field(root, 'cities-uncached')).toBe('1');
    expect(field(root, 'health-cached-records')).toBe('12');
    expect(field(root, 'last-check-at')).toBe(CHECKED);
    expect(root.querySelector('[data-field="last-check-at"]')?.getAttribute('datetime')).toBe(CHECKED);
    expect(field(root, 'cutoff-iso')).toBe(CUTOFF);

    const montreal = root.querySelector('[data-city="montreal"]')?.closest('div');
    expect(montreal?.textContent).toContain('Montreal');
    expect(field(montreal as HTMLElement, 'health-status')).toBe('cached');
    expect(field(montreal as HTMLElement, 'cached-datasets')).toBe('1');
    expect(field(montreal as HTMLElement, 'cached-records')).toBe('3');
    expect(field(montreal as HTMLElement, 'freshest-age')).toBe('60 min');
    expect(field(montreal as HTMLElement, 'last-succeeded-at')).toBe(SUCCEEDED);
    expect(montreal?.querySelector('[data-field="likely-blocked"]')?.getAttribute('data-blocked')).toBe('no');

    const toronto = root.querySelector('[data-city="toronto"]')?.parentElement;
    expect(toronto?.querySelector('[data-field="likely-blocked"]')?.textContent).toBe('Past freshness window');
    expect(toronto?.querySelector('[data-field="likely-blocked"]')?.getAttribute('data-blocked')).toBe('yes');

    const vancouver = root.querySelector('[data-city="vancouver"]')?.parentElement;
    expect(vancouver?.querySelector('[data-field="likely-blocked"]')?.textContent).toBe('Likely blocked');
    expect(vancouver?.textContent).toContain('No successful fetch');
    expect(field(vancouver as HTMLElement, 'last-succeeded-at')).toBe('—');
  });

  test('uses the API likely_blocked flag when the payload includes it', () => {
    expect(likelyBlocked({ status: 'cached', likely_blocked: true })).toBe(true);
    expect(likelyBlocked({ status: 'uncached' })).toBe(true);
    expect(likelyBlocked({ status: 'cached' })).toBe(false);
  });

  test('does not render personal data planted on a city row', () => {
    const root = mount(renderHealthInner({
      summary: {
        cities_total: 1,
        cities_by_status: { cached: 1, stale: 0, uncached: 0 },
        total_cached_records: 1,
        last_check_at: CHECKED,
      },
      cities: [{
        city_id: 'toronto',
        label_preferred: 'Ada Lovelace <ada@example.com>',
        province: 'ON',
        status: 'cached',
        cached_datasets: 1,
        cached_records: 1,
        freshest_age_seconds: 60,
        last_succeeded_at: SUCCEEDED,
        records: [{ name: 'Jane Doe', email: 'jane@example.com' }],
      }],
    }, 'en'));

    const html = root.innerHTML;
    expect(html).not.toContain('@');
    expect(html).not.toContain('Jane');
    expect(html).not.toContain('Lovelace');
    expect(html).not.toContain('ada@example.com');
    expect(field(root, 'city-label')).toBe('toronto');
  });
});

describe('status page municipal coverage panel', () => {
  test('renders cache totals, dataset age, and the success timestamp', () => {
    const root = mount(renderCoverageInner({
      fetched_at: FETCHED,
      summary: {
        cities_with_cache: 1,
        total_cached_datasets: 2,
        total_cached_records: 14,
        freshest_age_seconds: 1800,
        oldest_age_seconds: 7200,
      },
      cities: [{
        cityId: 'montreal',
        total_records: 14,
        freshest_age_seconds: 1800,
        oldest_age_seconds: 7200,
        datasets: [
          {
            dataset: 'budget',
            source: 'https://donnees.montreal.ca/dataset/budget?token=secret',
            record_count: 11,
            succeeded_at: SUCCEEDED,
            age_seconds: 1800,
          },
          {
            dataset: 'permits',
            source: 'https://donnees.montreal.ca/dataset/permits',
            record_count: 3,
            succeeded_at: '2026-11-09T16:00:00.000Z',
            age_seconds: 7200,
          },
        ],
      }],
    }, 'en'));

    expect(field(root, 'cities-with-cache')).toBe('1');
    expect(field(root, 'cached-datasets')).toBe('2');
    expect(field(root, 'coverage-cached-records')).toBe('14');
    expect(field(root, 'coverage-freshest-age')).toBe('30 min');
    expect(field(root, 'coverage-oldest-age')).toBe('2 h');
    expect(field(root, 'fetched-at')).toBe(FETCHED);
    expect(root.querySelector('[data-city="montreal"][data-field="coverage-city"]')?.textContent).toBe('montreal');
    const datasets = [...root.querySelectorAll('[data-field="dataset"]')].map((el) => el.textContent);
    expect(datasets).toEqual(['budget', 'permits']);
    expect(field(root, 'dataset-records')).toBe('11');
    const times = [...root.querySelectorAll('[data-field="succeeded-at"]')].map((el) => el.textContent);
    expect(times).toContain(SUCCEEDED);
    expect(root.innerHTML).not.toContain('token');
    expect(root.innerHTML).not.toContain('secret');
    expect(root.querySelector('[data-field="source-host"]')?.textContent).toBe('donnees.montreal.ca');
  });
});

describe('status route wiring', () => {
  const page = readFileSync(join(__dirname, '../../pages/status.astro'), 'utf8');

  test('the status page mounts health, coverage, and freshness panels', () => {
    expect(page).toContain('id="freshness-panel"');
    expect(page).toContain('id="municipal-health-panel"');
    expect(page).toContain('id="municipal-coverage-panel"');
    expect(page).toContain('status-data-client');
    expect(page).toContain('status.maplespike.ca');
  });
});
