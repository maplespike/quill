#!/usr/bin/env node
/**
 * Licence coherence gate.
 *
 * The rights holder chose AGPL-3.0-only for the repository on 2026-10-24
 * (issue #1044). On 2026-11-10 the client SDKs (packages/sdk and packages/sdk-*)
 * were relicensed to Apache-2.0. The servers stay AGPL-3.0-only: api-server,
 * quill-mcp, pipeline-core, database, and engine.
 *
 * Before 2026-10-24 the tree declared four different licences and 453 tracked
 * source headers disagreed with their package manifests. This test fails the
 * build if that drift comes back.
 *
 * It checks manifests, per-package licence copies, source headers, the Python and
 * Rust manifests, the notices that the repository must publish, and that no
 * personal address is committed to a public file. Server and SDK source files
 * must carry the matching SPDX header. Generated files, vendored files, and data
 * files are skipped. The SEDI paths are skipped too, and the gate does not
 * require those files to exist.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_LICENCE = 'AGPL-3.0-only';
const SDK_LICENCE = 'Apache-2.0';
const LICENCE = SERVER_LICENCE;
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.astro', '.py', '.rs']);
// Extensions that must carry an SPDX header inside the server and SDK packages.
const HEADER_SOURCE_EXT = new Set([
  '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rs', '.sh', '.bash', '.sql', '.astro',
]);
const SERVER_PREFIXES = [
  'packages/api-server/',
  'packages/quill-mcp/',
  'packages/pipeline-core/',
  'packages/database/',
  'packages/engine/',
];
// Vendored third-party trees keep their own licence and are exempt.
const EXEMPT_PREFIXES = ['.agents/'];
const VENDORED_DIR_PARTS = ['/vendor/', '/vendored/', '/third_party/', '/third-party/'];
const GENERATED_DIR_PARTS = ['/dist/', '/node_modules/', '/coverage/', '/.turbo/', '/.astro/'];
const GENERATED_SUFFIXES = ['.generated.ts', '.gen.ts'];
// Data and config. These are not first-party source, so they carry no SPDX header.
const DATA_EXT = new Set([
  '.json', '.yaml', '.yml', '.toml', '.csv', '.tsv', '.xml',
  '.txt', '.md', '.html', '.svg', '.png', '.webp', '.gif', '.jpg', '.jpeg',
]);
const DATA_PREFIXES = [
  'packages/pipeline-core/data/',
  'packages/quill-mcp/i18n/',
];
const DATA_FILES = new Set([
  'packages/pipeline-core/data/municipal-discovered-ids.json',
  'packages/quill-mcp/i18n/fr-tools.json',
  'packages/quill-mcp/src/tools/tool-index.json',
  'packages/engine/src/trigger.txt',
]);
// Another PR deletes these. Do not require a header, and do not fail when the
// paths are already gone.
const SEDI_PREFIX = 'packages/pipeline-core/src/ingestion/sedi/';
const SEDI_FILES = [
  'packages/pipeline-core/src/ingestion/corporate/sedi.ts',
  'packages/quill-mcp/src/tools/search-sedi.ts',
];
// Identifiers the tree used before the 2026-10-24 decision. Only BLOCKED_BY_FLEET_GATE
// may still carry one, and only outside the SDK packages. Apache-2.0 on an SDK
// file is the current licence, not a leftover.
const PRE_DECISION_HEADERS = new Set(['AGPL-3.0-or-later', 'MIT', 'Apache-2.0']);

// Files the fleet pre-commit gate (leakguard) refuses to stage, because they
// contain a city name that patterns.txt lists as an identity string. In this
// repository that name is Canadian public data. The 2026-10-26 follow-up
// converted the last headers and the last personal User-Agent addresses, so
// the list is empty. Add a path only when a file still carries a pre-decision
// header or a personal address and cannot be staged. The test fails if a
// listed file has already converted, so the exemption cannot rot.
const BLOCKED_BY_FLEET_GATE = new Set([]);

// The maintainer's personal address, built from fragments so that this file does
// not itself carry the string that the gate blocks.
const PERSONAL_ADDRESS = new RegExp('j[_-]kr' + 'oeker', 'i');

// The status page falls back to a personal Cloudflare Workers host when the edge
// URL is not configured. Changing that fallback changes runtime behaviour, so it
// belongs to the hostname scrub, not to this licence change. Until then the file
// is named here so the residual stays visible.
const PERSONAL_HOST_EXEMPT = new Set(['packages/portal/src/pages/status.astro']);

const read = (...parts) => readFileSync(path.join(ROOT, ...parts), 'utf8');
const readJson = (...parts) => JSON.parse(read(...parts));

function gitTrackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z', '--cached'], { cwd: ROOT, encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

function packageDirs() {
  const base = path.join(ROOT, 'packages');
  return readdirSync(base)
    .map(name => path.join(base, name))
    .filter(dir => {
      try {
        return statSync(path.join(dir, 'package.json')).isFile();
      } catch {
        return false;
      }
    });
}

const SPDX_HEADER = /^[ \t]*(?:\/\/|\*|#)[ \t]*SPDX-License-Identifier:[ \t]*(\S+)[ \t]*$/;
const SPDX_LINE = /^[ \t]*(?:\/\/|--|#)[ \t]*SPDX-License-Identifier:[ \t]*(\S+)[ \t]*$/;

function relFrom(dir) {
  return path.relative(ROOT, dir).split(path.sep).join('/');
}

function isSdkPath(rel) {
  return rel === 'packages/sdk' || rel.startsWith('packages/sdk/') || rel.startsWith('packages/sdk-');
}

function isServerPath(rel) {
  return SERVER_PREFIXES.some(prefix => rel.startsWith(prefix));
}

function isSediPath(rel) {
  return rel.startsWith(SEDI_PREFIX) || SEDI_FILES.includes(rel);
}

function isGeneratedPath(rel) {
  return GENERATED_DIR_PARTS.some(part => rel.includes(part))
    || GENERATED_SUFFIXES.some(suffix => rel.endsWith(suffix));
}

function isVendoredPath(rel) {
  return EXEMPT_PREFIXES.some(prefix => rel.startsWith(prefix))
    || VENDORED_DIR_PARTS.some(part => rel.includes(part));
}

function isDataPath(rel) {
  return DATA_PREFIXES.some(prefix => rel.startsWith(prefix))
    || DATA_FILES.has(rel)
    || DATA_EXT.has(path.extname(rel));
}

function isHeaderSource(rel, text) {
  if (HEADER_SOURCE_EXT.has(path.extname(rel))) return true;
  return path.extname(rel) === '' && text.startsWith('#!');
}

function packageLicence(rel) {
  return isSdkPath(rel) ? SDK_LICENCE : SERVER_LICENCE;
}

/**
 * What the header gate requires for a path.
 * `skip-*` values are explicit exclusions. A licence id means the file must
 * carry that SPDX header. `out-of-scope` means this gate does not require one.
 */
