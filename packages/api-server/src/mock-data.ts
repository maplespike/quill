/**
 * Synthetic fixtures for the API.
 *
 * Every record is invented. None of it is a parliamentary, committee,
 * or other public record. Live modules do not run on this path.
 *
 * The fixture routes stay off until QUILL_FIXTURES=1. In production
 * they stay off unless that variable is set.
 */

export const FIXTURE_MARKER = 'FIXTURE' as const;

export const FIXTURE_NOTICE =
  'These routes serve synthetic fixtures. Every record is fake. They are not parliamentary or committee records.';

export interface SyntheticFixture {
  id: string;
  synthetic: true;
  marker: typeof FIXTURE_MARKER;
  kind: string;
  title: string;
  actor: string;
  body: string;
}

export const SYNTHETIC_FIXTURES: readonly SyntheticFixture[] = [
  {
    id: 'fixture-committee-001',
    synthetic: true,
    marker: FIXTURE_MARKER,
    kind: 'committee-sitting',
    title: 'Fixture Committee on Sample Widgets',
    actor: 'Alex Exampleton',
    body: 'Synthetic sitting of the Fixture Committee. This is not a parliamentary record.',
  },
  {
    id: 'fixture-person-001',
    synthetic: true,
    marker: FIXTURE_MARKER,
    kind: 'person',
    title: 'Sample person record',
    actor: 'Blair Fixture',
    body: 'Invented person used to show the fixture shape. Not a member of any legislature.',
  },
  {
    id: 'fixture-org-001',
    synthetic: true,
    marker: FIXTURE_MARKER,
    kind: 'organization',
    title: 'Example Borough Widget Collective',
    actor: 'Casey Sampleton',
    body: 'Invented organization in Fixture Borough. Not a registered company or lobbyist.',
  },
  {
    id: 'fixture-regulation-001',
    synthetic: true,
    marker: FIXTURE_MARKER,
    kind: 'regulation',
    title: 'Fixture Rule on Sample Widgets F-000',
    actor: 'Fixture Borough Council',
    body: 'Invented rule text. It cites no statute and has no legal effect.',
  },
  {
    id: 'fixture-grant-001',
    synthetic: true,
    marker: FIXTURE_MARKER,
    kind: 'grant',
    title: 'Fixture Grant for Sample Widgets',
    actor: 'Exampleton Research Desk',
    body: 'Invented payment of 0 fixture-credits. Not a public account entry.',
  },
];

const ENABLED = new Set(['1', 'true', 'yes']);

/**
 * Fixture routes are off unless QUILL_FIXTURES is 1, true, or yes.
 * NODE_ENV=production does not turn them on by itself.
 */
export function fixturesEnabled(env: Record<string, string | undefined>): boolean {
  const flag = (env.QUILL_FIXTURES ?? '').trim().toLowerCase();
  return ENABLED.has(flag);
}

export function fixtureById(id: string): SyntheticFixture | undefined {
  return SYNTHETIC_FIXTURES.find((row) => row.id === id);
}

export function assertFixturesAreSynthetic(rows: readonly SyntheticFixture[] = SYNTHETIC_FIXTURES): void {
  for (const row of rows) {
    if (row.synthetic !== true) {
      throw new Error(`Fixture ${row.id} is missing synthetic: true`);
    }
    if (row.marker !== FIXTURE_MARKER) {
      throw new Error(`Fixture ${row.id} is missing the FIXTURE marker`);
    }
  }
}
