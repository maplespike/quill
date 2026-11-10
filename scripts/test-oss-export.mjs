/**
 * Fast checks for the public-export manifest and the scan.
 * This file does not copy the repository and it does not install packages.
 */

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PUBLIC_PACKAGES,
  REQUIRED_RULE_IDS,
  compileRules,
  formatHitReport,
  gitleaksArgs,
  hasPrivateOnlyTag,
  isAllowlisted,
  materializeExport,
  parseSimpleYaml,
  phaseNames,
  pnpmCommands,
  publicWorkspaceDocument,
  scanText,
  shouldCopy,
  stampPyproject,
  stampSdkSource,
  trimPackageJson,
  trimTsconfig,
} from './oss-export-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(rel) {
  return readFile(path.join(ROOT, rel), 'utf8');
}

test('the manifest allowlist, excludes, and scan rules match the plan', async () => {
  const manifest = parseSimpleYaml(await read('oss/export.yml'));
  assert.deepEqual(manifest.allow.packages, [
    'api-server',
    'quill-mcp',
    'pipeline-core',
    'database',
    'engine',
  ]);
  assert.deepEqual(manifest.allow.package_globs, ['sdk-*']);
  for (const file of ['package.json', 'pnpm-workspace.yaml', 'tsconfig.json', 'turbo.json', 'LICENSE', 'NOTICE']) {
    assert.ok(manifest.allow.root_files.includes(file), file);
  }
  assert.ok(manifest.allow.root_dirs.includes('patches'));

  for (const excluded of [
    'packages/pipeline-core/src/ingestion/sedi',
    'packages/pipeline-core/src/ingestion/corporate/sedi.ts',
    'packages/quill-mcp/src/tools/search-sedi.ts',
    'secrets',
    '.sops.yaml',
    'charts',
    'k8s',
    'deploy',
    'ops',
    'config',
    '.github',
    'packages/portal',
    'docs',
    'scripts',
  ]) {
    assert.ok(manifest.exclude.paths.includes(excluded), excluded);
  }
  assert.ok(manifest.exclude.globs.includes('**/*.disabled'));
  assert.equal(manifest.exclude.tag, 'oss-export: private-only');
  assert.equal(manifest.exclude.tagged_tests.length, 4);
  assert.equal(manifest.overlay, 'oss/overlay');
  assert.deepEqual(manifest.regenerate, ['pnpm-lock.yaml']);
  assert.deepEqual(manifest.phases, ['materialize', 'scan', 'install', 'build', 'test']);

  const ids = manifest.scan.rules.map((rule) => rule.id);
  assert.deepEqual(ids, REQUIRED_RULE_IDS);
  const ssrf = manifest.scan.rules.find((rule) => rule.id === '192.168');
  assert.deepEqual(ssrf.allow_paths, [
    'packages/api-server/src/routes/extraction.ts',
    'packages/api-server/src/routes/webhooks.ts',
  ]);
});

test('selection keeps the public packages and drops private paths', async () => {
  const manifest = parseSimpleYaml(await read('oss/export.yml'));
  const keep = [
    'package.json',
    'patches/rss-http2-fix.patch',
    'packages/api-server/src/index.ts',
    'packages/api-server/src/config.ts',
    'packages/sdk-python/quill/__init__.py',
    'packages/sdk-shell/maplespike',
  ];
  const drop = [
    'packages/sdk/src/index.ts',
    'packages/pipeline-core/src/ingestion/sedi/index.ts',
    'packages/pipeline-core/src/ingestion/corporate/sedi.ts',
    'packages/quill-mcp/src/tools/search-sedi.ts',
    'scripts/oss-export.mjs',
    'charts/quill/values-prod.yaml',
    'docs/oss-export.md',
    'packages/portal/src/pages/index.astro',
    '.github/workflows/ci.yml',
    'secrets/runtime.yaml',
    'config/local.yaml',
    'k8s/base/foo.yaml',
    'README.md',
    'packages/api-server/src/old.disabled',
    'packages/pipeline-core/src/cli/__tests__/change-gate-coverage.test.ts',
    'packages/api-server/node_modules/left-pad/index.js',
  ];
  for (const rel of keep) assert.equal(shouldCopy(rel, manifest), true, rel);
  for (const rel of drop) assert.equal(shouldCopy(rel, manifest), false, rel);
  assert.equal(isAllowlisted('packages/sdk/src/index.ts', manifest), false);
  assert.equal(
    shouldCopy('packages/api-server/src/live.test.ts', manifest, '// oss-export: private-only\n'),
    false,
  );
  assert.equal(hasPrivateOnlyTag('// oss-export: private-only\nexport {}\n'), true);
});

