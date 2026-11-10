import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SEDI_HOST,
  hostReferences,
  moduleBlock,
  scheduleKeys,
  structuralProblems,
  findViolations,
} from './gates/check-no-sedi-access.mjs';

const HOST_LINE = `healthCheckUrl: 'https://www.${SEDI_HOST}'`;

test('host scan flags a health-check URL and allows the licence inventory', () => {
  const root = mkdtempSync(join(tmpdir(), 'sedi-gate-'));
  try {
    mkdirSync(join(root, 'packages'), { recursive: true });
    writeFileSync(join(root, 'packages', 'probe.ts'), HOST_LINE + '\n');
    writeFileSync(join(root, 'data-source-licenses.json'), `{ "source_terms": "https://www.${SEDI_HOST}/" }\n`);
    writeFileSync(join(root, 'DATA-LICENSES.md'), `| sedi | https://www.${SEDI_HOST}/ |\n`);
    const hits = hostReferences(root);
    assert.deepEqual(hits, [`packages/probe.ts:1 references ${SEDI_HOST}`]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('retired module block must not carry a health URL or a live cadence', () => {
  const good = `
  {
    name: 'sedi',
    status: 'retired',
    updateFrequency: 'retired',
    testCallPattern: 'skip',
  },
`;
  const block = moduleBlock(good, 'sedi');
  assert.match(block, /status:\s*'retired'/);
  assert.equal(/healthCheckUrl/.test(block), false);

  const bad = `
  {
    name: 'sedi',
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.${SEDI_HOST}',
  },
`;
  assert.match(moduleBlock(bad, 'sedi'), /healthCheckUrl/);
});

test('schedule key parser sees sedi and ignores comments', () => {
  const text = `
ingestion:
  schedules:
    corporate: "0 2 * * *"
    # sedi: "0 3 * * *"
    gazette: "0 */12 * * *"
  resources:
    requests:
      cpu: 50m
`;
  assert.deepEqual(scheduleKeys(text), ['corporate', 'gazette']);
  const withSedi = text.replace('gazette:', 'sedi:');
  assert.ok(scheduleKeys(withSedi).includes('sedi'));
});

test('the repository has no scheduled ingest or health check for the retired source', () => {
  const problems = findViolations(new URL('..', import.meta.url).pathname);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('structural fixture fails when the corporate run calls the insider ingest', () => {
  const problems = structuralProblems('/unused', {
    'packages/pipeline-core/src/ingestion/registry.ts': `
  {
    name: 'sedi',
    status: 'retired',
    updateFrequency: 'retired',
    testCallPattern: 'skip',
  },
export async function healthCheckModule(info: ModuleInfo): Promise<boolean> {
  if (info.status === 'retired' || !info.healthCheckUrl) return true;
  const resp = await httpGet(info.healthCheckUrl);
}
export async function runModule(name: string) {
  if (info.status === 'retired') return { skipped: true };
  if (info.healthCheckUrl) await healthCheckModule(info);
}
`,
    'packages/api-server/src/registry-snapshot.ts': `
  {
    name: 'sedi',
    status: 'retired',
    updateFrequency: 'retired',
    testCallPattern: 'skip',
  },
`,
    'packages/pipeline-core/src/ingestion/corporate/index.ts': `
export async function ingestAllCorporate() {
  return ingestInsiderTransactions(db, options);
}
`,
    'packages/pipeline-core/src/cli/run-pipeline.ts': `
export const PIPELINE_CONFIG = { corporate: 'corporate' };
export async function runOne() {
  if (mod?.status === 'retired') return;
  const probeUrls = probeUrlsFor(moduleName);
}
`,
    'packages/pipeline-core/src/ingestion/run-pipeline.ts': `
const PIPELINE_CONFIG = { corporate: 'corporate' };
async function main() {
  if (module.status === 'retired') process.exit(0);
  if (module.healthCheckUrl) await healthCheckModule(module);
}
`,
    'charts/quill/values.yaml': 'ingestion:\n  schedules:\n    corporate: "0 2 * * *"\n',
    'charts/quill/values-prod.yaml': 'ingestion:\n  schedules:\n    corporate: "0 2 * * *"\n',
    'scripts/fixtures/values-prod-legacy.yaml': 'ingestion:\n  schedules:\n    corporate: "0 2 * * *"\n',
    'packages/api-server/src/data-quality.ts': `
async function probeModuleHealth(mod) {
  if (mod.status === 'retired' || !mod.healthCheckUrl) return 'untested';
  await fetch(mod.healthCheckUrl);
}
`,
    'packages/pipeline-core/src/health-monitoring/monitor.ts':
      "if (mod.status !== 'retired' && mod.healthCheckUrl) {}",
    'packages/api-server/src/routes/export.ts': `
export const exportModuleHandler = async () => {
  if (moduleInfo.status === 'retired') return;
  await runModule(moduleName, { limit });
};
`,
    'packages/portal/scripts/generate-full-pipeline-data.mjs': 'const MODULES = [];\n',
    'packages/pipeline-core/src/ingestion/attestation/index.ts': "  'sedi': 'retired',\n",
  });
  assert.ok(
    problems.some((p) => p.includes('ingestInsiderTransactions')),
    problems.join('\n'),
  );
});
