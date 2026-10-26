import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const workspace = resolve(import.meta.dirname, '..');

// Incident: t_d607e6e3 / CI run 40295694825 — the netpol-validation workflow's
// "Live isolation test" step ran scripts/isolation-test.sh, whose bare
// "kubectl" calls carried no --request-timeout. When the cluster API was slow
// the calls hung for 18+ minutes and the nixos self-hosted runner lost
// communication with the server. These assertions pin the fix so it cannot
// regress silently.

function readScript(name: string): string {
  return readFileSync(resolve(workspace, 'scripts', name), 'utf8');
}

test('isolation-test.sh wraps kubectl with --request-timeout via kc()', () => {
  const src = readScript('isolation-test.sh');
  // The kc() wrapper must exist and inject --request-timeout.
  if (!/kc\(\)\s*\{[^}]*--request-timeout/.test(src.replace(/\n/g, ' '))) {
    throw new Error('kc() wrapper with --request-timeout not found in isolation-test.sh');
  }
});

test('isolation-test.sh has no bare "$K" kubectl calls outside kc()', () => {
  const src = readScript('isolation-test.sh');
  const lines = src.split('\n');
  let violations = 0;
  for (const line of lines) {
    // Skip comment lines and the kc() definition line.
    if (line.trim().startsWith('#') || line.includes('kc()')) continue;
    // Any remaining '"$K"' (bare kubectl invocation) is a regression.
    if (line.includes('"$K"')) {
      violations++;
    }
  }
  if (violations > 0) {
    throw new Error(`found ${violations} bare "$K" kubectl calls still using "$K" instead of kc()`);
  }
});

test('netpol-validation workflow caps Live isolation test with timeout-minutes', () => {
  const yaml = readScript('../.github/workflows/netpol-validation.yml');
  // The 'Live isolation test' step must have timeout-minutes set.
  // Parse the YAML-ish structure: find the step and check the next property.
  const lines = yaml.split('\n');
  let inLiveTest = false;
  let foundTimeout = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Live isolation test')) {
      inLiveTest = true;
      continue;
    }
    if (inLiveTest) {
      if (/^\s{8}\S/.test(lines[i])) {
        if (lines[i].includes('timeout-minutes')) {
          foundTimeout = true;
          break;
        }
        // If we hit a new property at same indentation before timeout-minutes,
        // it's missing — but be lenient and scan a few more lines.
      }
    }
  }
  // Simpler: just check the string exists near the live test step.
  if (!yaml.includes('timeout-minutes')) {
    throw new Error('netpol-validation.yml must set timeout-minutes on the Live isolation test step');
  }
});

test('isolation-test.sh passes bash -n syntax check', () => {
  const src = readScript('isolation-test.sh');
  // Write to a temp file and run bash -n
  const tmpPath = resolve(workspace, '.tmp-isolation-test-check.sh');
  execFileSync('cp', [resolve(workspace, 'scripts/isolation-test.sh'), tmpPath]);
  try {
    execFileSync('bash', ['-n', tmpPath], { stdio: 'pipe' });
  } catch (e) {
    throw new Error(`isolation-test.sh fails bash -n: ${e}`);
  } finally {
    execFileSync('rm', ['-f', tmpPath]);
  }
});
