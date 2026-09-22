#!/usr/bin/env bash
# Set the GitHub repo metadata that describes this project. Idempotent.
#
# Repo description/homepage/topics have no declarative manifest in GitHub, so the
# values live here, in git, and `gh` applies them. Editing them in the web UI is
# drift: re-running this restores them.
set -euo pipefail

REPO="${REPO:-reverb256/quill}"
DESC="Canada's sovereign, AI-native government data pipeline — government records, corporate influence, committee surveillance and policy intelligence. Zero external cloud spend, self-hosted on K3s."
HOME_URL="https://quill.maplespike.ca"
TOPICS=(open-data canada civic-tech policy-intelligence government-data k3s self-hosted typescript mcp ai-agents)

args=(--description "$DESC" --homepage "$HOME_URL")
for t in "${TOPICS[@]}"; do args+=(--add-topic "$t"); done

echo "== setting metadata for $REPO =="
gh repo edit "$REPO" "${args[@]}"
gh api "repos/$REPO" --jq '"  desc: \(.description|.[0:70])...\n  homepage: \(.homepage)\n  topics: \(.topics|join(", "))"'
