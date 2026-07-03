#!/usr/bin/env bash
# Banner sibling plan files to point readers at ROADMAP.md as canonical.
# Idempotent: skips files that already contain the banner marker.
#
# Defensive: the frontmatter probe tolerates a leading UTF-8 BOM byte
# (U+FEFF) and stray whitespace on line 1 — both have caused the script
# to misclassify a file as "no frontmatter" and prepend the banner above
# a YAML `---` block in the past (see commit 2114c40 manual sed fix on
# KANBAN-{AUTOMATION,SETUP}.md).

set -euo pipefail
cd "$(dirname "$0")/.."

BANNER='> ⚠️ **Historical artifact** — This document is preserved for context. The single source of truth for the active backlog is [`ROADMAP.md`](./ROADMAP.md). Do not edit without also updating ROADMAP.md.
'

MARKER='single source of truth for the active backlog'

FILES=(
  .sisyphus/plans/issue-130-email-notifications.md
  .sisyphus/plans/issue-137-sedar-module.md
  .sisyphus/plans/issue-138-journalism-mode.md
  .sisyphus/plans/issue-194-195-live-tests.md
  .sisyphus/plans/issue-199-portal-qa.md
  .sisyphus/plans/issue-200-k3s-kubeconfig.md
  .sisyphus/plans/issue-83-portal-refactor.md
  .sisyphus/plans/gap-addressal-plan.md
  .sisyphus/plans/git-cleanup-execution.md
  .sisyphus/plans/git-maintenance-plan.md
  .sisyphus/plans/implement-missing-modules.md
  .sisyphus/plans/legal-compliance-audit.md
  .sisyphus/plans/quality-issue-plan.md
  DEPLOY-CHECKLIST.md
  STRATEGIC-ASSESSMENT-STATUS.md
  KANBAN-AUTOMATION.md
  KANBAN-SETUP.md
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

  # Strip a leading UTF-8 BOM (U+FEFF) and any stray whitespace before
  # testing equality to `---`. `xargs` (with no flags) trims and collapses
  # internal whitespace runs on line 1.
  if [[ "$(head -1 "$f" | tr -d $'\ufeff' | xargs)" == "---" ]]; then
    # YAML frontmatter: find closing ---, insert banner after it
    awk -v banner="$BANNER" '
      NR==1 && /^---$/ { in_fm=1; print; next }
      in_fm && /^---$/ { print; print ""; print banner; in_fm=0; next }
      { print }
    ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  else
    # No frontmatter: prepend banner + blank line
    printf '%s\n\n' "$BANNER" | cat - "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  fi
  updated=$((updated+1))
  echo "UPDATED: $f"
done

echo ""
echo "Summary: updated=$updated skipped=$skipped of ${#FILES[@]} files"
