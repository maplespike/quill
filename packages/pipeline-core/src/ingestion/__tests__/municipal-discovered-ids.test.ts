/**
 * Parse and schema checks for the git-tracked municipal ID registry.
 *
 * The file is written by scripts/discover-municipal-ids.ts. This test pins
 * the 2026-11-09 refresh (workflow run 42636962693): schemaVersion 1, and
 * every entry's portal id, including Edmonton 311 `sj7q-iwb5`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MUNICIPAL_PORTALS } from '../municipal/constants.js';

const REGISTRY_PATH = path.join(
  new URL('../../../data/municipal-discovered-ids.json', import.meta.url).pathname,
);

const SOCRATA_ID = /^[a-z0-9]{4}-[a-z0-9]{4}$/;
const CKAN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/** Ids and names from the 2026-11-09 registry. Edmonton 311 changed in that run. */
const REFRESHED_ENTRIES: Record<string, { id: string; portalType: 'ckan' | 'socrata'; name: string }> = {
  'https://donnees.montreal.ca|budget': {
    id: '2b7dcae7-a3e5-4f5d-81de-ccde2c518e55',
    portalType: 'ckan',
    name: 'Budget de fonctionnement',
  },
  'https://data.edmonton.ca|building-permits': {
    id: '24uj-dj8v',
    portalType: 'socrata',
    name: 'General Building Permits',
  },
  'https://data.winnipeg.ca|permits': {
    id: 'it4w-cpf4',
    portalType: 'socrata',
    name: 'Detailed Building Permit Data',
  },
  'https://data.winnipeg.ca|311-calls': {
    id: 'vrzk-mj7v',
    portalType: 'socrata',
    name: '311 Call Wait Times',
  },
  'https://data.edmonton.ca|311-calls': {
    id: 'sj7q-iwb5',
    portalType: 'socrata',
    name: '311 Call Centre Satisfaction Survey - 2015',
  },
  'https://data.edmonton.ca|budget': {
    id: 'gds5-6aiq',
    portalType: 'socrata',
    name: '2012 Budget Consultation Survey - Taxes And Balancing Budget',
  },
  'https://data.calgary.ca|budget': {
    id: 'fqax-i3nz',
    portalType: 'socrata',
    name: 'Calgary Open Budget',
  },
  'https://data.calgary.ca|permits': {
    id: 'c2es-76ed',
    portalType: 'socrata',
    name: 'Building Permits',
  },
  'https://data.calgary.ca|transit': {
    id: 'hpnd-riq4',
    portalType: 'socrata',
    name: 'Calgary Transit Routes',
  },
  'https://data.winnipeg.ca|budget': {
    id: 'hk5w-mj8b',
    portalType: 'socrata',
    name: 'Capital Budget - 2014',
  },
};

interface RegistryEntry {
  id: string;
  portalType: string;
  discoveredAt: string;
  name?: string;
  rowsProbed?: number;
  validated?: boolean;
}

interface Registry {
  schemaVersion: number;
  generatedAt: string;
  source: string;
  discoveries: number;
  keptFromPrevious: number;
  entries: Record<string, RegistryEntry>;
}

function loadRegistry(): Registry {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  return JSON.parse(raw) as Registry;
}

describe('municipal discovered-ids registry', () => {
  it('parses as schemaVersion 1 from discover-municipal-ids', () => {
    const registry = loadRegistry();
    assert.equal(registry.schemaVersion, 1);
    assert.equal(registry.source, 'discover-municipal-ids');
    assert.match(registry.generatedAt, ISO_INSTANT);
    assert.equal(Number.isInteger(registry.discoveries), true);
    assert.equal(Number.isInteger(registry.keptFromPrevious), true);
    assert.ok(registry.discoveries >= 0);
    assert.ok(registry.keptFromPrevious >= 0);
    assert.equal(registry.discoveries, 10);
    assert.equal(registry.keptFromPrevious, 0);
    assert.equal(Object.keys(registry.entries).length, registry.discoveries + registry.keptFromPrevious);
    assert.equal(registry.generatedAt, '2026-11-09T14:41:08.809Z');
  });

  it('gives every entry a portal id that matches the registry schema', () => {
    const registry = loadRegistry();
    const portals = Object.values(MUNICIPAL_PORTALS);
    const allowedKeys = new Set(['id', 'portalType', 'discoveredAt', 'name', 'rowsProbed', 'validated']);

    for (const [key, entry] of Object.entries(registry.entries)) {
      const [baseUrl, slug, extra] = key.split('|');
      assert.equal(extra, undefined, `${key} must be baseUrl|slug`);
      assert.ok(baseUrl.startsWith('https://'), key);
      const portal = portals.find((item) => item.baseUrl === baseUrl);
      assert.ok(portal, `${key} baseUrl is not in MUNICIPAL_PORTALS`);
      assert.ok(portal.datasets.includes(slug), `${key} slug is not a dataset on that portal`);
      assert.equal(entry.portalType, portal.portalType, key);
      assert.ok(entry.portalType === 'ckan' || entry.portalType === 'socrata', key);
      assert.equal(entry.validated, true, key);
      assert.equal(typeof entry.name, 'string', key);
      assert.ok((entry.name ?? '').length > 0, key);
      assert.match(entry.discoveredAt, ISO_INSTANT, key);
      assert.ok(entry.discoveredAt <= registry.generatedAt, key);
      for (const field of Object.keys(entry)) {
        assert.ok(allowedKeys.has(field), `${key} has unknown field ${field}`);
      }
      if (entry.portalType === 'socrata') {
        assert.match(entry.id, SOCRATA_ID, `${key} id ${entry.id}`);
        assert.equal(typeof entry.rowsProbed, 'number', key);
        assert.ok((entry.rowsProbed ?? 0) > 0, key);
      } else {
        assert.match(entry.id, CKAN_ID, `${key} id ${entry.id}`);
        assert.equal(entry.rowsProbed, undefined, key);
      }
    }
  });

  it('covers the 2026-11-09 entries, including the Edmonton 311 id', () => {
    const registry = loadRegistry();
    assert.deepEqual(Object.keys(registry.entries).sort(), Object.keys(REFRESHED_ENTRIES).sort());
    for (const [key, expected] of Object.entries(REFRESHED_ENTRIES)) {
      const entry = registry.entries[key];
      assert.ok(entry, key);
      assert.equal(entry.id, expected.id, key);
      assert.equal(entry.portalType, expected.portalType, key);
      assert.equal(entry.name, expected.name, key);
      assert.equal(entry.validated, true, key);
    }
    assert.equal(registry.entries['https://data.edmonton.ca|311-calls'].id, 'sj7q-iwb5');
    assert.equal(
      registry.entries['https://data.edmonton.ca|311-calls'].name,
      '311 Call Centre Satisfaction Survey - 2015',
    );
  });
});
