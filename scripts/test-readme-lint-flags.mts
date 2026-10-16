#!/usr/bin/env tsx
/**
 * Incident-rule lane for the "a pinned action's upstream removed a CLI flag
 * the workflow still passes" class — CI run 38932597379 (PR #966, README Lint).
 *
 * PR #966 bumped `lycheeverse/lychee-action` v2.0.2 -> v2.9.0. The action does
 * not ship lychee; it downloads a pinned binary, and that pin moves with the
 * tag (action.yml `lycheeVersion`: v2.0.2 -> v0.16.1, v2.9.0 -> v0.24.2; read
 * from https://raw.githubusercontent.com/lycheeverse/lychee-action/<tag>/action.yml
 * on 2026-10-16). Upstream lychee removed the deprecated `--exclude-mail` flag
 * in v0.19.0 ("Most notably with this release the deprecated `--exclude-mail`
 * flag was removed" — lychee-v0.19.0 release notes, 2025-06-11; issue
 * lycheeverse/lychee#1669, PR #1691), while the workflow's args line still
 * passed it. The step then died before checking one link:
 *
 *   error: unexpected argument '--exclude-mail' found
 *     tip: a similar argument exists: '--include-mail'
 *   ##[error]Process completed with exit code 2.
 *
 * Measured both ways on 2026-10-16 with the real release binaries:
 *   lychee v0.16.1 (main's pin)   `--exclude-mail` -> rc 0 + deprecation WARN
 *   lychee v0.24.2 (PR #966 pin)  `--exclude-mail` -> rc 2, the error above
 * (main's README Lint, run 38918867217, is green and logs the WARN; the PR's
 * run 38932597379 is red with the rc 2.)
 *
 * The failure mode is a red check that reads as a broken-link gate while the
 * gate never ran — and a bump that removes a flag could also silence the step
 * and read as green while checking nothing. This lane models the pin instead
 * of banning flags outright:
 *
 *   1. It resolves the lychee binary the pinned action tag governs (honouring
 *      an explicit `lycheeVersion:` input on the step, which overrides it) and
 *      fails if the step's args carry a flag that binary removed.
 *   2. An unknown action tag fails LOUD, with the instruction to read that
 *      tag's action.yml — so the pin cannot move without this table being
 *      re-verified against upstream.
 *   3. It pins the step's honesty: `fail: true`, no `continue-on-error`, no
 *      `if:` that could skip it, and args that still name the scanned files —
 *      so the gate cannot be turned into a no-op.
 *
 * Runs as `tsx --test` via `pnpm run test:readme-lint-flags` (part of
 * `pnpm test`) and as a CI step in .github/workflows/ci.yml.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(REPO, '.github/workflows/readme-lint.yml');

/**
 * The lychee binary version each `lycheeverse/lychee-action` tag downloads by
 * default, per that tag's action.yml (`lycheeVersion` input). Measured
 * 2026-10-16. The value only moves when the tag does — which is exactly what
 * this table exists to make visible on the next Dependabot bump.
 */
const ACTION_LYCHEE_VERSION: Record<string, string> = {
  'v2.0.2': 'v0.16.1', // README Lint's pin before PR #966 — flag accepted (WARN)
  'v2.9.0': 'v0.24.2', // PR #966's pin — flag rejected (exit 2, run 38932597379)
};

/**
 * CLI flags upstream lychee removed, and the first release that rejects them.
 * Add an entry only with the release note that states the removal.
 */
const REMOVED_FLAGS = [
  {
    flag: '--exclude-mail',
    removedIn: 'v0.19.0',
    why: 'lycheeverse/lychee#1669 / PR #1691 — deprecated in 2023, mail checking has been off by default since',
  },
];

/** The exact `INPUT_ARGS` value lychee received in run 38932597379, from its log. */
const INCIDENT_ARGS =
  "--verbose --no-progress --accept 200,206,401 --exclude 'gitlawb://' --exclude 'did:key:' " +
  "--exclude '^https://github.com/maplespike/quill/(blob|tree)/' " +
  "--exclude 'https://github.com/reverb256/Frostbite-Gazette' --exclude '^https?://localhost' " +
  "--exclude 'https?://[a-zA-Z0-9.-]+\\.lan(/|$)' --exclude 'https://nixos.wiki' --exclude-mail " +
  './README.md ./docs ./packages/*/README.md ./llms.txt ./llms-full.txt';

