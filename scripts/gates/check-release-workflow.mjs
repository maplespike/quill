#!/usr/bin/env node
// Release-workflow guard — three rules, each paid for by a real incident.
//
// Rule 1: base-branch lockstep. The changesets release target is recorded in
// two places — `.changeset/config.json` `baseBranch` and the `BASE_BRANCH` env
// of `.github/workflows/release-weekly.yml` — and the weekly lane is silent
// when they disagree, because its PR creation fails for an unrelated reason
// (see Rule 3). This is #1020's fallout: on 2026-10-05 `baseBranch` moved
// prod → main and the prod branch was retired, but release-weekly kept opening
// its PR against `prod`. `GET /repos/maplespike/quill/branches/prod` is 404, so
// the release PR could not be created even by a token permitted to create one.
//
// Rule 2: owner-qualified PR head filters. GitHub IGNORES a `head` filter that
// is not in `owner:branch` form and answers with the repository's open PRs
// unfiltered. release-weekly asked `head: 'changeset-release/prod'`, so while
// any unrelated PR was open it read that PR as "the release PR already exists"
// and exited 0 without pushing anything — three consecutive false greens
// (2026-09-25, 10-02, 10-09). The first Friday with zero open PRs, 2026-10-16,
// fell through to the real path and went red (run 38942770925). Measured
// 2026-10-16: `pulls?head=release/pin-2026-10-04&state=all` returns the default
// 30-entry page (filter dropped) where `head=maplespike:release/pin-2026-10-04`
// returns the single matching PR.
//
// Rule 3: PR creation must acknowledge the platform refusal. This repository
// sets `can_approve_pull_request_reviews: false` deliberately (#1041), so a
// `pulls.create` / `gh pr create` with `GITHUB_TOKEN` is refused with
// "GitHub Actions is not permitted to create or approve pull requests." A
// workflow that creates PRs must therefore either use a credential that is not
// the workflow token or handle that refusal — and say so in the file, so the
// next reader does not re-learn it from a 403 in the run list.
//
// Pure Node, no dependencies (CI ships no YAML library). The rules are exported
// for scripts/test-release-workflow.mts.
//
// Usage:
//   node scripts/gates/check-release-workflow.mjs
// Exit 0 + "release workflow: OK …" when the rules hold; exit 1 + one line per
// violation otherwise.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The refusal this repository returns for `pulls.create` with GITHUB_TOKEN. */
export const REFUSAL_RE = /not permitted to create/i;

/** Any call that creates a pull request. */
export const PR_CREATE_RE = /pulls\.create\b|gh\s+pr\s+create\b/;

/** Workflow files that carry the release lane. */
export const RELEASE_WORKFLOW = 'release-weekly.yml';

