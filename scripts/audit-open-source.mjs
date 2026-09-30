#!/usr/bin/env node
/**
 * Quill source-level open-source audit.
 *
 * Uses pnpm's installed-package license catalog after the CI frozen install,
 * and checks first-party package manifests, license texts, and file SPDX tags.
 * This is a facts collector, not a license compatibility or legal opinion.
 */
import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packagesRoot = path.join(root, 'packages');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const productionOnly = args.includes('--prod');
const formatIndex = args.indexOf('--format');
const outputIndex = args.indexOf('--output');
const format = formatIndex >= 0 ? args[formatIndex + 1] : 'text';
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
if (!['text', 'json'].includes(format)) {
  console.error('Usage: node scripts/audit-open-source.mjs [--prod] [--strict] [--format text|json] [--output PATH]');
  process.exit(2);
}

const skipDirectories = new Set(['.git', 'node_modules', 'dist', '.turbo', '.astro', 'coverage', 'target']);
const sourceExtensions = new Set(['.cjs', '.cts', '.go', '.h', '.hpp', '.js', '.jsx', '.mjs', '.mts', '.php', '.py', '.rs', '.sh', '.sql', '.ts', '.tsx', '.vue']);

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      if (!skipDirectories.has(entry.name)) files.push(...await walk(path.join(directory, entry.name)));
    } else if (entry.isFile()) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function getLicenseTextKind(text) {
  const head = text.slice(0, 2400).toLowerCase();
  if (head.includes('apache license') && head.includes('version 2.0')) return 'Apache-2.0';
  if (head.includes('gnu affero general public license') && head.includes('version 3')) return 'AGPL-3.0';
  if (head.includes('gnu general public license') && head.includes('version 3')) return 'GPL-3.0';
  if (head.includes('mit license')) return 'MIT';
  if (head.includes('mozilla public license') && head.includes('version 2.0')) return 'MPL-2.0';
  if (head.includes('bsd 3-clause') || head.includes('redistribution and use in source and binary forms')) return 'BSD-like';
  return 'unclassified';
}

function normalizeSpdx(value) {
  if (!value) return null;
  return value.trim().replace(/^\(|\)$/g, '');
}

