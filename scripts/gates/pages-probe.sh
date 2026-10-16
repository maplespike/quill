#!/usr/bin/env bash
# pages-probe.sh — classify the repository's GitHub Pages state.
#
# Why this exists (issue #1086, run 38768479350): `actions/configure-pages`
# dies with "Get Pages site failed ... Not Found" when the repository has no
# Pages site, so "Deploy Docs to GitHub Pages" went red on every docs/portal
# push — 38 failures, 0 successes since June 2026 — while the one thing the
# run could actually verify (the portal + docs build on a clean runner) was
# green every time. Pages cannot be enabled today: the repo is private, the
# maplespike org is on the free plan, and `POST /repos/{repo}/pages` is
# refused with 422 "Your current plan does not support GitHub Pages for this
# repository" (verified with an org-owner token, 2026-10-15). Red runs
# therefore signalled a code failure the repo cannot fix and hid the build
# signal it could still give.
#
# Verdict contract (pinned by scripts/test-deploy-docs-pages-gating.mts):
#   - writes "verdict=enabled"      to $GITHUB_OUTPUT and exits 0 when a
#     Pages site exists        → caller deploys (unchanged path)
#   - writes "verdict=not-enabled"   and exits 3 on 404 (the documented
#     free-plan-private-repo state) → caller skips ONLY the deploy, green
#   - writes "verdict=error"         and exits 1 on anything else (auth,
#     rate limit, 5xx, missing gh/token/repo) → caller must fail loudly
#   - a crash that writes no verdict at all must be treated by the caller
#     as an error (fail-closed), never as "not-enabled"
#
# Requires GH_TOKEN or GITHUB_TOKEN in scope (minted per run; see
# scripts/gates/check-workflow-gh-auth.mjs for why ambient credentials are
# banned on this runner pool) and `gh` on PATH. GH_REPO must be set.
set -uo pipefail

OUT="${GITHUB_OUTPUT:-}"

emit() { # emit <verdict> — record the verdict for the workflow, when asked.
  if [ -n "$OUT" ]; then
    printf 'verdict=%s\n' "$1" >> "$OUT"
  fi
}

if [ -z "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ]; then
  echo "::error::pages-probe: no GH_TOKEN/GITHUB_TOKEN in env — refusing to guess." >&2
  emit error
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "::error::pages-probe: gh is not on PATH — cannot probe Pages." >&2
  emit error
  exit 1
fi

if [ -z "${GH_REPO:-}" ]; then
  echo "::error::pages-probe: GH_REPO is not set — cannot probe Pages." >&2
  emit error
  exit 1
fi

# Capture stderr only (2>&1 duplicates stderr into the substitution before
# >/dev/null discards stdout). gh writes API errors to stderr and exits 1.
ERR=$(gh api "repos/${GH_REPO}/pages" 2>&1 >/dev/null); rc=$?

if [ "$rc" -eq 0 ]; then
  echo "pages-probe: Pages site exists on ${GH_REPO} — deploy is possible."
  emit enabled
  exit 0
fi

# 404 from GET /pages is exactly "no Pages site on this repository" — the
# documented free-plan-private-repo state, not a failure. Every other error
# (401 bad credentials, 403 rate limit or scopes, 5xx, gh's own exit shapes)
# is real and must fail the run. Bash's [[ ]] substring test is a builtin:
# the probe stays self-contained even on a minimal PATH (pinned by
# scripts/test-deploy-docs-pages-gating.mts, which runs it with PATH=stubdir).
if [[ "$ERR" == *"HTTP 404"* ]]; then
  echo "pages-probe: no Pages site on ${GH_REPO} (404) — Pages is not enabled under the current plan."
  emit not-enabled
  exit 3
fi

echo "::error::pages-probe: gh api exited ${rc}: ${ERR}" >&2
emit error
exit 1
