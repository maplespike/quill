# Proposal: Stop "Deploy Docs to GitHub Pages" dying red on every main push (issue #1086)

## Problem

Run 38768479350 (main, 2026-10-15) failed at **Setup GitHub Pages** with
`Get Pages site failed ... Not Found`. Not a one-off: every recorded run of
"Deploy Docs to GitHub Pages" since June 2026 has failed (38 failures,
0 successes), because the repository has no Pages site
(`GET /repos/maplespike/quill/pages` → 404, `has_pages: false`) and
`actions/configure-pages` cannot run without one.

## Root cause

Platform limit, not a code failure. Pages cannot be enabled on this
repository today:

- `POST /repos/maplespike/quill/pages` (build_type=workflow, org-owner
  token) is refused with **422 "Your current plan does not support GitHub
  Pages for this repository."**
- The repository is private; the maplespike org is on the free plan.
  GitHub Pages in private repositories requires Team or Enterprise.

The workflow cannot fix that, so dying red on every docs/portal push
signalled a code failure the repo cannot fix and buried the one signal the
run could still give: the portal + docs build on a clean hosted runner was
green in every one of those red runs.

## Proposed fix

Gate the three deploy steps (`configure-pages`, `upload-pages-artifact`,
`deploy-pages`) on a new probe step running `scripts/gates/pages-probe.sh`:

- verdict=enabled (`GET /pages` succeeds) → the deploy steps run, unchanged.
- verdict=not-enabled (404) → skip ONLY the deploy, emit a loud
  `::warning::`, finish green. The build above it still runs and is verified.
- verdict=error or no verdict (auth, rate limit, 5xx, missing tooling) →
  fail loud. Never guess. A crashed probe must never read as "not-enabled",
  which would silently skip deploys on a repo where Pages IS enabled.

The deploy path is untouched, so the workflow self-heals: the moment Pages
becomes available (public flip or paid plan — owner decision, tracked in
#1086), the next run deploys with no further change.

## Affected packages

- `.github/workflows/deploy-docs.yml` (the gating)
- `scripts/gates/pages-probe.sh` (new probe)
- `scripts/test-deploy-docs-pages-gating.mts` (new regression lane; part of
  `pnpm test` and CI)
- `.github/workflows/ci.yml` (runs the lane)
- `package.json` (`test:pages-gating` script)

No API/MCP contract changes. No new dependencies.

## Owner decision this does NOT make

Whether to enable Pages at all (public flip vs paid plan) stays with the org
owner. This change only makes the workflow tell the truth in the meantime.