const INCIDENT_RUN = '38932597379';

type Ok = { ok: true; ref: string; lychee: string; args: string; rejected: string[] };
type Bad = { ok: false; ref: string | null; reason: string };
type Verdict = Ok | Bad;

// ── pure helpers ──────────────────────────────────────────────────────────

/** The lychee step of the workflow, isolated. Steps are 6-space list items. */
function lycheeStep(workflow: string): string | null {
  return (
    workflow
      .split(/\n(?= {6}- )/)
      .find((step) => step.includes('lycheeverse/lychee-action@')) ?? null
  );
}

function actionRef(step: string): string | null {
  return step.match(/lycheeverse\/lychee-action@([^\s#]+)/)?.[1] ?? null;
}

function stepArgs(step: string): string | null {
  return step.match(/^\s*args:\s*(.+)$/m)?.[1]?.trim() ?? null;
}

/** A `lycheeVersion:` input on the step overrides the action tag's default. */
function stepLycheeOverride(step: string): string | null {
  return step.match(/^\s*lycheeVersion:\s*(\S+)\s*$/m)?.[1] ?? null;
}

function semver(value: string): [number, number, number] | null {
  const m = value.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function gte(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
}

/** The `--flags` in an args string. */
export function flagTokens(args: string): string[] {
  // Exact, not heuristic: every quoted value in these args is a regex with no
  // whitespace in it (checked against the live args on 2026-10-16), so a plain
  // split cannot tear a `--flag 'value'` pair apart.
  return args.split(/\s+/).filter((token) => token.startsWith('--'));
}

/** Flags in `args` that the given lychee binary rejects — removed at or before it. */
export function rejectedFlags(args: string, lychee: string): string[] {
  const present = flagTokens(args);
  const have = semver(lychee);
  return REMOVED_FLAGS.filter((removed) => {
    if (!present.includes(removed.flag)) return false;
    const gone = semver(removed.removedIn);
    // An unparsable version fails closed: assume the newest behaviour.
    if (!have || !gone) return true;
    return gte(have, gone);
  }).map((removed) => removed.flag);
}

/** Vet a readme-lint.yml text: the pinned binary and the args must agree. */
export function vetReadmeLint(workflow: string): Verdict {
  const step = lycheeStep(workflow);
  if (!step) {
    return { ok: false, ref: null, reason: 'workflow has no lycheeverse/lychee-action step' };
  }
  const ref = actionRef(step);
  if (!ref) return { ok: false, ref: null, reason: 'the lychee step pins no action tag' };

  const lychee = stepLycheeOverride(step) ?? ACTION_LYCHEE_VERSION[ref];
  if (!lychee) {
    return {
      ok: false,
      ref,
      reason:
        `unknown lychee-action pin ${ref}: read ` +
        `https://raw.githubusercontent.com/lycheeverse/lychee-action/${ref}/action.yml, ` +
        'add its `lycheeVersion` to ACTION_LYCHEE_VERSION, and re-check REMOVED_FLAGS ' +
        'against the releases between the old and the new binary',
    };
  }

  const args = stepArgs(step);
  if (!args) {
    return {
      ok: false,
      ref,
      reason:
        "the lychee step passes no explicit args — the gate's scope changed, re-verify what it scans",
    };
  }

  const rejected = rejectedFlags(args, lychee);
  if (rejected.length > 0) {
    const why = REMOVED_FLAGS.filter((r) => rejected.includes(r.flag))
      .map((r) => `${r.flag} (removed in ${r.removedIn}: ${r.why})`)
      .join('; ');
    return {
      ok: false,
      ref,
      reason:
        `lychee-action@${ref} downloads lychee ${lychee}, which rejects ${why} — ` +
        `the step would exit 2 before checking a link, exactly as in run ${INCIDENT_RUN}`,
    };
  }

  return { ok: true, ref, lychee, args, rejected };
}

function expectOk(v: Verdict, label: string): Ok {
  if (!v.ok) throw new Error(`${label}: ${v.reason}`);
  return v;
}

function expectRejected(v: Verdict, label: string): Bad {
  if (v.ok) {
    throw new Error(
      `${label}: the guard passed, but it must reject — checked ${v.ref} with lychee ${v.lychee}`,
    );
  }
  return v;
}

/** Rewrite the args scalar of the lychee step, for fixtures. */
function withArgs(workflow: string, mutate: (args: string) => string): string {
  assert.match(workflow, /^\s*args:\s*\S/m, 'fixture: the lychee step must pass args');
  const next = workflow.replace(
    /^(\s*args:\s*)(.+)$/m,
    (_match, prefix: string, args: string) => prefix + mutate(args),
  );
  // Deliberately no "must differ" assert: a mutate that lands on the value
  // already present is a no-op, not a broken fixture. Each fixture states the
  // effect it needs asserted.
  return next;
}

/**
 * Point the workflow at `ref`. A SET, not a change: this lane runs against
 * trees where the pin is already the target (PR #966's rebase is main + the
 * bump), and a change-or-fail helper there would red the lane on a correct
 * tree — the false-red class this repo already paid for once (#1091).
 */
function withPin(workflow: string, ref: string): string {
  assert.match(workflow, /lycheeverse\/lychee-action@[^\s#]+/, 'fixture: the action must be pinned');
  return workflow.replace(
    /lycheeverse\/lychee-action@[^\s#]+/,
    `lycheeverse/lychee-action@${ref}`,
  );
}

// ── the live workflow ─────────────────────────────────────────────────────

const wf = fs.readFileSync(WORKFLOW, 'utf8');
const verdict = vetReadmeLint(wf);

test('readme-lint.yml pins a lychee-action tag this lane knows', () => {
  // The whole lane is only as good as the table above. An unmodelled tag is a
  // RED lane by design: re-read that tag's action.yml before moving the pin.
  expectOk(verdict, 'readme-lint.yml');
});

test('the pinned lychee binary accepts every flag the step passes', () => {
  const v = expectOk(verdict, 'readme-lint.yml');
  assert.deepEqual(
    v.rejected,
    [],
    `run ${INCIDENT_RUN} is the precedent: a flag the pinned lychee removed kills the step before link 1`,
  );
  // The pin and the binary both drift with Dependabot, so report what was checked.
  assert.match(v.ref, /^v\d+\.\d+\.\d+$/);
  assert.match(v.lychee, /^v\d+\.\d+\.\d+$/);
});

test('the guard reads real flags out of real args (not vacuous)', () => {
  const v = expectOk(verdict, 'readme-lint.yml');
  const flags = flagTokens(v.args);
  assert.ok(flags.length >= 8, `expected the live args to carry flags, got ${flags.length}`);
  for (const flag of ['--verbose', '--no-progress', '--accept', '--exclude']) {
    assert.ok(flags.includes(flag), `live args must still carry ${flag}`);
  }
  assert.equal(flags.includes('--exclude-mail'), false);
});

// ── the incident, as measured ─────────────────────────────────────────────

test('the incident args are the live args plus `--exclude-mail` (fixture fidelity)', () => {
  // Proves the fixture below is the real pre-fix string from run 38932597379,
  // and that this change differs from it by exactly the one removed flag.
  const v = expectOk(verdict, 'readme-lint.yml');
  const live = v.args.split(/\s+/);
  const incident = INCIDENT_ARGS.split(/\s+/);
  assert.deepEqual(
    incident.filter((t) => t !== '--exclude-mail'),
    live,
  );
  assert.equal(incident.length, live.length + 1);
});

test('the guard is pin-aware: the same args pass the old binary, fail the new one', () => {
  // lychee v0.16.1 (main's pin) only warned; v0.24.2 (PR #966's pin) rejects.
  // A blanket "--exclude-mail is banned" assertion would not model that.
  assert.deepEqual(rejectedFlags(INCIDENT_ARGS, 'v0.16.1'), []);
  assert.deepEqual(rejectedFlags(INCIDENT_ARGS, 'v0.24.2'), ['--exclude-mail']);
});

test('the bump alone, with the fixed args, stays green', () => {
  // This is PR #966's workflow once this change has landed on main.
  const v = expectOk(vetReadmeLint(withPin(wf, 'v2.9.0')), 'bumped pin');
  assert.equal(v.lychee, 'v0.24.2');
});

test('the fixtures are idempotent: a tree already on the bumped pin stays green', () => {
  // The rebase IS main + the bump, so this lane runs on trees where the pin is
  // already v2.9.0. A change-or-fail fixture would red a correct tree there —
  // the false-red class of #1091. Guards this lane against re-introducing it.
  const bumped = withPin(wf, 'v2.9.0');
  const again = withPin(bumped, 'v2.9.0');
  assert.equal(again, bumped, 'withPin must SET the pin, not require a change');
  const v = expectOk(vetReadmeLint(again), 'already-bumped tree');
  assert.equal(v.ref, 'v2.9.0');
  assert.equal(v.lychee, 'v0.24.2');
});

test('withArgs tolerates a mutation that changes nothing (no change-or-fail)', () => {
  // The helper must not require the mutation to differ from its input: a
  // fixture whose mutation is already satisfied is a no-op, not a broken
  // fixture. Combined with the pin test above, no fixture can red a correct
  // tree just because that tree already looks like the fixture's target.
  assert.equal(withArgs(wf, (args) => args), wf);
  const v = expectOk(
    vetReadmeLint(withPin(withArgs(wf, (args) => args), 'v2.9.0')),
    'no-op mutation + bumped pin',
  );
  assert.equal(v.ref, 'v2.9.0');
});

test('re-adding `--exclude-mail` on the bumped pin fails the guard (the incident shape)', () => {
  const fixture = withPin(
    withArgs(wf, (args) => args.replace(' ./README.md', ' --exclude-mail ./README.md')),
    'v2.9.0',
  );
  assert.equal(fixture.includes('--exclude-mail'), true, 'fixture must carry the removed flag');
  const v = expectRejected(vetReadmeLint(fixture), 'incident fixture');
  assert.match(v.reason, /--exclude-mail/);
  assert.match(v.reason, new RegExp(INCIDENT_RUN));
  assert.match(v.reason, /v0\.19\.0/);
});

test('an unmodelled pin fails loud instead of passing by default', () => {
  const v = expectRejected(vetReadmeLint(withPin(wf, 'v2.10.0')), 'unmodelled pin');
  assert.match(v.reason, /unknown lychee-action pin v2\.10\.0/);
  assert.match(v.reason, /action\.yml/);
});

test('a step-level `lycheeVersion:` overrides the tag default', () => {
  // Pinning the action tag is not pinning the binary: honour both.
  const fixture = withArgs(wf, (args) =>
    args.replace(' ./README.md', ' --exclude-mail ./README.md'),
  ).replace(/^(\s*args:)/m, '          lycheeVersion: v0.24.2\n$1');
  assert.match(fixture, /lycheeVersion: v0\.24\.2/);
  const v = expectRejected(vetReadmeLint(fixture), 'lycheeVersion override');
  assert.match(v.reason, /lychee v0\.24\.2/);
  assert.match(v.reason, /--exclude-mail/);
});

// ── the step still checks links ───────────────────────────────────────────

test('the lychee step can fail the job: fail: true, no continue-on-error', () => {
  const step = lycheeStep(wf);
  assert.ok(step, 'readme-lint.yml must keep the lychee step');
  assert.match(step, /^\s*fail: true\s*$/m, 'fail: false would hide every broken link');
  assert.doesNotMatch(step, /continue-on-error/, 'a tolerated lychee failure is a silent gate');
});

test('the lychee step is not skipped or gated', () => {
  const step = lycheeStep(wf);
  assert.ok(step);
  assert.doesNotMatch(step, /^\s*if:/m, 'an `if:` on the link gate can skip it silently');
  assert.doesNotMatch(step, /^\s*failIfEmpty:\s*false\s*$/m);
});

test('the args still name the documents the gate owns', () => {
  const v = expectOk(verdict, 'readme-lint.yml');
  const targets = v.args
    .split(/\s+/)
    .filter((t) => !t.startsWith('--') && !t.startsWith("'") && !t.endsWith("'"));
  for (const target of ['./README.md', './docs', './llms.txt', './llms-full.txt']) {
    assert.ok(targets.includes(target), `args must still scan ${target}`);
  }
});
