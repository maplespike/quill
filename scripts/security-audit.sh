#!/usr/bin/env bash
# Pre-public security audit per Decision 0003 (step 1).
#
# Scans:
#   1. Working tree for dangerous filenames (.env, .pem, .key, .p12,
#      .kubeconfig, .netrc, id_rsa*, id_ed25519*, etc).
#   2. Working tree for secret-shaped content (private keys, AWS
#      access key IDs, GitHub/OpenAI/Stripe/Slack tokens,
#      QUILL_PII_HASH_SECRET, AKASH_* mnemonics).
#   3. Full git history (every branch, every commit) for the same
#      secret patterns. This is the part gitleaks would do.
#
# Output: docs/security-audit-pre-public.md (human-readable report) +
# exit code 0 if CLEAN, 1 if any hits.
#
# Designed before flipping github.com/reverb256/quill from
# private → public, per maplespike/docs/decisions/0003-*.md.

set -euo pipefail

cd "$(dirname "$0")/.."
report="docs/security-audit-pre-public.md"
mkdir -p docs

# Patterns ------------------------------------------------------------
DANGEROUS_FILE_RE='\.env($|\.)|\.pem($|\.)|\.key($|\.)|\.p12($|\.)|\.kubeconfig($|\.)|\.netrc$|^/?id_(rsa|ed25519|dsa|ecdsa)$|^/?\.env'
SECRET_RE='-----BEGIN .* PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|aws_secret_access_key|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}|sk-[A-Za-z0-9]{48}|sk_live_[A-Za-z0-9]{24,}|sk_test_[A-Za-z0-9]{24,}|xox[baprs]-[A-Za-z0-9-]{20,}|QUILL_PII_HASH_SECRET[ =:]+|AKASH_(MNEMONIC|SEED|PASSWORD|KEY|OPERATOR_ADDRESS|CHAIN_ID)[ =:]+'

# Excludes for false-positive reduction
EXCLUDE_DIRS='--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build --exclude-dir=target --exclude-dir=.next --exclude-dir=.turbo --exclude-dir=coverage --exclude-dir=.astro --exclude-lockfiles'
EXCLUDE_FILE_RE='test|fake|fixture|\.example$|node_modules|\.min\.js|\.lock$'

{
  echo "# Pre-public security audit"
  echo
  echo "- **Run:** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- **Repo:** $(basename "$(pwd)") (working tree: \\$(pwd))"
  echo "- **Scope:** working tree + full git history"
  echo "- **Decision driver:** maplespike/docs/decisions/0003-maplespike-public-visibility.md"
  echo
} > "$report"

findings=0

# Phase 1: dangerous filenames -----------------------------------------
{
  echo "## Phase 1 — Dangerous filenames (working tree)"
  echo
  echo 'Pattern: `.env`, `.pem`, `.key`, `.p12`, `.kubeconfig`, `.netrc`, `id_rsa`, `id_ed25519`, `id_dsa`, `id_ecdsa`.'
  echo
} >> "$report"

# Use git ls-files so .gitignore'd cruft doesn't show.
suspect_files="$(git ls-files 2>/dev/null | grep -E "$DANGEROUS_FILE_RE" | grep -vE "$EXCLUDE_FILE_RE" || true)"
if [[ -n "$suspect_files" ]]; then
  {
    echo "### ⚠ Hits ($(echo "$suspect_files" | wc -l)):"
    echo
    echo '```'
    echo "$suspect_files"
    echo '```'
    echo
    findings=$((findings+1))
  } >> "$report"
else
  echo "(none)" >> "$report"
fi
echo >> "$report"

# Phase 2: secret-shaped content in working tree -----------------------
{
  echo "## Phase 2 — Secret-shaped content (working tree)"
  echo
  echo 'Patterns: PEM private keys, AWS access keys (`AKIA…`/`ASIA…`), aws_secret_access_key, GitHub PATs (`ghp_…`/`gho_…`/`github_pat_…`), OpenAI/Stripe/Slack tokens, QUILL_PII_HASH_SECRET literal, AKASH_MNEMONIC/SEED/PASSWORD/KEY/OPERATOR_ADDRESS/CHAIN_ID literals.'
  echo
} >> "$report"

if command -v rg >/dev/null; then
  scan_engine="rg"
  secret_hits="$(rg -n --no-heading -e "$SECRET_RE" . $EXCLUDE_DIRS 2>/dev/null || true)"
else
  # CRITICAL: use `-e` so grep doesn't treat the regex (which starts with `-----`)
  # as a long option and abort.
  scan_engine="grep -RnE -e"
  secret_hits="$(grep -RnE --binary-files=without-match -e \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
    --exclude-dir=build --exclude-dir=target --exclude-dir=.next \
    --exclude-dir=.turbo --exclude-dir=coverage --exclude-dir=.astro \
    "$SECRET_RE" . 2>/dev/null || true)"
fi
# Filter false positives by path.
filtered="$(echo "$secret_hits" | grep -vE "$EXCLUDE_FILE_RE" || true)"

if [[ -n "$filtered" ]]; then
  {
    echo "### ⚠ Hits (engine: $scan_engine, $(echo "$filtered" | wc -l) lines):"
    echo
    echo '```'
    echo "$filtered"
    echo '```'
    echo
    findings=$((findings+1))
  } >> "$report"
else
  echo "(none)" >> "$report"
fi
echo >> "$report"

# Phase 3: secret-shaped content in git history ------------------------
{
  echo "## Phase 3 — Secret-shaped content (full git history)"
  echo
  echo 'Runs the same secret regex against every commit on every branch.'
  echo
} >> "$report"

hist_hits="$(git log --all -p 2>/dev/null | grep -nE -e "$SECRET_RE" || true)"
hist_hits_total="$(printf '%s\n' "$hist_hits" | wc -l || echo 0)"
if [[ -n "$hist_hits" ]]; then
  hist_hits="$(printf '%s\n' "$hist_hits" | head -500)"
fi
if [[ -n "$hist_hits" ]]; then
  {
    echo "### ⚠ History hits ($hist_hits_total total, first 500 shown):"
    echo
    echo '```'
    echo "$hist_hits"
    echo '```'
    echo
    echo '> The column-3-line-numbered output here is git-blame-style pseudo-line numbers across concatenated diff hunks. Use `git log --all -S <pattern>` to find the commits.'
    echo
    findings=$((findings+1))
  } >> "$report"
else
  echo "(none)" >> "$report"
fi
echo >> "$report"

{
  echo "---"
  echo
  if (( findings == 0 )); then
    echo "## Verdict: CLEAN"
    echo
    echo "No hits in any phase. Safe to proceed with Decision 0003 step 3 (revert fallback wording in surface files) and user-driven GitHub visibility flip."
  else
    echo "## Verdict: HITS"
    echo
    echo "Findings detected across $findings phase(s). DO NOT flip the repo to public until these are resolved."
  fi
} >> "$report"

echo "Wrote $report"
if (( findings == 0 )); then
  echo "audit/security-audit.sh: CLEAN"
  exit 0
else
  echo "audit/security-audit.sh: HITS — see $report"
  exit 1
fi
