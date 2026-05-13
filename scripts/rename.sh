#!/usr/bin/env bash
# Rename the maplespike project to anything else.
# Usage: ./scripts/rename.sh maplespike "MapleSpike" "MapleSpike Canada"
#
# Dry run: ./scripts/rename.sh maplespike "MapleSpike" "MapleSpike Canada" --dry

set -euo pipefail

NEW_NAME="${1:?Usage: $0 <new-name> <new-title> <new-full-title> [--dry]}"
NEW_TITLE="${2:?}"
NEW_FULL="${3:?}"
DRY="${4:-}"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
OLD_NAME="maplespike"
OLD_TITLE="MapleSpike"
OLD_FULL="MapleSpike Canada"

echo "Renaming: $OLD_NAME → $NEW_NAME"
echo "  Title: $OLD_TITLE → $NEW_TITLE"
echo "  Full:  $OLD_FULL → $NEW_FULL"
echo "  Repo:  $REPO"
echo ""

cd "$REPO"

# Files to rename (exclude node_modules, .git, dist)
FILES=$(grep -rl "$OLD_NAME\|$OLD_TITLE\|$OLD_FULL" \
  --include='*.ts' --include='*.tsx' --include='*.json' \
  --include='*.md' --include='*.html' --include='*.css' \
  --include='*.js' --include='*.yaml' --include='*.yml' \
  --include='*.nix' --include='*.sh' --include='*.sql' . \
  2>/dev/null | grep -v node_modules | grep -v '.git' | grep -v dist | grep -v pnpm-lock || true)

COUNT=$(echo "$FILES" | wc -l)

if [ "$DRY" = "--dry" ]; then
  echo "Would rename in $COUNT files:"
  echo "$FILES"
  exit 0
fi

echo "Renaming in $COUNT files..."

# Replace exact matches (case-sensitive variations)
for f in $FILES; do
  # Use temporary file to handle the replacements
  cp "$f" "$f.bak"
  sed -i \
    -e "s/$OLD_FULL/$NEW_FULL/g" \
    -e "s/$OLD_TITLE/$NEW_TITLE/g" \
    -e "s/$OLD_NAME/$NEW_NAME/g" \
    "$f" 2>/dev/null || true
  rm -f "$f.bak"
done

echo ""
echo "Done. Files modified. Verify with:"
echo "  grep -r '$NEW_NAME' --include='*' . | grep -v node_modules | grep -v '.git' | head -20"
