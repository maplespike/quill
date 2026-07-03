#!/usr/bin/env bash
# Banner sibling plan files to point readers at ROADMAP.md as canonical.
# Idempotent: skips files that already contain the banner marker.
#
# Auto-discovers `.sisyphus/plans/*.md` so any future plan added to that
# directory is picked up on the next run, and combines with a short
# static list of top-level Kanban/deploy/strategic-assessment files.

set -euo pipefail
cd "$(dirname "$0")/.."

BANNER='> ⚠️ **Historical artifact** — This document is preserved for context. The single source of truth for the active backlog is [`ROADMAP.md`](./ROADMAP.md). Do not edit without also updating ROADMAP.md.
'

MARKER='single source of truth for the active backlog'

mapfile -t FILES < <(
  {
    find .sisyphus/plans -maxdepth 1 -name '*.md' | sort
    printf '%s\n' DEPLOY-CHECKLIST.md STRATEGIC-ASSESSMENT-STATUS.md KANBAN-AUTOMATION.md KANBAN-SETUP.md
  } | sort
)

updated=0
skipped=0
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "MISSING: $f"
    continue
  fi
  if grep -qF "$MARKER" "$f"; then
    skipped=$((skipped+1))
    continue
  fi

  # Frontmatter probe: `head -1` returns the first line. `tr -d $'\ufeff'`
  # strips the UTF-8 BOM (U+FEFF → 3 bytes EF BB BF). `xargs` (no flags)
  # trims leading/trailing whitespace as a side effect.
  if [[ "$(head -1 "$f" | tr -d $'\ufeff' | xargs)" == "---" ]]; then
    # YAML frontmatter: find the closing `---` within the first 10 lines and
    # insert the banner after it. The `NR<=10` lookahead keeps a later
    # thematic-break `---` from re-triggering. Wrapped in a subshell so a
    # `trap EXIT` cleans up `*.tmp` on success or failure.
    (
      trap 'rm -f "$f.tmp"' EXIT
      awk -v banner="$BANNER" '
        NR==1 && /^---$/ { in_fm=1; print; next }
        NR<=10 && in_fm && /^---$/ { print; print ""; print banner; in_fm=0; next }
        { print }
      ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
    )
  else
    # No frontmatter: prepend the banner + blank line. Subshell + trap
    # so `*.tmp` is cleaned up if `cat`/`mv` errors mid-write.
    (
      trap 'rm -f "$f.tmp"' EXIT
      printf '%s\n\n' "$BANNER" | cat - "$f" > "$f.tmp" && mv "$f.tmp" "$f"
    )
  fi
  updated=$((updated+1))
  echo "UPDATED: $f"
done

echo ""
echo "Summary: updated=$updated skipped=$skipped of ${#FILES[@]} files"