async function inspectPackages() {
  const packageDirs = (await readdir(packagesRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && !skipDirectories.has(entry.name))
    .map(entry => path.join(packagesRoot, entry.name))
    .sort();
  const packages = [];
  const findings = [];
  const allSourceFiles = [];

  for (const directory of packageDirs) {
    const manifestPath = path.join(directory, 'package.json');
    let manifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        findings.push({ severity: 'review', kind: 'missing-package-manifest', path: relative(directory), detail: 'Workspace directory has no package.json; confirm whether this directory is intended to be an independently licensed package.' });
        continue;
      }
      throw error;
    }

    const declaredLicense = normalizeSpdx(manifest.license);
    const licensePath = path.join(directory, 'LICENSE');
    let licenseFile = null;
    try {
      const text = await readFile(licensePath, 'utf8');
      licenseFile = { path: relative(licensePath), detectedText: getLicenseTextKind(text) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    const item = {
      name: manifest.name ?? path.basename(directory),
      version: manifest.version ?? null,
      private: manifest.private === true,
      directory: relative(directory),
      manifestLicense: declaredLicense,
      licenseFile,
      dependencies: manifest.dependencies ?? {},
      optionalDependencies: manifest.optionalDependencies ?? {},
      devDependencies: manifest.devDependencies ?? {},
      peerDependencies: manifest.peerDependencies ?? {},
    };
    packages.push(item);

    if (!declaredLicense) {
      findings.push({ severity: 'high', kind: 'missing-manifest-license', path: relative(manifestPath), package: item.name, detail: 'No package-level license expression is declared.' });
    }
    if (!licenseFile) {
      findings.push({ severity: 'review', kind: 'missing-package-license-file', path: relative(directory), package: item.name, detail: 'No package-local LICENSE file was found; this may be intentional for private/internal packages but must be documented.' });
    } else if (declaredLicense && licenseFile.detectedText !== 'unclassified' && !declaredLicense.includes(licenseFile.detectedText)) {
      findings.push({ severity: 'high', kind: 'manifest-license-file-conflict', path: licenseFile.path, package: item.name, manifestLicense: declaredLicense, detectedText: licenseFile.detectedText, detail: 'The package manifest and adjacent license text indicate different license identifiers.' });
    }

    const files = await walk(directory);
    allSourceFiles.push(...files.filter(file => sourceExtensions.has(path.extname(file))));
  }

  for (const file of allSourceFiles.sort()) {
    const text = await readFile(file, 'utf8');
    const header = text.split(/\r?\n/).slice(0, 15).join('\n');
    const matches = [...header.matchAll(/SPDX-License-Identifier:\s*([^\s*]+)/g)];
    if (matches.length === 0) continue;
    const packageDirectory = path.relative(packagesRoot, file).split(path.sep)[0];
    const packageInfo = packages.find(item => item.directory === relative(path.join(packagesRoot, packageDirectory)));
    for (const match of matches) {
      const spdx = normalizeSpdx(match[1]);
      if (packageInfo && packageInfo.manifestLicense && spdx !== packageInfo.manifestLicense) {
        findings.push({ severity: 'review', kind: 'file-spdx-differs-from-manifest', path: relative(file), package: packageInfo.name, spdx, manifestLicense: packageInfo.manifestLicense, detail: 'File-level and package-level declarations differ. This can be deliberate, but requires explicit scope and distribution review.' });
      }
    }
  }

  const workspaceByName = new Map(packages.map(item => [item.name, item]));
  for (const item of packages) {
    for (const [dependency, range] of Object.entries(item.dependencies)) {
      if (workspaceByName.has(dependency)) {
        const target = workspaceByName.get(dependency);
        if (!target.manifestLicense) {
          findings.push({ severity: 'high', kind: 'runtime-workspace-dependency-unlicensed', path: `${item.directory}/package.json`, package: item.name, dependency, detail: `Runtime workspace dependency ${dependency} has no package-level license declaration.` });
        }
      }
    }
  }
  return { packages, findings };
}

function readPnpmLicenses() {
  let output;
  try {
    output = execFileSync('pnpm', ['licenses', 'list', ...(productionOnly ? ['--prod'] : []), '--json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const stderr = error.stderr?.toString() ?? error.message;
    throw new Error(`pnpm licenses list --json failed. Run pnpm install --frozen-lockfile first.\n${stderr}`);
  }
  const groups = JSON.parse(output);
  const records = [];
  for (const [groupLicense, entries] of Object.entries(groups)) {
    for (const entry of entries) {
      records.push({
        name: entry.name,
        versions: [...(entry.versions ?? [])].sort(),
        license: entry.license ?? groupLicense,
        author: entry.author ?? null,
        homepage: entry.homepage ?? null,
        description: entry.description ?? null,
      });
    }
  }
  records.sort((a, b) => a.name.localeCompare(b.name) || a.versions.join(',').localeCompare(b.versions.join(',')) || a.license.localeCompare(b.license));
  return records;
}

const packageAudit = await inspectPackages();
const dependencies = readPnpmLicenses();
const rootManifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const workspaceNames = new Set(packageAudit.packages.map(item => item.name));
const dependencyLicenseGroups = {};
for (const dependency of dependencies) {
  const label = dependency.license || 'Unknown';
  dependencyLicenseGroups[label] = (dependencyLicenseGroups[label] ?? 0) + 1;
}
const unknownThirdParty = dependencies.filter(dependency =>
  !workspaceNames.has(dependency.name) && /^(?:unknown|noassertion|unlicensed)$/i.test(dependency.license ?? 'Unknown'));
if (unknownThirdParty.length > 0) {
  packageAudit.findings.push({ severity: 'high', kind: 'third-party-license-unknown', package: unknownThirdParty.map(item => `${item.name}@${item.versions.join('|')}`).join(', '), detail: 'pnpm could not identify a declared license expression for these installed third-party package records. Check upstream package metadata and source license before distribution.' });
}

const report = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  scope: {
    source: 'Current checkout after pnpm install --frozen-lockfile',
    packageManager: rootManifest.packageManager ?? 'unknown',
    dependencyInventoryCommand: `pnpm licenses list${productionOnly ? ' --prod' : ''} --json`,
    dependencyInventoryScope: productionOnly ? 'production dependencies across installed workspace' : 'all installed workspace dependencies, including development dependencies',
    dependencyInventoryLimitation: 'The pnpm license command reports installed package metadata and does not prove the exact contents of each OCI image or a legal compatibility result. Use per-image Syft SBOMs and review included license texts before distribution.',
    generatedFilesExcluded: true,
    disclaimer: 'This report records machine-readable repository and installed-metadata observations. It is not legal advice and does not decide copyright ownership, license compatibility, derivative-work status, source-data rights, or compliance.'
  },
  summary: {
    workspacePackages: packageAudit.packages.length,
    packagesMissingManifestLicense: packageAudit.packages.filter(item => !item.manifestLicense).length,
    installedDependencyRecords: dependencies.length,
    dependencyLicenseGroups,
    findings: packageAudit.findings.length,
    findingsBySeverity: Object.fromEntries(['high', 'review', 'info'].map(severity => [severity, packageAudit.findings.filter(item => item.severity === severity).length]))
  },
  findings: packageAudit.findings.sort((a, b) => a.severity.localeCompare(b.severity) || a.path?.localeCompare(b.path) || a.kind.localeCompare(b.kind)),
  workspacePackages: packageAudit.packages.map(({ dependencies: runtime, optionalDependencies, devDependencies, peerDependencies, ...item }) => ({
    ...item,
    workspaceDependencies: Object.entries(runtime).filter(([name]) => packageAudit.packages.some(pkg => pkg.name === name)).map(([name, range]) => ({ name, range, scope: 'runtime' })),
    developmentWorkspaceDependencies: Object.entries(devDependencies).filter(([name]) => packageAudit.packages.some(pkg => pkg.name === name)).map(([name, range]) => ({ name, range, scope: 'development' }))
  })),
  installedDependencies: dependencies
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) await writeFile(path.resolve(root, outputPath), serialized, 'utf8');
if (format === 'json') process.stdout.write(serialized);
else {
  process.stdout.write(`Quill open-source facts audit\n`);
  process.stdout.write(`Workspace packages: ${report.summary.workspacePackages}\n`);
  process.stdout.write(`Installed dependency records: ${report.summary.installedDependencyRecords}\n`);
  process.stdout.write(`Findings: ${report.summary.findings} (${report.summary.findingsBySeverity.high} high, ${report.summary.findingsBySeverity.review} review)\n`);
  process.stdout.write(`Dependency license groups: ${Object.entries(dependencyLicenseGroups).sort(([a], [b]) => a.localeCompare(b)).map(([license, count]) => `${license}: ${count}`).join('; ')}\n`);
  for (const finding of report.findings) {
    process.stdout.write(`[${finding.severity.toUpperCase()}] ${finding.kind}${finding.path ? ` — ${finding.path}` : ''}${finding.package ? ` (${finding.package})` : ''}: ${finding.detail}\n`);
  }
  if (outputPath) process.stdout.write(`JSON report written to ${outputPath}\n`);
}

if (strict && report.findings.some(item => item.severity === 'high')) process.exitCode = 1;