/** `baseBranch` from `.changeset/config.json`. */
export function parseConfiguredBaseBranch(configText) {
  const m = configText.match(/"baseBranch"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

/** The `BASE_BRANCH` env value of a workflow, quotes stripped. */
export function parseWorkflowBaseBranch(workflowText) {
  const m = workflowText.match(/^\s*BASE_BRANCH:\s*(\S+)\s*$/m);
  return m ? m[1].replace(/^["']|["']$/g, '') : null;
}

/**
 * Rule 1 — the release workflow's target must equal the changesets baseBranch.
 * @returns {Array<{file: string, line: number, message: string}>}
 */
export function checkBaseBranchLockstep(configText, workflowText, file = RELEASE_WORKFLOW) {
  const configured = parseConfiguredBaseBranch(configText);
  const used = parseWorkflowBaseBranch(workflowText);
  const violations = [];

  if (!configured) {
    violations.push({ file: '.changeset/config.json', line: 1, message: 'no `baseBranch` entry found' });
    return violations;
  }
  if (!used) {
    violations.push({
      file,
      line: 1,
      message: `no \`BASE_BRANCH\` env entry found — it must be \`${configured}\` to match \`.changeset/config.json\` baseBranch (#1020)`,
    });
    return violations;
  }
  if (used !== configured) {
    violations.push({
      file,
      line: 1,
      message: `BASE_BRANCH=${used} but .changeset/config.json baseBranch=${configured} — the release PR would target the wrong branch (#1020 retired prod, 2026-10-05)`,
    });
  }
  return violations;
}

/**
 * Rule 2 — every `head:` PR filter must be owner-qualified (`owner:branch`).
 *
 * Only *literal* filters are inspected. `head: branch,` is a `pulls.create`
 * argument, not a filter, and must not be flagged: a gate that fails on valid
 * input is worse than no gate (check-workflow-yaml.mjs, 2026-09-22). A literal
 * filter is quoted, or carries a `:` / `/` that no bare identifier can.
 * @returns {Array<{file: string, line: number, value: string}>}
 */
export function findUnqualifiedHeadFilters(text, file = '<inline>') {
  const violations = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*head:\s*(?:['"`]([^'"`]*)['"`]|([^\s,]+))\s*,?\s*$/);
    if (!m) continue;
    const value = (m[1] ?? m[2] ?? '').trim();
    if (value === '') continue;
    // Not a literal filter (a bare identifier such as a `pulls.create` arg).
    if (m[1] === undefined && !value.includes(':') && !value.includes('/')) continue;
    // `owner:branch` — for example `${owner}:${branch}` or `maplespike:branch`.
    if (value.includes(':')) continue;
    violations.push({ file, line: i + 1, value });
  }
  return violations;
}

/**
 * Rule 3 — a workflow that creates PRs must not rest that on the workflow
 * token alone, and must say how the platform refusal is handled.
 * @returns {Array<{file: string, line: number, message: string}>}
 */
export function findUnacknowledgedPrCreation(text, file = '<inline>') {
  const match = text.match(PR_CREATE_RE);
  if (!match) return [];

  const lines = text.split(/\r?\n/);
  const line = lines.findIndex((l) => PR_CREATE_RE.test(l)) + 1;

  // A credential that is not the workflow token (a PAT/App secret) covers it…
  const nonWorkflowToken = /github-token:\s*\$\{\{\s*secrets\.(?!GITHUB_TOKEN\b)[A-Za-z0-9_]+/;
  if (nonWorkflowToken.test(text)) return [];

  // …and so does an explicit, written acknowledgement of the refusal.
  if (REFUSAL_RE.test(text)) return [];

  return [
    {
      file,
      line,
      message:
        'creates a pull request with nothing but the workflow token, and never mentions the platform refusal — this repo sets can_approve_pull_request_reviews: false (#1041), so the call 403s with "GitHub Actions is not permitted to create or approve pull requests." (run 38942770925)',
    },
  ];
}

/** Scan a directory of workflow files with rules 2 and 3, plus rule 1 for the release lane. */
export function scanWorkflows(dir, changesetConfigText) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort();

  const violations = [];
  for (const file of files) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    for (const v of findUnqualifiedHeadFilters(text, file)) {
      violations.push({
        file: v.file,
        line: v.line,
        message: `head filter \`${v.value}\` is not owner-qualified — GitHub ignores an unqualified \`head\` filter and returns every open PR, which is how the weekly release lane reported a false green for three weeks (2026-09-25, 10-02, 10-09)`,
      });
    }
    for (const v of findUnacknowledgedPrCreation(text, file)) violations.push(v);
    if (file === RELEASE_WORKFLOW && changesetConfigText !== undefined) {
      for (const v of checkBaseBranchLockstep(changesetConfigText, text, file)) violations.push(v);
    }
  }
  return { violations, files };
}

function main(argv) {
  const repo = argv[0]
    ? path.resolve(argv[0])
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const dir = path.join(repo, '.github/workflows');
  const configPath = path.join(repo, '.changeset/config.json');

  let changesetConfigText;
  try {
    changesetConfigText = readFileSync(configPath, 'utf8');
  } catch {
    console.error(`release workflow: cannot read ${configPath}`);
    return 2;
  }

  const { violations, files } = scanWorkflows(dir, changesetConfigText);

  if (violations.length) {
    for (const v of violations) console.error(`release workflow violation: ${v.file}:${v.line} — ${v.message}`);
    console.error(`release workflow: FAILED (${violations.length} violation(s) across ${files.length} file(s))`);
    return 1;
  }
  const base = parseConfiguredBaseBranch(changesetConfigText);
  console.log(
    `release workflow: OK (base branch \`${base}\` in lockstep, no unqualified head filter, PR creation refusal acknowledged — ${files.length} workflow file(s))`,
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
