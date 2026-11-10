#!/usr/bin/env node
/**
 * Build a public export of the API and MCP tree.
 *
 * The process writes a temp directory, scans it, and can install, build,
 * and test there. It stops after the report. It has no remote write step.
 *
 *   node scripts/oss-export.mjs
 *   node scripts/oss-export.mjs --scan-only
 */

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  compileAllows,
  formatHitReport,
  gitleaksArgs,
  materializeExport,
  parseSimpleYaml,
  partitionHits,
  phaseNames,
  runCommand,
  scanExportTree,
  tail,
} from './oss-export-lib.mjs';

const PHASE_COMMANDS = {
  install: ['pnpm', 'install'],
  build: ['pnpm', 'run', 'build'],
  test: ['pnpm', 'run', 'test'],
};

export async function exportPublicTree(argv = process.argv.slice(2)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const manifestText = await readFile(path.join(repoRoot, 'oss', 'export.yml'), 'utf8');
  const manifest = parseSimpleYaml(manifestText);
  const phases = phaseNames(argv);
  const dest = await mkdtemp(path.join(tmpdir(), 'quill-oss-export-'));
  const failures = [];

  console.log(`Export directory: ${dest}`);
  console.log(`Phases: ${phases.join(', ')}`);

  if (phases.includes('materialize')) {
    await materializeExport(repoRoot, dest, manifest);
    console.log('Materialize: wrote the public tree.');
  }

  if (phases.includes('scan')) {
    const hits = await scanExportTree(dest, manifest);
    const { blocking, allowlisted } = partitionHits(hits, compileAllows(manifest));
    process.stdout.write(formatHitReport(blocking, allowlisted));
    if (blocking.length > 0) failures.push(`forbidden-string scan (${blocking.length} blocking)`);

    const bin = process.env.GITLEAKS_BIN || 'gitleaks';
    const args = gitleaksArgs(dest, bin);
    const leaked = await runCommand(args[0], args.slice(1), dest);
    if (leaked.code !== 0) {
      failures.push('gitleaks');
      const detail = tail(`${leaked.stdout}\n${leaked.stderr}`);
      console.log(detail || `gitleaks failed (exit ${leaked.code}). Install gitleaks or set GITLEAKS_BIN.`);
    } else {
      console.log('gitleaks: no findings.');
    }
  }

  let blocked = false;
  for (const phase of ['install', 'build', 'test']) {
    if (!phases.includes(phase)) continue;
    if (blocked) {
      failures.push(`${phase} skipped`);
      continue;
    }
    const [cmd, ...args] = PHASE_COMMANDS[phase];
    console.log(`Run: ${cmd} ${args.join(' ')}`);
    const result = await runCommand(cmd, args, dest);
    if (result.code !== 0) {
      failures.push(phase);
      blocked = true;
      console.log(tail(`${result.stdout}\n${result.stderr}`));
    } else {
      console.log(`${phase}: ok.`);
    }
  }

  if (failures.length > 0) {
    console.log(`Export failed closed: ${failures.join('; ')}.`);
    console.log('No remote write was attempted.');
    return { ok: false, dest, failures };
  }

  console.log('Export checks passed. No remote write was attempted.');
  return { ok: true, dest, failures };
}

const isDirect = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirect) {
  exportPublicTree().then((result) => {
    process.exit(result.ok ? 0 : 1);
  }).catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
}
