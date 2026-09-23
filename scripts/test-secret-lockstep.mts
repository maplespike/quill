#!/usr/bin/env tsx
/**
 * Regression test for the 2026-09-23 lockstep gate outage (run 35901746802).
 *
 * scripts/sops-sync-k8s.sh was rewritten (b5a56dc) to declare its keys in a
 * MAPPING table; check-secret-lockstep.sh still grepped the old inline
 * "key=${VAR}" format. The empty grep, under `set -e` + pipefail, killed the
 * script inside a command substitution: exit 1, ZERO log output, and every
 * dependent job (audit, coverage, docker, integration) skipped with nothing
 * to explain it. The failure mode was silence — so every case below asserts
 * on the script's *words*, not just its exit code.
 *
 * Runs as `tsx --test` via `pnpm run test:lockstep` (part of `pnpm test`).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = path.join(REPO, 'scripts/check-secret-lockstep.sh');

/** Mapping rows the fixture sync script declares. */
const mappingRows = (rows: string[]) => `
MAPPING=(
${rows.map((r) => `  "${r}"`).join('\n')}
)
`.trim();

/** Minimal sops-sync-k8s.sh stand-in: only the MAPPING table matters to the gate. */
const syncScript = (rows: string[]) => `#!/usr/bin/env bash
set -euo pipefail
${mappingRows(rows)}
`;

/** A chart template file with the given secretKeyRef blocks. */
const chartTemplate = (blocks: string[]) => blocks.join('\n');

const refBlock = (opts: {
  secret: string;
  key: string;
  optional?: boolean;
}) => `        - name: ENV_${opts.key.toUpperCase()}
          valueFrom:
            secretKeyRef:
              name: ${opts.secret}
              key: ${opts.key}${opts.optional ? '\n              optional: true' : ''}`;

type Fixture = {
  syncRows?: string[];
  chartFiles?: Record<string, string>;
};

/** Build an isolated tree the gate can be pointed at (it takes a root argument). */
function buildFixture(f: Fixture): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockstep-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'charts/quill/templates'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'scripts/sops-sync-k8s.sh'),
    syncScript(f.syncRows ?? ['JWT_SECRET|quill-secrets|jwtSecret']),
  );
  const files = f.chartFiles ?? {
    'deployments.yaml': chartTemplate([
      refBlock({ secret: 'quill-secrets', key: 'jwtSecret', optional: true }),
    ]),
  };
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, 'charts/quill/templates', name), body);
  }
  return root;
}

type RunResult = { status: number; out: string };

/** Run the REAL gate script against a fixture root; combine stdout+stderr. */
function runGate(root: string): RunResult {
  const r = spawnSync('bash', [GATE, root], { encoding: 'utf8' });
  return { status: r.status ?? -1, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

test('every delivered ref passes -> exit 0 with a summary that names both counts', () => {
  const root = buildFixture({
    syncRows: ['JWT_SECRET|quill-secrets|jwtSecret', 'QUILL_PII_HASH_SECRET|maplespike-secrets|pii-hash-secret'],
    chartFiles: {
      'deployments.yaml': chartTemplate([
        refBlock({ secret: 'quill-secrets', key: 'jwtSecret' }),
        refBlock({ secret: 'maplespike-secrets', key: 'pii-hash-secret', optional: true }),
      ]),
    },
  });
  const r = runGate(root);
  assert.equal(r.status, 0, `gate output:\n${r.out}`);
  assert.match(r.out, /1 required \+ 1 optional ref\(s\) checked against 2 delivered key\(s\)/);
});

test('required ref to an undelivered key fails and NAMES the key', () => {
  const root = buildFixture({
    syncRows: ['JWT_SECRET|quill-secrets|jwtSecret'],
    chartFiles: {
      'deployments.yaml': chartTemplate([
        refBlock({ secret: 'quill-secrets', key: 'ghost-key' }),
      ]),
    },
  });
  const r = runGate(root);
  assert.equal(r.status, 1, 'an undelivered required ref must fail the gate');
  assert.match(r.out, /required ref quill-secrets\/ghost-key is not delivered/);
});

test('optional ref to an undelivered key warns but does not fail', () => {
  const root = buildFixture({
    syncRows: ['JWT_SECRET|quill-secrets|jwtSecret'],
    chartFiles: {
      'deployments.yaml': chartTemplate([
        refBlock({ secret: 'quill-secrets', key: 'jwtSecret', optional: true }),
        refBlock({ secret: 'quill-secrets', key: 'maybe-key', optional: true }),
      ]),
    },
  });
  const r = runGate(root);
  assert.equal(r.status, 0, 'optional refs cannot crash a pod, so they must not fail the gate');
  assert.match(r.out, /optional ref quill-secrets\/maybe-key is not delivered/);
});

// THE incident: the sync's format changed, the gate's extraction found nothing,
// and the gate died with exit 1 and an empty log. It must fail LOUDLY instead.
test('sync MAPPING format change -> exit 1 WITH an explanation, never silence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockstep-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'charts/quill/templates'), { recursive: true });
  // A sync script whose key declarations match no known shape.
  fs.writeFileSync(
    path.join(root, 'scripts/sops-sync-k8s.sh'),
    '#!/usr/bin/env bash\nset -euo pipefail\nemit_key jwt_secret  # some future format\n',
  );
  fs.writeFileSync(
    path.join(root, 'charts/quill/templates/deployments.yaml'),
    chartTemplate([refBlock({ secret: 'quill-secrets', key: 'jwtSecret', optional: true })]),
  );
  const r = runGate(root);
  assert.equal(r.status, 1, 'an unparseable sync script must fail the gate');
  assert.ok(r.out.length > 0, 'the gate must SAY something when it fails — silence was the outage');
  assert.match(r.out, /could not extract any delivered secret key/);
  assert.match(r.out, /If the format changed again, update this gate/);
});

test('chart with no operator-managed secret refs fails loudly (gate must not pass empty)', () => {
  const root = buildFixture({
    syncRows: ['JWT_SECRET|quill-secrets|jwtSecret'],
    chartFiles: {
      'deployments.yaml': chartTemplate([
        // quill-db-secret is chart-owned, not sync-owned: the gate ignores it.
        refBlock({ secret: 'quill-db-secret', key: 'postgres-user', optional: true }),
      ]),
    },
  });
  const r = runGate(root);
  assert.equal(r.status, 1, 'zero scanned refs means the gate is blind — that must fail');
  assert.match(r.out, /extracted no secretKeyRef/);
});

test('delivered key nothing references warns as a dead MAPPING row', () => {
  const root = buildFixture({
    syncRows: [
      'JWT_SECRET|quill-secrets|jwtSecret',
      'GHOST_VAR|quill-secrets|orphan-key',
    ],
    chartFiles: {
      'deployments.yaml': chartTemplate([
        refBlock({ secret: 'quill-secrets', key: 'jwtSecret', optional: true }),
      ]),
    },
  });
  const r = runGate(root);
  assert.equal(r.status, 0, 'a dead row is drift risk, not a broken deploy');
  assert.match(r.out, /delivered key 'orphan-key' is not referenced by the chart — dead MAPPING row\?/);
});

test('the live repo tree passes the gate', () => {
  const r = spawnSync('bash', [GATE, REPO], { encoding: 'utf8' });
  assert.equal(r.status, 0, `gate output:\n${(r.stdout ?? '') + (r.stderr ?? '')}`);
});
