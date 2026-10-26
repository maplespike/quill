#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const script = new URL('./audit-open-source.mjs', import.meta.url);

test('audit emits structured package metadata, findings, and dependency inventory', () => {
  const output = execFileSync(process.execPath, [script.pathname, '--format', 'json'], { encoding: 'utf8' });
  const report = JSON.parse(output);
  assert.equal(report.schemaVersion, '1.0.0');
  assert.ok(report.workspacePackages.length > 0);
  assert.ok(report.installedDependencies.length > 0);
  // Since the 2026-10-24 AGPL-3.0-only decision (#1044) every workspace package
  // declares that licence, and every first-party source header agrees with it.
  // A file that drifts is a failure.
  assert.deepEqual(report.findings.filter(finding => finding.kind === 'missing-manifest-license'), []);
  const drift = report.findings
    .filter(finding => finding.kind === 'file-spdx-differs-from-manifest')
    .map(finding => finding.path)
    .sort();
  assert.deepEqual(drift, []);
  assert.ok(report.findings.some(finding => finding.kind === 'third-party-license-unknown'));
  assert.ok(report.scope.disclaimer.includes('not legal advice'));
});

test('audit report does not replace the source license declarations', async () => {
  const manifest = JSON.parse(await readFile(new URL('../packages/quill-mcp/package.json', import.meta.url), 'utf8'));
  const source = await readFile(new URL('../packages/quill-mcp/src/tools/statcan-helper.ts', import.meta.url), 'utf8');
  assert.equal(manifest.license, 'AGPL-3.0-only');
  assert.match(source.split(/\r?\n/, 1)[0], /SPDX-License-Identifier: AGPL-3\.0-only/);
});

// ---------------------------------------------------------------------------
// Fixture-based generator tests.
//
// The real audit reads its dependency inventory from `pnpm licenses list`, so
// these fixtures put a stub `pnpm` on PATH instead of installing a workspace.
// That keeps the tests hermetic and lets them cover license metadata shapes the
// live repository does not currently contain (absent license field, compound
// SPDX expression, ungrouped unknown license).
// ---------------------------------------------------------------------------

const MIT_TEXT = 'MIT License\n\nCopyright (c) fixture\n\nPermission is hereby granted, free of charge, to any person obtaining a copy.\n';
const APACHE_TEXT = 'Apache License\nVersion 2.0, January 2004\n\nLicensed under the Apache License, Version 2.0.\n';

/** Dependency inventory shaped like `pnpm licenses list --json`, including the awkward cases. */
const FIXTURE_LICENSES = {
  MIT: [{ name: 'fixture-single', version: '1.0.0', versions: ['1.0.0'], license: 'MIT', author: 'Fixture' }],
  // No per-entry `license`: the audit must fall back to the group key.
  'Apache-2.0': [{ name: 'fixture-group-license', version: '2.3.4', versions: ['2.3.4'] }],
  // Compound SPDX expression, preserved verbatim rather than collapsed.
  'MIT OR Apache-2.0': [{ name: 'fixture-dual', version: '0.5.0', versions: ['0.5.0'], license: 'MIT OR Apache-2.0' }],
  // Missing license metadata entirely: must be reported, never guessed.
  UNKNOWN: [{ name: 'fixture-unknown', version: '0.0.1', versions: ['0.0.1'] }],
};

async function writeFixture(root) {
  await mkdir(path.join(root, 'bin'), { recursive: true });

  const pnpmStub = path.join(root, 'bin', 'pnpm');
  await writeFile(pnpmStub, [
    '#!/bin/sh',
    'printf "%s\\n" "$*" > "$FIXTURE_PNPM_ARGS"',
    "cat \"$FIXTURE_PNPM_LICENSES\"",
    '',
  ].join('\n'), 'utf8');
  await chmod(pnpmStub, 0o755);

  await writeFile(path.join(root, 'fixture-licenses.json'), JSON.stringify(FIXTURE_LICENSES), 'utf8');
  await writeFile(path.join(root, 'fixture-pnpm-args.txt'), '', 'utf8');

  await writeFile(path.join(root, 'package.json'), JSON.stringify({
    name: 'fixture-root',
    private: true,
    packageManager: 'pnpm@9.0.0',
  }), 'utf8');

  // Consistent package: manifest, license text, and SPDX headers all agree.
  await writePackage(root, 'consistent', { license: 'MIT' }, MIT_TEXT);
  await writeFile(path.join(root, 'packages/consistent/src/index.ts'),
    '// SPDX-License-Identifier: MIT\nexport const ok = true;\n', 'utf8');

  // Manifest declares MIT while the adjacent text is Apache-2.0.
  await writePackage(root, 'conflicting', { license: 'MIT' }, APACHE_TEXT);

  // Compound manifest expression with a single-license text and header.
  await writePackage(root, 'dual', { license: 'MIT OR Apache-2.0' }, APACHE_TEXT);
  await writeFile(path.join(root, 'packages/dual/src/index.ts'),
    '// SPDX-License-Identifier: MIT\nexport const dual = true;\n', 'utf8');

  // No package-level license expression, and a runtime dependency on it.
  await writePackage(root, 'undeclared', { dependencies: { 'fixture-undeclared': 'workspace:*' } }, MIT_TEXT);
  await writePackage(root, 'undeclared-consumer', { license: 'MIT', dependencies: { 'fixture-undeclared': 'workspace:*' } }, MIT_TEXT);

  return { pnpmArgs: path.join(root, 'fixture-pnpm-args.txt'), licenses: path.join(root, 'fixture-licenses.json') };
}

