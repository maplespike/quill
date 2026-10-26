#!/usr/bin/env tsx
/**
 * Public-flip readiness doc must describe the flips that actually happened.
 *
 * Incident (QUILL-AUDIT.md 2026-10-24, part 2): `docs/PUBLIC-FLIP-READINESS.md`
 * carried `last-reviewed: 2026-09-22` and said the history rewrite was
 * "approved in principle; not yet executed". The rewrite executed on
 * 2026-10-16, and the document kept telling every reader that the blocker was
 * still "two age private keys in history, ancestors of main and reachable from
 * tag v0.3.0" — all three of which had stopped being true.
 *
 * A stale readiness doc is worse than none: it sends the next operator to
 * re-run a rewrite that is already done, and hides the one blocker that is
 * real (the pull-request refs).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOC = path.join(ROOT, 'docs', 'PUBLIC-FLIP-READINESS.md');

const text = fs.readFileSync(DOC, 'utf8');

/** The rewrite landed 2026-10-16; a review older than that predates the fact. */
const REWRITE_DATE = Date.parse('2026-10-16T00:00:00Z');

test('flip-readiness: the document states a review date on or after the rewrite', () => {
  const reviewed = text.match(/^last-reviewed:\s*(\S+)\s*$/m)?.[1];
  assert.ok(reviewed, 'docs/PUBLIC-FLIP-READINESS.md must carry a last-reviewed date');
  const at = Date.parse(reviewed as string);
  assert.ok(Number.isFinite(at), `last-reviewed is not a date: ${reviewed}`);
  assert.ok(
    at >= REWRITE_DATE,
    `last-reviewed is ${reviewed}, older than the 2026-10-16 rewrite — the doc cannot be describing it`,
  );
});

test('flip-readiness: it does not claim the rewrite is still pending', () => {
  assert.doesNotMatch(
    text,
    /not yet executed|not executed yet|rewrite is (?:still )?pending/i,
    'the rewrite executed on 2026-10-16; the doc must not say it is pending',
  );
  assert.doesNotMatch(
    text,
    /One blocker, and it is historical\.\*\* Everything else is ready/i,
    'the 2026-09-22 verdict is stale',
  );
});

test('flip-readiness: the named blocker is the pull-request refs holding d3526781', () => {
  assert.match(text, /refs\/pull\//, 'the blocker must name refs/pull/*');
  assert.match(text, /d3526781/, 'the blocker must name the leaked commit');
  assert.match(text, /#153/, 'the blocker must name at least the first affected PR');
  assert.match(text, /NO-GO/i, 'the verdict must stay explicit');
});

test('flip-readiness: it does not repeat the stale tag claim', () => {
  // The 2026-09-22 text said the leaked commit was "reachable from tag v0.3.0".
  // Verified 2026-10-24: every tag tree is clean.
  assert.doesNotMatch(
    text,
    /reachable from tag/i,
    'tags are clean since the 2026-10-16 rewrite — drop the tag claim',
  );
});

test('flip-readiness: it points at the canonical repository', () => {
  assert.doesNotMatch(
    text,
    /repos\/reverb256\/quill|github\.com\/reverb256\/quill/,
    'the repository is maplespike/quill; reverb256/quill links are the old namespace',
  );
  assert.match(text, /maplespike\/quill/, 'the doc must name the canonical repository');
});
