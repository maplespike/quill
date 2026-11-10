#!/usr/bin/env node
/**
 * Licence coherence gate.
 *
 * The rights holder chose AGPL-3.0-only for the whole repository on 2026-10-24
 * (issue #1044). Before that date the tree declared four different licences and
 * 453 tracked source headers disagreed with their package manifests, so a reader
 * could not tell what actually applied. This test fails the build if that drift
 * comes back.
 *
 * It checks manifests, per-package licence copies, source headers (`.mts` and
 * shebang scripts included), the Python and Rust manifests, the notices that
 * the repository must publish, and that no personal address is committed to a
 * public file.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LICENCE = 'AGPL-3.0-only';
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.mts', '.astro', '.py', '.rs']);
// Shebang scripts with no extension, or a shell extension, were outside SOURCE_EXT.
// The 2026-11 audit found two stale headers there. Scan them when they start with #!.
const SHEBANG_EXT = new Set(['', '.sh', '.bash']);
// Vendored third-party trees keep their own licence and are exempt.
const EXEMPT_PREFIXES = ['.agents/'];
// Identifiers the tree used before the 2026-10-24 decision. Only BLOCKED_BY_FLEET_GATE
// may still carry one.
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

test('root and every workspace manifest declare AGPL-3.0-only', () => {
  const root = readJson('package.json');
  assert.equal(root.license, LICENCE, 'root package.json license');

  const dirs = packageDirs();
  assert.ok(dirs.length >= 13, `expected at least 13 workspace packages, found ${dirs.length}`);
  for (const dir of dirs) {
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    assert.equal(pkg.license, LICENCE, `${pkg.name ?? path.basename(dir)} license`);
  }
});

test('every package-local LICENSE is a verbatim copy of the root licence', () => {
  const rootText = read('LICENSE');
  assert.match(rootText, /GNU AFFERO GENERAL PUBLIC LICENSE/, 'root LICENSE holds the AGPL text');
  assert.match(rootText, /Version 3, 19 November 2007/);

  for (const dir of packageDirs()) {
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
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
      continue;
    }
    assert.equal(text, rootText, `${pkg.name}/LICENSE must equal the root LICENSE byte for byte`);
  }
});

test('every first-party source header names AGPL-3.0-only', () => {
  const offenders = [];
  const seen = new Set();
  const stillExempt = new Set();
  for (const rel of gitTrackedFiles()) {
    if (EXEMPT_PREFIXES.some(prefix => rel.startsWith(prefix))) continue;
    const ext = path.extname(rel);
    const sourceFile = SOURCE_EXT.has(ext);
    const shebangCandidate = SHEBANG_EXT.has(ext);
    if (!sourceFile && !shebangCandidate) continue;
    let text;
    try {
      text = readFileSync(path.join(ROOT, rel), 'utf8');
    } catch {
      continue; // deleted in the index relative to the working tree
    }
    if (!sourceFile && !text.startsWith('#!')) continue;
    // Only the leading comment block counts: a header, not a string literal in a
    // test fixture that deliberately embeds an identifier.
    for (const line of text.split(/\r?\n/, 10)) {
      const match = SPDX_HEADER.exec(line);
      if (!match) continue;
      seen.add(match[1]);
      if (match[1] !== LICENCE) {
        if (BLOCKED_BY_FLEET_GATE.has(rel) && PRE_DECISION_HEADERS.has(match[1])) {
          stillExempt.add(rel);
        } else {
          offenders.push(`${rel}: ${match[1]}`);
        }
      }
      break;
    }
  }
  assert.ok(seen.size > 0, 'expected SPDX headers in the tree; the scanner found none');
  assert.deepEqual(offenders, [], `headers that disagree with the repository licence:\n${offenders.join('\n')}`);
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

test('Python and Rust manifests declare AGPL-3.0-only', () => {
  const pyproject = read('packages', 'sdk-python', 'pyproject.toml');
  assert.match(pyproject, /^license = "AGPL-3\.0-only"$/m);

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
});

test('README and LICENSE.md state the licence and point at NOTICE', () => {
  const readme = read('README.md');
  assert.match(readme, /AGPL-3\.0-only/);
  assert.match(readme, /\[`NOTICE`\]\(\.\/NOTICE\)/, 'README must link NOTICE');

  const statement = read('LICENSE.md');
  assert.match(statement, /^status: final$/m, 'LICENSE.md must not stay audit-required');
  assert.match(statement, /AGPL-3\.0-only/);
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
