/**
 * Pure helpers for the public export.
 * scripts/oss-export.mjs performs the copy, the scan, and the build.
 */

import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PUBLIC_PACKAGES = [
  'packages/api-server',
  'packages/quill-mcp',
  'packages/pipeline-core',
  'packages/database',
  'packages/engine',
];

export const REQUIRED_RULE_IDS = [
  '10.x',
  '192.168',
  '100.64/10',
  'ts.net',
  'nexus',
  'zephyr',
  'sentry',
  'forge',
  'home',
  'data-projects',
  'kroeker',
  'j_kro',
  'sk_live',
  'whsec_',
  'AGE-SECRET-KEY',
  'pk_live_',
];

const SKIP_DIR = new Set(['node_modules', 'dist', '.git', '.turbo', 'coverage', '.pnpm']);

const KEEP_DEV = [
  '@eslint/js',
  'eslint',
  'globals',
  'tsx',
  'turbo',
  'typescript',
  'typescript-eslint',
];

export function parseSimpleYaml(input) {
  const lines = [];
  const rawLines = String(input).split('\n');
  for (let index = 0; index < rawLines.length; index += 1) {
    const stripped = stripComment(rawLines[index]);
    if (!stripped.trim()) continue;
    const indent = stripped.match(/^ */)[0].length;
    lines.push({ indent, text: stripped.trim(), line: index + 1 });
  }

  let cursor = 0;

  function parse(minIndent) {
    if (cursor >= lines.length || lines[cursor].indent < minIndent) return null;
    if (lines[cursor].text.startsWith('- ')) return parseSequence(lines[cursor].indent);
    return parseMap(lines[cursor].indent);
  }

  function parseSequence(indent) {
    const out = [];
    while (cursor < lines.length && lines[cursor].indent === indent && lines[cursor].text.startsWith('- ')) {
      const itemText = lines[cursor].text.slice(2).trim();
      const itemLine = lines[cursor];
      cursor += 1;
      if (!itemText) {
        out.push(parse(indent + 1));
        continue;
      }
      const field = splitKeyValue(itemText);
      if (!field) {
        out.push(parseScalar(itemText));
        continue;
      }
      const obj = {};
      if (!field.hasValue) {
        obj[field.key] = cursor < lines.length && lines[cursor].indent > itemLine.indent
          ? parse(lines[cursor].indent)
          : null;
      } else {
        obj[field.key] = parseScalar(field.value);
      }
      while (
        cursor < lines.length
        && lines[cursor].indent > itemLine.indent
        && !lines[cursor].text.startsWith('- ')
      ) {
        const next = splitKeyValue(lines[cursor].text);
        const nextIndent = lines[cursor].indent;
        if (!next) break;
        cursor += 1;
        if (!next.hasValue) {
          obj[next.key] = cursor < lines.length && lines[cursor].indent > nextIndent
            ? parse(lines[cursor].indent)
            : null;
        } else {
          obj[next.key] = parseScalar(next.value);
        }
      }
      out.push(obj);
    }
    return out;
  }

  function parseMap(indent) {
    const out = {};
    while (
      cursor < lines.length
      && lines[cursor].indent === indent
      && !lines[cursor].text.startsWith('- ')
    ) {
      const field = splitKeyValue(lines[cursor].text);
      if (!field) throw new Error(`Bad YAML at line ${lines[cursor].line}: ${lines[cursor].text}`);
      cursor += 1;
      if (!field.hasValue) {
        out[field.key] = cursor < lines.length && lines[cursor].indent > indent
          ? parse(lines[cursor].indent)
          : null;
      } else {
        out[field.key] = parseScalar(field.value);
      }
    }
    return out;
  }

  if (lines.length === 0) return null;
  return parse(lines[0].indent);
}

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote && line[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#' && (i === 0 || line[i - 1] === ' ')) return line.slice(0, i);
  }
  return line;
}