function headerRequirement(rel, text = '') {
  if (isSediPath(rel)) return 'skip-sedi';
  if (isGeneratedPath(rel)) return 'skip-generated';
  if (isVendoredPath(rel)) return 'skip-vendored';
  if (isDataPath(rel)) return 'skip-data';
  if (!isServerPath(rel) && !isSdkPath(rel)) return 'out-of-scope';
  if (!isHeaderSource(rel, text)) return 'skip-not-source';
  return packageLicence(rel);
}

test('root and workspace manifests declare the licence for their package', () => {
  const root = readJson('package.json');
  assert.equal(root.license, SERVER_LICENCE, 'root package.json license');

  const dirs = packageDirs();
  assert.ok(dirs.length >= 13, `expected at least 13 workspace packages, found ${dirs.length}`);
  const seenSdk = [];
  for (const dir of dirs) {
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const rel = relFrom(dir);
    const expected = packageLicence(rel);
    if (expected === SDK_LICENCE) seenSdk.push(rel);
    assert.equal(pkg.license, expected, `${pkg.name ?? rel} license`);
  }
  assert.deepEqual(seenSdk, ['packages/sdk']);
});

test('package LICENSE files match the licence of that package', () => {
  const rootText = read('LICENSE');
  assert.match(rootText, /GNU AFFERO GENERAL PUBLIC LICENSE/, 'root LICENSE holds the AGPL text');
  assert.match(rootText, /Version 3, 19 November 2007/);

  const apache = read('packages', 'sdk', 'LICENSE');
  assert.match(apache, /Apache License/);
  assert.match(apache, /Version 2\.0, January 2004/);
  assert.notEqual(apache, rootText);
  assert.equal(read('packages', 'sdk-python', 'LICENSE'), apache, 'sdk-python LICENSE');
  assert.equal(read('packages', 'sdk-shell', 'LICENSE'), apache, 'sdk-shell LICENSE');
  // database is private, and it still ships the AGPL text.
  assert.equal(read('packages', 'database', 'LICENSE'), rootText, 'database LICENSE');

  for (const dir of packageDirs()) {
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const rel = relFrom(dir);
    const licencePath = path.join(dir, 'LICENSE');
    let text = null;
    try {
      text = readFileSync(licencePath, 'utf8');
    } catch {
      text = null;
    }
    if (text === null) {
      // A package that can be published on its own must ship the licence text.
      assert.equal(pkg.private, true, `${pkg.name} is publishable, so it must contain a LICENSE copy`);
      assert.equal(isSdkPath(rel), false, `${pkg.name} is an SDK, so it must contain an Apache-2.0 LICENSE`);
      continue;
    }
    const expected = isSdkPath(rel) ? apache : rootText;
    assert.equal(text, expected, `${pkg.name}/LICENSE must match its package licence byte for byte`);
  }
});

