#!/usr/bin/env bash
# Validate the gitleaks false-positive baseline before the secrets lane scans.
#
# Run 35676870104 failed here: .github/workflows/live-data-check.yml carried a
# 64-hex JWT_SECRET literal, and the baseline that should have classified the
# other findings was inert because .gitleaksignore held TOML blocks instead of
# fingerprints (34 "Invalid .gitleaksignore entry" warnings). This check guards
# the baseline against both failure modes.
#
# It proves three properties:
#   1. .gitleaksignore holds fingerprints only. Anything else is ignored
#      silently, which makes the whole baseline inert.
#   2. .gitleaks.toml keeps the default ruleset and holds no catch-all entry.
#      A catch-all turns the gate off while looking healthy.
#   3. The baseline behaves end to end: an audited placeholder value is
#      ignored, and a 64-hex secret is still reported.
#
# Usage:
#   scripts/check-gitleaks-baseline.sh                  # structural checks
#   scripts/check-gitleaks-baseline.sh --require-gitleaks   # + live scan
#
# The live scan needs the gitleaks binary. Set GITLEAKS_BIN, or put gitleaks on
# PATH. Without a binary, the script runs the structural checks only and says so.
set -euo pipefail

cd "$(dirname "$0")/.."
root="$(pwd)"
require_gitleaks=0
for arg in "$@"; do
  case "$arg" in
    --require-gitleaks) require_gitleaks=1 ;;
    *) printf 'unknown option: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

failures=0
pass() { printf 'ok    %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*" >&2; failures=$((failures + 1)); }

# 2026-10-16: the literal that failed run 35676870104 (.github/workflows/
# live-data-check.yml) was removed from ALL history by the #854 rewrite
# (git filter-repo). No incident fingerprint is required any more; this check
# now only guards the file's shape: every entry must be a finding fingerprint.

# ── 1. .gitleaksignore: fingerprints only ────────────────────────────
printf '\n.gitleaksignore\n'
printf '               '
ignore_bad=0
if [ ! -f .gitleaksignore ]; then
  fail ".gitleaksignore is missing"
else
  line_no=0
  while IFS= read -r line || [ -n "$line" ]; do
    line_no=$((line_no + 1))
    case "$line" in
      ''|'#'*) continue ;;
    esac
    # Fingerprint: <commit>:<file>:<rule>:<line> or <file>:<rule>:<line>.
    if ! printf '%s' "$line" | grep -Eq '^[0-9a-fA-F]{7,64}:[^:]+:[^:]+:[0-9]+$' &&
       ! printf '%s' "$line" | grep -Eq '^[^:]+:[^:]+:[0-9]+$'; then
      fail ".gitleaksignore:$line_no is not a fingerprint: ${line}"
      printf '      gitleaks ignores this line and scans on. Path and regex\n' >&2
      printf '      allow-lists belong in .gitleaks.toml.\n' >&2
      ignore_bad=1
    fi
  done < .gitleaksignore
  [ "$ignore_bad" -eq 0 ] && pass "every entry is a finding fingerprint"
  # (No required fingerprint since the 2026-10-16 rewrite; shape checked above.)
fi

# ── 2. .gitleaks.toml: defaults kept, no catch-all ───────────────────
printf '\n.gitleaks.toml\n'
if [ ! -f .gitleaks.toml ]; then
  fail ".gitleaks.toml is missing (the baseline has no home)"
else
  grep -q '^useDefault *= *true' .gitleaks.toml &&
    pass "extends the default ruleset" ||
    fail "useDefault = true is absent — the built-in rules would be dropped"

  if grep -Eq '^\[\[?allowlist' .gitleaks.toml; then
    pass "declares a global allow-list"
  else
    fail "no [allowlist] table — every audited false positive would fail"
  fi

  # A catch-all entry silences the gate while the config still looks correct.
  catchall=""
  while IFS= read -r line; do
    case "$line" in
      *"'''"*|*'"'*|*"'"*) ;;
      *) continue ;;
    esac
    entry="$(printf '%s' "$line" | sed -E "s/^[[:space:]]*//; s/^('''|\"|')//; s/('''|\"|')[,[:space:]]*\$//")"
    case "$entry" in
      '.*'|'^.*$'|'.+'|'/'|'^'|'^$'|'^/$') catchall="$entry" ;;
    esac
  done < .gitleaks.toml
  if [ -n "$catchall" ]; then
    fail "allow-list entry '$catchall' is a catch-all — the gate would never fire"
  else
    pass "no catch-all allow-list entry"
  fi

  # The 64-hex secret shape from the incident must stay detectable.
  if grep -q '\^0x\[0-9a-fA-F\]{40}\$' .gitleaks.toml; then
    pass "address rule stays 40-hex anchored (a 64-hex key still fails)"
  fi

  # The singular table is required up to gitleaks 8.24 (what the action
  # installs); the plural array is silently ignored there.
  if grep -q '^\[\[allowlists\]\]' .gitleaks.toml && ! grep -q '^\[allowlist\]' .gitleaks.toml; then
    fail "[[allowlists]] alone is inert on gitleaks <= 8.24 — use [allowlist]"
  fi