test('the scan reports private strings and allows the SSRF guards', async () => {
  const manifest = parseSimpleYaml(await read('oss/export.yml'));
  const rules = compileRules(manifest);
  const addr = ['10', '1', '2', '3'].join('.');
  const lan = ['192', '168', '1', '9'].join('.');
  const hits = scanText('packages/api-server/src/routes/ai.ts', `upstream ${addr} and nexus`, rules);
  assert.ok(hits.some((hit) => hit.rule === '10.x' && hit.match === addr));
  assert.ok(hits.some((hit) => hit.rule === 'nexus'));

  const allowed = scanText('packages/api-server/src/routes/webhooks.ts', `blocked ${lan}`, rules);
  assert.equal(allowed.length, 0);
  const blocked = scanText('packages/api-server/src/routes/health.ts', `blocked ${lan}`, rules);
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].rule, '192.168');

  const home = scanText('packages/pipeline-core/src/utils/browser-fetch.ts', 'path /home/bin/tool', rules);
  assert.equal(home[0].rule, 'home');
  const stripePrefix = 'sk' + '_live_example';
  const productPrefix = 'm' + stripePrefix;
  assert.equal(scanText('a.txt', stripePrefix, rules).some((hit) => hit.rule === 'sk_live'), true);
  assert.equal(scanText('a.txt', productPrefix, rules).some((hit) => hit.rule === 'sk_live'), false);
  const report = formatHitReport(hits);
  assert.match(report, /packages\/api-server\/src\/routes\/ai.ts/);
  assert.match(report, /\[10\.x\]/);
  assert.match(report, /\[nexus\]/);
});

test('transforms trim the workspace and stamp the SDK licence', async () => {
  const pkg = trimPackageJson(JSON.parse(await read('package.json')));
  assert.deepEqual(pkg.workspaces, PUBLIC_PACKAGES);
  assert.equal(pkg.license, 'AGPL-3.0-only');
  assert.equal(pkg.scripts.test, 'turbo test');
  assert.equal(pkg.devDependencies.playwright, undefined);
  assert.equal(pkg.devDependencies.typescript, JSON.parse(await read('package.json')).devDependencies.typescript);
  assert.ok(pkg.dependencies.tweetnacl);

  const tsconfig = trimTsconfig(JSON.parse(await read('tsconfig.json')));
  assert.deepEqual(tsconfig.references.map((ref) => ref.path), [
    'packages/database',
    'packages/pipeline-core',
    'packages/engine',
    'packages/quill-mcp',
    'packages/api-server',
  ]);
  assert.equal(tsconfig.references.some((ref) => ref.path === 'packages/i18n'), false);

  const workspace = publicWorkspaceDocument(parseSimpleYaml(await read('pnpm-workspace.yaml')));
  assert.deepEqual(workspace.packages, PUBLIC_PACKAGES);
  assert.ok(workspace.overrides.minimatch);
  assert.ok(workspace.onlyBuiltDependencies.includes('better-sqlite3'));

  const py = stampPyproject('license = "AGPL-3.0-only"\n');
  assert.match(py, /Apache-2\.0/);
  const source = stampSdkSource('# SPDX-License-Identifier: MIT\n');
  assert.match(source, /Apache-2\.0/);
  assert.equal(source.includes('MIT'), false);
});