test('every first-party source header names the licence of its package', () => {
  const offenders = [];
  const seen = new Set();
  const stillExempt = new Set();
  for (const rel of gitTrackedFiles()) {
    if (isVendoredPath(rel)) continue;
    if (!SOURCE_EXT.has(path.extname(rel))) continue;
    let text;
    try {
      text = readFileSync(path.join(ROOT, rel), 'utf8');
    } catch {
      continue; // deleted in the index relative to the working tree
    }
    // Only the leading comment block counts: a header, not a string literal in a
    // test fixture that deliberately embeds an identifier.
    for (const line of text.split(/\r?\n/, 10)) {
      const match = SPDX_HEADER.exec(line);
      if (!match) continue;
      seen.add(match[1]);
      const expected = packageLicence(rel);
      if (match[1] !== expected) {
        if (BLOCKED_BY_FLEET_GATE.has(rel) && PRE_DECISION_HEADERS.has(match[1]) && !isSdkPath(rel)) {
          stillExempt.add(rel);
        } else {
          offenders.push(`${rel}: ${match[1]}`);
        }
      }
      break;
    }
  }
  assert.ok(seen.has(SERVER_LICENCE), 'expected AGPL-3.0-only headers in the tree');
  assert.ok(seen.has(SDK_LICENCE), 'expected Apache-2.0 headers on the SDKs');
  assert.equal(stillExempt.size, BLOCKED_BY_FLEET_GATE.size);
  assert.deepEqual(offenders, [], `headers that disagree with the package licence:\n${offenders.join('\n')}`);
});

test('server and SDK source files carry the correct SPDX header', () => {
  const missing = [];
  const wrong = [];
  const counts = {};
  for (const rel of gitTrackedFiles()) {
    let text = '';
    const needsRead = isServerPath(rel) || isSdkPath(rel);
    if (needsRead) {
      try {
        text = readFileSync(path.join(ROOT, rel), 'utf8');
      } catch {
        continue; // deleted in the index relative to the working tree
      }
    }
    const requirement = headerRequirement(rel, text);
    if (requirement.startsWith('skip-') || requirement === 'out-of-scope') continue;
    const pkg = rel.split('/').slice(0, 2).join('/');
    counts[pkg] = (counts[pkg] ?? 0) + 1;
    const lines = text.split(/\r?\n/);
    const idx = lines[0].startsWith('#!') ? 1 : 0;
    const match = SPDX_LINE.exec(lines[idx] ?? '');
    if (!match) missing.push(rel);
    else if (match[1] !== requirement) wrong.push(`${rel}: ${match[1]}`);
  }
  assert.ok(counts['packages/api-server'] >= 100, 'api-server headers');
  assert.ok(counts['packages/quill-mcp'] >= 100, 'quill-mcp headers');
  assert.ok(counts['packages/pipeline-core'] >= 900, 'pipeline-core headers');
  assert.ok(counts['packages/database'] >= 5, 'database headers');
  assert.ok(counts['packages/engine'] >= 50, 'engine headers');
  assert.ok(counts['packages/sdk'] >= 10, 'sdk headers');
  assert.ok(counts['packages/sdk-python'] >= 8, 'sdk-python headers');
  assert.equal(counts['packages/sdk-shell'], 1, 'sdk-shell headers');
  const checked = Object.values(counts).reduce((sum, n) => sum + n, 0);
  assert.ok(checked >= 1500, `expected the server and SDK sources, checked ${checked}`);
  assert.deepEqual(missing, [], `source files with no SPDX header:\n${missing.join('\n')}`);
  assert.deepEqual(wrong, [], `source files with the wrong SPDX header:\n${wrong.join('\n')}`);
});