async function writePackage(root, name, manifest, licenseText) {
  const directory = path.join(root, 'packages', name);
  await mkdir(path.join(directory, 'src'), { recursive: true });
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: `fixture-${name}`, version: '0.0.0', ...manifest }), 'utf8');
  await writeFile(path.join(directory, 'LICENSE'), licenseText, 'utf8');
}

function runFixtureAudit(root, files, extraArgs = []) {
  const output = execFileSync(process.execPath, [script.pathname, '--format', 'json', ...extraArgs], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH}`,
      FIXTURE_PNPM_ARGS: files.pnpmArgs,
      FIXTURE_PNPM_LICENSES: files.licenses,
    },
  });
  return JSON.parse(output);
}

function findFinding(report, kind, packageName) {
  return report.findings.find(finding => finding.kind === kind && (!packageName || finding.package === packageName));
}

test('generator handles missing and compound license fields without inventing a grant', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'quill-audit-fixture-'));
  const files = await writeFixture(root);
  t.after(() => execFileSync('rm', ['-rf', root]));

  const report = runFixtureAudit(root, files);
  const byName = Object.fromEntries(report.installedDependencies.map(item => [item.name, item]));

  // Absent per-entry license falls back to the pnpm group key, and is not erased.
  assert.equal(byName['fixture-group-license'].license, 'Apache-2.0');
  // A compound expression is carried through verbatim rather than split or dropped.
  assert.equal(byName['fixture-dual'].license, 'MIT OR Apache-2.0');
  // Missing metadata stays missing and is surfaced as a high finding.
  assert.equal(byName['fixture-unknown'].license, 'UNKNOWN');
  assert.ok(findFinding(report, 'third-party-license-unknown')?.package.includes('fixture-unknown@0.0.1'));

  // Records are sorted by name so repeated runs are diffable.
  assert.deepEqual(report.installedDependencies.map(item => item.name), [...Object.keys(byName)].sort());
  assert.deepEqual(report.summary.dependencyLicenseGroups['MIT OR Apache-2.0'], 1);
  assert.deepEqual(report.summary.dependencyLicenseGroups.UNKNOWN, 1);

  // Per-package metadata findings: missing declaration, manifest/text conflict.
  assert.ok(findFinding(report, 'missing-manifest-license', 'fixture-undeclared'));
  assert.ok(findFinding(report, 'manifest-license-file-conflict', 'fixture-conflicting'));
  assert.equal(findFinding(report, 'manifest-license-file-conflict', 'fixture-consistent'), undefined);
  // Compound manifest expression containing the detected text is not a conflict.
  assert.equal(findFinding(report, 'manifest-license-file-conflict', 'fixture-dual'), undefined);

  // Workspace dependency without a declaration is a runtime exposure.
  const unlicensed = findFinding(report, 'runtime-workspace-dependency-unlicensed', 'fixture-undeclared-consumer');
  assert.equal(unlicensed?.dependency, 'fixture-undeclared');
  assert.equal(unlicensed?.severity, 'high');

  // Known limitation, asserted so it cannot regress silently: SPDX comparison is
  // textual, so a single-license header under a compound manifest expression is
  // reported as a difference even when it is a valid SPDX choice.
  const spdx = findFinding(report, 'file-spdx-differs-from-manifest', 'fixture-dual');
  assert.equal(spdx?.spdx, 'MIT');
  assert.equal(spdx?.manifestLicense, 'MIT OR Apache-2.0');
  assert.equal(findFinding(report, 'file-spdx-differs-from-manifest', 'fixture-consistent'), undefined);

  assert.equal(report.scope.disclaimer.includes('not legal advice'), true);
  assert.equal(report.scope.generatedFilesExcluded, true);
});

test('generator output is deterministic and honours the production-only scope flag', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'quill-audit-fixture-'));
  const files = await writeFixture(root);
  t.after(() => execFileSync('rm', ['-rf', root]));

  const first = runFixtureAudit(root, files);
  const second = runFixtureAudit(root, files);
  assert.equal(first.scope.dependencyInventoryCommand, 'pnpm licenses list --json');
  assert.equal(first.scope.dependencyInventoryScope.includes('including development'), true);
  assert.deepEqual({ ...first, generatedAt: null }, { ...second, generatedAt: null });
  // The scope flag is forwarded to pnpm, not applied as a post-filter.
  assert.match((await readFile(files.pnpmArgs, 'utf8')).trim(), /^licenses list --json$/);

  const prod = runFixtureAudit(root, files, ['--prod']);
  assert.equal(prod.scope.dependencyInventoryCommand, 'pnpm licenses list --prod --json');
  assert.equal(prod.scope.dependencyInventoryScope, 'production dependencies across installed workspace');
  assert.match((await readFile(files.pnpmArgs, 'utf8')).trim(), /^licenses list --prod --json$/);
});