fi

# ── 3. Live behaviour ────────────────────────────────────────────────
bin="${GITLEAKS_BIN:-}"
if [ -z "$bin" ] && command -v gitleaks >/dev/null 2>&1; then
  bin="$(command -v gitleaks)"
fi

if [ -z "$bin" ] || [ ! -x "$bin" ]; then
  if [ "$require_gitleaks" -eq 1 ]; then
    fail "no gitleaks binary (set GITLEAKS_BIN or install gitleaks)"
  else
    printf '\nlive scan\nSKIP  no gitleaks binary found — structural checks only\n'
  fi
else
  printf '\nlive scan (%s)\n' "$("$bin" version 2>/dev/null | tr -d '\n')"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  # Audited placeholder value, exactly as it appears in the docs.
  mkdir -p "$tmp/placeholder/docs"
  printf '# Auth example\n\n```bash\ncurl -H "Authorization: Bearer YOUR_API_KEY" https://api.example/v1/health\n```\n' \
    > "$tmp/placeholder/docs/example.md"

  # The 64-hex JWT secret shape from run 35676870104. Derive it from a fixed
  # non-secret string: a literal 64-hex value here would trip the gate this
  # script guards (it did, on the first push — review caught it pre-merge).
  probe_hex="$(printf 'gitleaks baseline probe' | sha256sum | cut -c1-64)"
  mkdir -p "$tmp/secret/src"
  printf "export const JWT_SECRET = '%s';\n" "$probe_hex" > "$tmp/secret/src/leak.ts"

  for fixture in placeholder secret; do
    (
      cd "$tmp/$fixture"
      git init -q -b main .
      git -c user.email=ci@example.invalid -c user.name="ci" add -A
      git -c user.email=ci@example.invalid -c user.name="ci" commit -qm "fixture: $fixture"
    )
    cp .gitleaksignore "$tmp/$fixture/.gitleaksignore"
  done

  # Control config: defaults, no allow-list. The placeholder fixture must trip
  # a rule here, or the allow-list test below proves nothing.
  printf '[extend]\nuseDefault = true\n' > "$tmp/no-allowlist.toml"

  # A scan that fails to run must not read as "no findings".
  scan() { # <repo dir> <config> <report> <log>; 0 = the engine ran
    ( cd "$1" && "$bin" git --exit-code=0 --no-banner --config "$2" \
        --report-format=json --report-path="$3" --log-level=debug \
        --log-opts=-1 ) >"$4" 2>&1
  }
  findings() { # <report>
    if [ -f "$1" ]; then grep -c '"RuleID":' "$1" 2>/dev/null || true; else printf '0'; fi
  }
  # Sets scan_error and scan_count. Runs in the parent shell so `fail` counts.
  scan_error=0
  scan_count=""
  run_scan() { # <label> <dir> <config> <report> <log>
    if scan "$2" "$3" "$4" "$5"; then
      scan_error=0
      scan_count="$(findings "$4")"
    else
      scan_error=1
      scan_count=""
      fail "the $1 scan did not run — see $5"
    fi
  }

  run_scan control "$tmp/placeholder" "$tmp/no-allowlist.toml" "$tmp/control.json" "$tmp/control.log"
  if [ "$scan_error" -eq 0 ]; then
    if [ "$scan_count" -ge 1 ]; then
      pass "control: the placeholder trips a default rule (test is not vacuous)"
    else
      fail "control: the placeholder did not trip any rule — the allow-list test cannot prove anything"
    fi
  fi

  run_scan placeholder "$tmp/placeholder" "$root/.gitleaks.toml" "$tmp/placeholder.json" "$tmp/placeholder.log"
  placeholder_ran=$((1 - scan_error))
  if [ "$scan_error" -eq 0 ]; then
    if [ "$scan_count" -eq 0 ]; then
      pass "an audited placeholder value is ignored"
    else
      fail "the allow-list did not ignore the placeholder value"
    fi
  fi

  if [ -f "$tmp/placeholder.log" ] && grep -q "Invalid .gitleaksignore entry" "$tmp/placeholder.log"; then
    fail "gitleaks rejects an .gitleaksignore entry (the baseline is inert)"
  elif [ "$placeholder_ran" -eq 1 ]; then
    pass ".gitleaksignore entries are accepted (no 'Invalid' warnings)"
  fi

  run_scan secret "$tmp/secret" "$root/.gitleaks.toml" "$tmp/secret.json" "$tmp/secret.log"
  if [ "$scan_error" -eq 0 ]; then
    if [ "$scan_count" -ge 1 ]; then
      pass "a 64-hex JWT secret is still reported (the gate bites)"
    else
      fail "a 64-hex JWT secret was ignored — an allow-list entry is too broad"
    fi
  fi
fi

if [ "$failures" -gt 0 ]; then
  printf '\n%d gitleaks baseline check(s) failed.\n' "$failures" >&2
  exit 1
fi
printf '\ngitleaks baseline OK\n'