function splitKeyValue(text) {
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ':') {
      const key = parseScalar(text.slice(0, i).trim());
      const rest = text.slice(i + 1).trim();
      return { key: String(key), value: rest, hasValue: rest.length > 0 };
    }
  }
  return null;
}

function parseScalar(text) {
  const value = text.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  return value;
}

export function emitYaml(value, indent = 0) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]\n`;
    return value.map((item) => {
      if (item && typeof item === 'object') {
        const body = emitYaml(item, indent + 2).replace(/\n$/, '');
        const [first, ...rest] = body.split('\n');
        return `${pad}- ${first.trim()}\n${rest.map((line) => `${pad}  ${line.trimEnd()}`).join('\n')}${rest.length ? '\n' : ''}`;
      }
      return `${pad}- ${JSON.stringify(item)}\n`;
    }).join('');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => {
      if (item && typeof item === 'object') {
        return `${pad}${JSON.stringify(key)}:\n${emitYaml(item, indent + 2)}`;
      }
      return `${pad}${JSON.stringify(key)}: ${JSON.stringify(item)}\n`;
    }).join('');
  }
  return `${pad}${JSON.stringify(value)}\n`;
}

export function normalizeRel(rel) {
  return String(rel).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function matchPathGlob(rel, pattern) {
  if (pattern.startsWith('**/')) {
    const rest = pattern.slice(3);
    return rel.split('/').some((part) => matchPathGlob(part, rest))
      || matchPathGlob(rel, rest);
  }
  const source = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${source}$`).test(rel);
}

export function isExcluded(rel, manifest) {
  const norm = normalizeRel(rel);
  const paths = manifest.exclude?.paths ?? [];
  for (const excluded of paths) {
    const prefix = normalizeRel(excluded);
    if (norm === prefix || norm.startsWith(`${prefix}/`)) return true;
  }
  const globs = manifest.exclude?.globs ?? [];
  if (globs.some((pattern) => matchPathGlob(norm, pattern))) return true;
  const tagged = manifest.exclude?.tagged_tests ?? [];
  return tagged.includes(norm);
}

export function hasPrivateOnlyTag(text, tag = 'oss-export: private-only') {
  return String(text).split('\n').slice(0, 40).join('\n').includes(tag);
}

export function isAllowlisted(rel, manifest) {
  const norm = normalizeRel(rel);
  const parts = norm.split('/');
  if (parts.length === 1) return (manifest.allow?.root_files ?? []).includes(norm);
  if ((manifest.allow?.root_dirs ?? []).includes(parts[0])) return true;
  if (parts[0] !== 'packages') return false;
  const name = parts[1];
  if ((manifest.allow?.packages ?? []).includes(name)) return true;
  return (manifest.allow?.package_globs ?? []).some((pattern) => matchPathGlob(name, pattern));
}

export function shouldCopy(rel, manifest, head = '') {
  const norm = normalizeRel(rel);
  if (!norm || norm.split('/').some((part) => SKIP_DIR.has(part))) return false;
  if (isExcluded(norm, manifest)) return false;
  const tag = manifest.exclude?.tag ?? 'oss-export: private-only';
  if (head && hasPrivateOnlyTag(head, tag)) return false;
  return isAllowlisted(norm, manifest);
}

export function compileRules(manifest) {
  const rules = manifest.scan?.rules ?? [];
  return rules.map((rule) => ({
    id: rule.id,
    re: new RegExp(rule.pattern, 'gi'),
    allowPaths: new Set(rule.allow_paths ?? []),
  }));
}

export function scanText(rel, text, rules) {
  const hits = [];
  const lines = String(text).split('\n');
  for (const rule of rules) {
    lines.forEach((line, index) => {
      rule.re.lastIndex = 0;
      let match;
      while ((match = rule.re.exec(line)) !== null) {
        if (rule.allowPaths.has(normalizeRel(rel))) continue;
        hits.push({
          file: normalizeRel(rel),
          line: index + 1,
          rule: rule.id,
          match: match[0],
        });
        if (match[0].length === 0) rule.re.lastIndex += 1;
      }
    });
  }
  return hits;
}