test('generated, vendored, data, and SEDI paths are explicit header exemptions', () => {
  assert.equal(headerRequirement('packages/quill-mcp/src/tools/tool-index.json'), 'skip-data');
  assert.equal(headerRequirement('packages/quill-mcp/i18n/fr-tools.json'), 'skip-data');
  assert.equal(headerRequirement('packages/pipeline-core/data/municipal-discovered-ids.json'), 'skip-data');
  assert.equal(headerRequirement('packages/engine/src/trigger.txt'), 'skip-data');
  assert.equal(headerRequirement('packages/api-server/package.json'), 'skip-data');
  assert.equal(headerRequirement('packages/pipeline-core/dist/index.js'), 'skip-generated');
  assert.equal(headerRequirement('packages/pipeline-core/src/ingestion/foo.generated.ts'), 'skip-generated');
  assert.equal(headerRequirement('packages/engine/vendor/leftpad.ts'), 'skip-vendored');
  assert.equal(headerRequirement('packages/pipeline-core/third_party/lib.ts'), 'skip-vendored');
  assert.equal(headerRequirement('packages/pipeline-core/src/ingestion/sedi/index.ts'), 'skip-sedi');
  assert.equal(headerRequirement('packages/pipeline-core/src/ingestion/sedi/__tests__/sedi.test.ts'), 'skip-sedi');
  assert.equal(headerRequirement('packages/pipeline-core/src/ingestion/corporate/sedi.ts'), 'skip-sedi');
  assert.equal(headerRequirement('packages/quill-mcp/src/tools/search-sedi.ts'), 'skip-sedi');
  // Absence is allowed. The walker never opens a path that git does not track.
  const tracked = new Set(gitTrackedFiles());
  assert.equal(tracked.has('packages/pipeline-core/src/ingestion/sedi/this-file-is-not-real.ts'), false);
  assert.equal(headerRequirement('packages/database/src/schema.ts', read('packages', 'database', 'src', 'schema.ts')), SERVER_LICENCE);
  assert.equal(headerRequirement('packages/sdk/src/index.ts', read('packages', 'sdk', 'src', 'index.ts')), SDK_LICENCE);
  assert.equal(headerRequirement('packages/sdk-shell/maplespike', read('packages', 'sdk-shell', 'maplespike')), SDK_LICENCE);
  assert.equal(headerRequirement('packages/sdk/LICENSE', read('packages', 'sdk', 'LICENSE')), 'skip-not-source');
});

test('the fleet-gate exemption list stays honest', () => {
  const missing = [];
  const stale = [];
  for (const rel of BLOCKED_BY_FLEET_GATE) {
    if (!existsSync(path.join(ROOT, rel))) {
      missing.push(rel);
      continue;
    }
    const text = readFileSync(path.join(ROOT, rel), 'utf8');
    const header = text
      .split(/\r?\n/, 10)
      .map(line => SPDX_HEADER.exec(line))
      .find(Boolean);
    if (header && header[1] === LICENCE) stale.push(rel);
  }
  assert.deepEqual(missing, [], `exempted paths no longer exist:\n${missing.join('\n')}`);
  assert.deepEqual(stale, [], `these paths are converted; remove them from BLOCKED_BY_FLEET_GATE:\n${stale.join('\n')}`);
});

test('Python SDK is Apache-2.0 and the Rust workspace stays AGPL-3.0-only', () => {
  const pyproject = read('packages', 'sdk-python', 'pyproject.toml');
  assert.match(pyproject, /^license = "Apache-2\.0"$/m);
  assert.match(pyproject, /License :: OSI Approved :: Apache Software License/);

  const cargo = read('rust', 'Cargo.toml');
  assert.match(cargo, /^license = "AGPL-3\.0-only"$/m);
});