test('materialize applies excludes, the tag, and the overlay', async () => {
  const source = await mkdtemp(path.join(tmpdir(), 'quill-oss-src-'));
  const dest = await mkdtemp(path.join(tmpdir(), 'quill-oss-dest-'));
  const manifest = {
    allow: {
      packages: ['api-server'],
      package_globs: ['sdk-*'],
      root_files: ['package.json', 'pnpm-workspace.yaml', 'tsconfig.json'],
      root_dirs: [],
    },
    exclude: {
      paths: ['packages/api-server/src/ingestion/sedi', 'scripts'],
      globs: ['**/*.disabled'],
      tag: 'oss-export: private-only',
      tagged_tests: [],
    },
    transforms: { sdk_license: 'Apache-2.0' },
    overlay: 'overlay',
    scan: { rules: [] },
  };

  async function put(rel, text) {
    const abs = path.join(source, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, text);
  }

  await put('package.json', JSON.stringify({
    name: 'quill',
    version: '0.0.0',
    license: 'AGPL-3.0-only',
    packageManager: 'pnpm@10.32.1',
    engines: { node: '>=22.12' },
    devDependencies: { typescript: '0.0.0' },
    dependencies: {},
    overrides: {},
  }));
  await put('pnpm-workspace.yaml', 'packages:\n  - "packages/*"\nonlyBuiltDependencies:\n  - "better-sqlite3"\n');
  await put('tsconfig.json', JSON.stringify({ references: [{ path: 'packages/i18n' }, { path: 'packages/api-server' }] }));
  await put('packages/api-server/src/index.ts', 'export const live = true;\n');
  await put('packages/api-server/src/ingestion/sedi/index.ts', 'export const hidden = true;\n');
  await put('packages/api-server/src/gone.disabled', 'nope\n');
  await put('packages/api-server/src/private.test.ts', '// oss-export: private-only\nexport {}\n');
  await put('scripts/secret.mjs', 'nope\n');
  await put('packages/sdk-python/pyproject.toml', 'license = "AGPL-3.0-only"\n');
  await put('packages/sdk-python/quill/client.py', '# SPDX-License-Identifier: AGPL-3.0-only\n');
  await put('overlay/README.md', 'Public readme.\n');
  await put('overlay/licenses/Apache-2.0.txt', 'Apache text\n');

  await materializeExport(source, dest, manifest);

  assert.match(await readFile(path.join(dest, 'README.md'), 'utf8'), /Public readme/);
  assert.match(await readFile(path.join(dest, 'packages/api-server/src/index.ts'), 'utf8'), /live/);
  await assert.rejects(readFile(path.join(dest, 'packages/api-server/src/ingestion/sedi/index.ts')));
  await assert.rejects(readFile(path.join(dest, 'packages/api-server/src/gone.disabled')));
  await assert.rejects(readFile(path.join(dest, 'packages/api-server/src/private.test.ts')));
  await assert.rejects(readFile(path.join(dest, 'scripts/secret.mjs')));
  const stamped = JSON.parse(await readFile(path.join(dest, 'package.json'), 'utf8'));
  assert.deepEqual(stamped.workspaces, PUBLIC_PACKAGES);
  const treeConfig = JSON.parse(await readFile(path.join(dest, 'tsconfig.json'), 'utf8'));
  assert.deepEqual(treeConfig.references, [{ path: 'packages/api-server' }]);
  assert.match(await readFile(path.join(dest, 'packages/sdk-python/pyproject.toml'), 'utf8'), /Apache-2\.0/);
  assert.match(await readFile(path.join(dest, 'packages/sdk-python/quill/client.py'), 'utf8'), /Apache-2\.0/);
  assert.equal(
    await readFile(path.join(dest, 'packages/sdk-python/LICENSE'), 'utf8'),
    'Apache text\n',
  );
});

test('the runner plans a full check and does not publish', async () => {
  assert.deepEqual(phaseNames([]), ['materialize', 'scan', 'install', 'build', 'test']);
  assert.deepEqual(phaseNames(['--scan-only']), ['materialize', 'scan']);
  assert.deepEqual(pnpmCommands(), [
    ['pnpm', 'install'],
    ['pnpm', 'run', 'build'],
    ['pnpm', 'run', 'test'],
  ]);
  const args = gitleaksArgs('/tmp/export', 'gitleaks');
  assert.deepEqual(args.slice(1), [
    'detect', '--source', '/tmp/export', '--no-git', '--redact', '--exit-code', '1',
    '--config', '/tmp/export/.gitleaks.toml',
  ]);

  const cli = await read('scripts/oss-export.mjs');
  assert.equal(cli.includes('git push'), false);
  assert.equal(cli.includes('gh repo'), false);

  const workflow = await read('oss/overlay/.github/workflows/ci.yml');
  const runsOn = [...workflow.matchAll(/^(\s*)runs-on:\s*(\S+)/gm)].map((match) => match[2]);
  assert.deepEqual(runsOn, ['ubuntu-latest']);
  assert.match(workflow, /pnpm run lint/);
  assert.match(workflow, /pnpm run typecheck/);
  assert.match(workflow, /pnpm run test/);
  assert.match(workflow, /gitleaks detect/);

  for (const file of ['oss/overlay/Dockerfile.api', 'oss/overlay/Dockerfile.mcp']) {
    const text = await read(file);
    assert.equal(text.includes('COPY . .'), false, file);
    assert.equal(text.includes('gen-security-audit'), false, file);
    assert.equal(text.includes('packages/portal'), false, file);
    assert.match(text, /ghcr\.io\/maplespike\/quill-|packages\/api-server|packages\/quill-mcp/);
  }
  const compose = await read('oss/overlay/docker-compose.oss.yml');
  assert.match(compose, /ghcr\.io\/maplespike\/quill-api/);
  assert.match(compose, /ghcr\.io\/maplespike\/quill-mcp/);
  assert.match(compose, /profiles: \["postgres"\]/);
  assert.equal(compose.includes('portal'), false);
});
