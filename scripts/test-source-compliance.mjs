import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTable,
  parseAliases,
  coverageProblems,
  driftProblems,
} from './gates/check-source-compliance.mjs';

const TABLE_SOURCE = `
export const DEFAULT_SOURCE_POLICY: SourcePolicy = {};
export const SOURCE_POLICIES: Record<string, Partial<SourcePolicy>> = {
  // Committee content is discovery-only.
  committees: { commercialUse: false, discoveryOnly: true },
  'parliamentary-voting': { commercialUse: false, discoveryOnly: true },
  statcan: { aggregateOnly: true },
};
`;

const ALIAS_SOURCE = `
export const MODULE_SOURCE_ALIASES: Record<string, string> = {
  lobbying: 'federal-lobbying-monthly',
  'canlii-fr': 'canlii',
  rss: 'media-broadcasting',
};
`;

test('parseTable reads entries, quoted keys, flags, and skips comments', () => {
  const table = parseTable(TABLE_SOURCE, 'SOURCE_POLICIES');
  assert.equal(table.size, 3);
  assert.deepEqual(table.get('committees'), { commercialUse: false, discoveryOnly: true });
  assert.deepEqual(table.get('statcan'), { aggregateOnly: true });
});

test('parseAliases reads the alias map', () => {
  const aliases = parseAliases(ALIAS_SOURCE);
  assert.equal(aliases.size, 3);
  assert.equal(aliases.get('canlii-fr'), 'canlii');
  assert.equal(aliases.get('rss'), 'media-broadcasting');
});

test('driftProblems: no findings when JSON and runtime agree', () => {
  const json = new Map([['committees', { commercialUse: false, discoveryOnly: true }]]);
  const runtime = new Map([['committees', { commercialUse: false, discoveryOnly: true }]]);
  assert.deepEqual(driftProblems(json, runtime), []);
});

test('driftProblems: flags missing on either side are reported', () => {
  const json = new Map([['committees', { commercialUse: false, discoveryOnly: true }]]);
  const empty = new Map();
  assert.equal(driftProblems(json, empty).length, 2); // both flags missing at runtime
  const extra = new Map([['committees', { commercialUse: false, discoveryOnly: true, linkOnly: true }]]);
  assert.equal(driftProblems(json, extra).length, 1); // linkOnly only in runtime
});

test('driftProblems: coherence — commercialUse:false requires discoveryOnly:true', () => {
  const bad = new Map([['committees', { commercialUse: false }]]);
  const findings = driftProblems(bad, bad);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /discoveryOnly:true/);
});

test('driftProblems: unknown flag keys are rejected', () => {
  const weird = new Map([['x', { mysteryFlag: true }]]);
  assert.match(driftProblems(weird, weird)[0], /unknown policy flag/);
});

test('coverageProblems: aliases resolve, misses are reported', () => {
  const families = new Set(['canlii', 'committees', 'federal-lobbying-monthly']);
  const aliases = new Map([['canlii-fr', 'canlii'], ['lobbying', 'federal-lobbying-monthly']]);
  assert.deepEqual(
    coverageProblems(['canlii', 'committees', 'canlii-fr', 'lobbying'], aliases, families),
    [],
  );
  assert.equal(coverageProblems(['orphan-module'], aliases, families).length, 1);
});