test('NOTICE carries the attribution and copyright notices that the product must reproduce', () => {
  const notice = read('NOTICE');
  // Normalise dash variants: the official statement uses an en dash, a copy of it
  // may use a hyphen. Both are the same notice for this check.
  const flat = notice.replace(/[\u2012-\u2015]/g, '-').replace(/\s+/g, ' ');
  assert.match(flat, /Contains information licensed under the Open Government Licence - Canada/);
  assert.match(notice, /https:\/\/open\.canada\.ca\/en\/open-government-licence-canada/);
  assert.match(flat, /Crown copyright/i);
  assert.match(flat, /House of Commons/);
  assert.match(flat, /Senate of Canada/);
  assert.match(flat, /Reproduction of Federal Law Order/);
  assert.match(flat, /Statistics Canada/);
  assert.match(flat, /Not affiliated with or endorsed by the Government of Canada/);
  assert.match(flat, /Versions already published under Apache-2\.0 keep that licence/);
  assert.match(notice, /@reverb256\/mcp-server/);
  assert.match(notice, /0\.4\.0/);
  assert.match(notice, /SPDX-License-Identifier: AGPL-3\.0-only/);
  assert.match(notice, /SPDX-License-Identifier: Apache-2\.0/);
  assert.match(notice, /api-server/);
  assert.match(notice, /packages\/sdk-python/);
  assert.match(flat, /Open Data Licence Agreement/);
  assert.match(notice, /https:\/\/lobbycanada\.gc\.ca\/en\/open-data\/open-data-licence-agreement\//);
  assert.match(notice, /https:\/\/www\.statcan\.gc\.ca\/en\/reference\/licence/);
});

test('README and LICENSE.md state the licence and point at NOTICE', () => {
  const readme = read('README.md');
  assert.match(readme, /AGPL-3\.0-only/);
  assert.match(readme, /Apache-2\.0/);
  assert.match(readme, /SPDX-License-Identifier: AGPL-3\.0-only/);
  assert.match(readme, /SPDX-License-Identifier: Apache-2\.0/);
  assert.match(readme, /\[`NOTICE`\]\(\.\/NOTICE\)/, 'README must link NOTICE');

  const statement = read('LICENSE.md');
  assert.match(statement, /^status: final$/m, 'LICENSE.md must not stay audit-required');
  assert.match(statement, /AGPL-3\.0-only/);
  assert.match(statement, /Apache-2\.0/);
  assert.match(statement, /packages\/sdk-shell/);
});

test('no personal address in tracked first-party files', () => {
  // The User-Agent contact, the Helm maintainer, and the package author use
  // hello@maplespike.ca, the address published on maplespike.ca. A personal
  // address in a public tree fails this test.
  const offenders = [];
  for (const rel of gitTrackedFiles()) {
    if (EXEMPT_PREFIXES.some(prefix => rel.startsWith(prefix))) continue;
    if (BLOCKED_BY_FLEET_GATE.has(rel)) continue; // cannot stage; tracked separately
    if (PERSONAL_HOST_EXEMPT.has(rel)) continue; // runtime fallback; see note above
    let text;
    try {
      text = readFileSync(path.join(ROOT, rel), 'utf8');
    } catch {
      continue;
    }
    if (PERSONAL_ADDRESS.test(text)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `personal address in a public file:\n${offenders.join('\n')}`);
});

test('the public contact is hello@maplespike.ca and no dev mailbox remains', () => {
  // Split so this file does not itself contain the retired mailbox.
  const retired = 'dev' + '@maplespike.ca';
  const offenders = [];
  for (const rel of gitTrackedFiles()) {
    if (EXEMPT_PREFIXES.some(prefix => rel.startsWith(prefix))) continue;
    let text;
    try {
      text = readFileSync(path.join(ROOT, rel), 'utf8');
    } catch {
      continue;
    }
    if (text.includes(retired)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `retired mailbox remains in:\n${offenders.join('\n')}`);
  assert.match(read('charts', 'quill', 'Chart.yaml'), /email: hello@maplespike\.ca/);
  assert.match(read('packages', 'quill-mcp', 'README.md'), /Versions already published under Apache-2\.0 keep that licence/);
  assert.match(read('packages', 'quill-mcp', 'README.md'), /AGPL-3\.0-only/);
});
