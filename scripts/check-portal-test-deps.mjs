#!/usr/bin/env node
/**
 * Verify that @maplespike/portal's package.json declares all test dependencies
 * required by its component tests.
 *
 * This prevents the class of failure where PRs add test files that need jsdom,
 * @testing-library/* etc but forget to add them as devDependencies, causing
 * CI to fail with ERR_MODULE_NOT_FOUND when vitest tries to start forks workers.
 *
 * Run from repo root after `pnpm install`:
 *   node scripts/check-portal-test-deps.mjs
 *
 * Exit codes: 0 = all required test deps present, 1 = at least one missing.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

const problems = [];
const expect = (label, actual, wanted) => {
  if (!actual.includes(wanted)) problems.push(`${label}: missing ${wanted}`);
};

// Read portal's package.json
const portalPkg = readJson('packages/portal/package.json');

// These are the exact versions currently required by the two restored test files
// (SignupForm.test.tsx and StripeCheckoutButton.test.tsx) as of PR #1019.
// If the test files change their imports, update this list accordingly.
const requiredTestDeps = [
  { name: '@testing-library/react', version: '^16.3.3' },
  { name: '@testing-library/user-event', version: '^14.6.7' },
  { name: '@testing-library/jest-dom', version: '^7.0.1' },
  { name: 'jsdom', version: '^30.1.2' },
];

// Check each required dependency is present in devDependencies with correct version range
for (const { name, version } of requiredTestDeps) {
  const declared = portalPkg.devDependencies?.[name];
  if (!declared) {
    problems.push(`portal devDependencies: missing ${name}@${version}`);
  } else if (declared !== version) {
    // Allow flexibility: we only require that the declared range satisfies the needed version.
    // For simplicity in this guard, we do exact string match; if you want semver satisfaction
    // checks, replace with a proper semver library call.
    problems.push(`portal devDependencies: ${name} declared as ${declared}, need ${version}`);
  }
}

if (problems.length > 0) {
  console.log(`portal test deps: FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
  console.log(`\nRemedy: add the missing devDependencies to packages/portal/package.json`);
  process.exit(1);
}

console.log(`portal test deps: PASS (all ${requiredTestDeps.length} required test dependencies declared)`);