export function groupHits(hits) {
  const grouped = new Map();
  for (const hit of hits) {
    if (!grouped.has(hit.file)) grouped.set(hit.file, []);
    grouped.get(hit.file).push(hit);
  }
  return grouped;
}

export function formatHitReport(hits) {
  if (hits.length === 0) return 'Forbidden-string scan: no hits.\n';
  const lines = [`Forbidden-string scan: ${hits.length} hit${hits.length === 1 ? '' : 's'}.`];
  for (const [file, group] of groupHits(hits)) {
    lines.push(file);
    for (const hit of group) {
      lines.push(`  ${hit.line}  [${hit.rule}]  ${hit.match}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function trimPackageJson(pkg) {
  const devDependencies = {};
  for (const name of KEEP_DEV) {
    if (pkg.devDependencies?.[name]) devDependencies[name] = pkg.devDependencies[name];
  }
  return {
    name: 'quill',
    version: pkg.version,
    private: true,
    description: 'Quill API and MCP server for Canadian public data',
    license: 'AGPL-3.0-only',
    packageManager: pkg.packageManager,
    engines: pkg.engines,
    workspaces: [...PUBLIC_PACKAGES],
    scripts: {
      build: 'turbo build',
      test: 'turbo test',
      lint: 'pnpm --filter @maplespike/api-server lint && pnpm --filter @maplespike/quill-mcp lint',
      typecheck: 'tsc -b --pretty false',
      clean: 'rm -rf packages/*/dist packages/*/tsconfig.tsbuildinfo',
    },
    dependencies: pkg.dependencies ?? {},
    devDependencies,
    overrides: pkg.overrides ?? {},
  };
}

export function publicWorkspaceDocument(source) {
  return {
    packages: [...PUBLIC_PACKAGES],
    ...(source.syncInjectedDepsAfterScripts
      ? { syncInjectedDepsAfterScripts: source.syncInjectedDepsAfterScripts }
      : {}),
    ...(source.onlyBuiltDependencies
      ? { onlyBuiltDependencies: source.onlyBuiltDependencies }
      : {}),
    ...(source.overrides ? { overrides: source.overrides } : {}),
  };
}

export function trimTsconfig(doc) {
  const keep = new Set(PUBLIC_PACKAGES);
  return {
    ...doc,
    references: (doc.references ?? []).filter((ref) => keep.has(ref.path)),
  };
}

export function stampSdkSource(text) {
  const lines = String(text).split('\n');
  const limit = Math.min(lines.length, 15);
  for (let i = 0; i < limit; i += 1) {
    if (!lines[i].includes('SPDX-License-Identifier:')) continue;
    lines[i] = lines[i]
      .replace('AGPL-3.0-only', 'Apache-2.0')
      .replace('MIT', 'Apache-2.0');
    break;
  }
  return lines.join('\n');
}

export function stampPyproject(text) {
  return String(text)
    .replace(/^license = "AGPL-3\.0-only"$/m, 'license = "Apache-2.0"')
    .replace(
      'License :: OSI Approved :: GNU Affero General Public License v3',
      'License :: OSI Approved :: Apache Software License',
    );
}

export function phaseNames(argv = []) {
  if (argv.includes('--scan-only')) return ['materialize', 'scan'];
  return ['materialize', 'scan', 'install', 'build', 'test'];
}

export function gitleaksArgs(dest, bin = 'gitleaks') {
  return [
    bin,
    'detect',
    '--source', dest,
    '--no-git',
    '--redact',
    '--exit-code', '1',
    '--config', `${dest}/.gitleaks.toml`,
  ];
}

export function pnpmCommands() {
  return [
    ['pnpm', 'install'],
    ['pnpm', 'run', 'build'],
    ['pnpm', 'run', 'test'],
  ];
}

async function walkFiles(root, prefix = '') {
  const out = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIR.has(entry.name)) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...await walkFiles(abs, rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

async function readHead(abs) {
  const info = await stat(abs);
  if (info.size > 1024 * 1024) return '';
  const buf = await readFile(abs);
  if (buf.includes(0)) return '';
  return buf.subarray(0, 4000).toString('utf8');
}

export async function materializeExport(sourceRoot, destRoot, manifest) {
  await rm(destRoot, { recursive: true, force: true });
  await mkdir(destRoot, { recursive: true });
  const files = await walkFiles(sourceRoot);
  for (const rel of files) {
    const abs = path.join(sourceRoot, rel);
    const head = await readHead(abs);
    if (!shouldCopy(rel, manifest, head)) continue;
    const target = path.join(destRoot, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(abs, target);
  }
  await applyTransforms(sourceRoot, destRoot, manifest);
  await applyOverlay(path.join(sourceRoot, manifest.overlay), destRoot);
}

async function applyTransforms(sourceRoot, destRoot, manifest) {
  const pkgPath = path.join(destRoot, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  await writeFile(pkgPath, `${JSON.stringify(trimPackageJson(pkg), null, 2)}\n`);

  const workspaceSource = parseSimpleYaml(await readFile(path.join(sourceRoot, 'pnpm-workspace.yaml'), 'utf8'));
  await writeFile(
    path.join(destRoot, 'pnpm-workspace.yaml'),
    emitYaml(publicWorkspaceDocument(workspaceSource)),
  );

  const tsconfigPath = path.join(destRoot, 'tsconfig.json');
  const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf8'));
  await writeFile(tsconfigPath, `${JSON.stringify(trimTsconfig(tsconfig), null, 2)}\n`);

  if (manifest.transforms?.sdk_license === 'Apache-2.0') {
    await stampSdkPackages(destRoot, sourceRoot, manifest);
  }
}

async function stampSdkPackages(destRoot, sourceRoot, manifest) {
  const apache = await readFile(path.join(sourceRoot, manifest.overlay, 'licenses', 'Apache-2.0.txt'));
  const packagesDir = path.join(destRoot, 'packages');
  const names = await readdir(packagesDir);
  for (const name of names) {
    if (!(manifest.allow?.package_globs ?? []).some((pattern) => matchPathGlob(name, pattern))) continue;
    const dir = path.join(packagesDir, name);
    await writeFile(path.join(dir, 'LICENSE'), apache);
    await rewriteTree(dir, async (rel, abs) => {
      if (rel.endsWith('pyproject.toml')) {
        const text = await readFile(abs, 'utf8');
        await writeFile(abs, stampPyproject(text));
        return;
      }
      if (rel === 'LICENSE') return;
      const info = await stat(abs);
      if (info.size > 1024 * 1024) return;
      const buf = await readFile(abs);
      if (buf.includes(0)) return;
      const text = buf.toString('utf8');
      const stamped = stampSdkSource(text);
      if (stamped !== text) await writeFile(abs, stamped);
    });
  }
}

async function rewriteTree(root, visit, prefix = '') {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      await rewriteTree(abs, visit, rel);
    } else if (entry.isFile()) {
      await visit(rel, abs);
    }
  }
}

async function applyOverlay(overlayRoot, destRoot) {
  const files = await walkFiles(overlayRoot);
  for (const rel of files) {
    const target = path.join(destRoot, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(overlayRoot, rel), target);
  }
}

export async function scanExportTree(destRoot, manifest) {
  const rules = compileRules(manifest);
  const files = await walkFiles(destRoot);
  const hits = [];
  for (const rel of files) {
    const abs = path.join(destRoot, rel);
    const info = await stat(abs);
    if (info.size > 2 * 1024 * 1024) continue;
    const buf = await readFile(abs);
    if (buf.includes(0)) continue;
    hits.push(...scanText(rel, buf.toString('utf8'), rules));
  }
  return hits;
}

export function runCommand(cmd, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}${error.message}\n` });
    });
  });
}

export function tail(text, lines = 40) {
  return String(text).trim().split('\n').slice(-lines).join('\n');
}
