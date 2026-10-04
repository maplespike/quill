#!/usr/bin/env node
/**
 * Codemod: "Quill" -> "Quill".
 *
 * Enforces ADR 0007 (`docs/decisions/0007-repo-rename.md`) rule 2: "The word
 * 'MapleSpike' never appears inline in a Quill resource path."
 *
 * SCOPE — product-level identifiers only. Deliberately NOT touched, because
 * ADR 0007 §Preserved pins them at brand/infra level:
 *   - maplespike.ca, *.maplespike.lan          (brand surfaces)
 *   - @maplespike/*                            (npm scope, org-level)
 *   - namespace: maplespike, postgres user/db   (infra identity)
 *   - MAPLESPIKE_DOMAIN / _ORIGIN / _BILLING_EMAIL / _OAUTH_* / _TREASURY_*
 *   - MapleSpike (c) / AGPL copyright headers   (legal entity)
 *   - maplespike-brand/, maplespike-relay/      (separate products)
 *
 * Run:  node scripts/codemod-maplespike-pipeline.mjs [--dry] [--check]
 * Exits 1 under --check if anything would change (for CI).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DRY = process.argv.includes('--dry');
const CHECK = process.argv.includes('--check');

/** Directories never rewritten: build output, deps, VCS. */
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|\.turbo|build|coverage|\.next|out)(?:\/|$)/;

/**
 * Ordered longest-first. Order matters: `Quill/0.1` (the HTTP
 * User-Agent) must be rewritten before the bare `MapleSpike` word rule can
 * touch it, and the spaced prose form must not be eaten by the CamelCase rule.
 */
const RULES = [
  // --- prose / doc headers: "Quill" --------------------------
  [/\bMapleSpike Pipeline\b/g, 'Quill'],
  [/\bMapleSpike pipeline\b/g, 'Quill'],
  // --- HTTP User-Agent token: 'Quill/0.1 ...' ----------------
  [/\bMapleSpikePipeline\b/g, 'Quill'],
  // --- SDK type names -----------------------------------------------------
  [/\bMapleSpikeResponse\b/g, 'QuillResponse'],
  [/\bMapleSpikeError\b/g, 'QuillError'],
  [/\bMapleSpikeApiError\b/g, 'QuillApiError'],
  [/\bMapleSpikeClient\b/g, 'QuillClient'],
  [/\bMapleSpikeAuth\b/g, 'QuillAuth'],
  [/\bMapleSpikeHandler\b/g, 'QuillHandler'],
  [/\bMapleSpikeStorage\b/g, 'QuillStorage'],
  [/\bMapleSpikeCache\b/g, 'QuillCache'],
  [/\bMapleSpikeTest\b/g, 'QuillTest'],
  // --- misc lowercase camelCase ------------------------------------------
  [/\bmaplespikeApiEntries\b/g, 'quillApiEntries'],
];

const files = execSync(
  'git ls-files -z --cached --others --exclude-standard',
  { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
)
  .toString()
  .split('\0')
  .filter(Boolean)
  .filter((f) => !SKIP_DIR.test(f));

/** Binary-ish extensions we must not corrupt. */
const BINARY_EXT = /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|gz|woff2?|ttf|eot|mp4|mp3|wav|sqlite|db|lock)$/i;

let changedFiles = 0;
let changedRules = 0;
const ruleHits = new Map();

for (const file of files) {
  if (BINARY_EXT.test(file)) continue;

  let original;
  try {
    original = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (original.includes('\0')) continue; // binary content

  let next = original;
  for (const [pattern, replacement] of RULES) {
    pattern.lastIndex = 0;
    if (!pattern.test(next)) continue;
    const hits = (next.match(pattern) ?? []).length;
    next = next.replace(pattern, replacement);
    changedRules += hits;
    ruleHits.set(replacement, (ruleHits.get(replacement) ?? 0) + hits);
  }

  if (next === original) continue;

  changedFiles += 1;
  if (!DRY && !CHECK) writeFileSync(file, next, 'utf8');
}

const label = CHECK ? 'would change' : DRY ? 'would change' : 'changed';
console.log(`${label}: ${changedFiles} files, ${changedRules} replacements`);
for (const [to, n] of [...ruleHits.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  -> ${to}`);
}

if (CHECK && changedFiles > 0) process.exit(1);