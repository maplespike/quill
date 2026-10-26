#!/usr/bin/env bash
# Job-started hook for the self-hosted runners.
#
# A pull_request workflow runs the file from the merge commit. A fork can
# replace that file and select the self-hosted labels. This hook runs on the
# runner, before the job, and refuses a job whose head repository is not
# this repository.
#
# Install on each self-hosted runner. In the runner directory .env set:
#
#   ACTIONS_RUNNER_HOOK_JOB_STARTED=/absolute/path/scripts/ci/refuse-untrusted-self-hosted.sh
#
# Restart the runner after the edit. This repository does not install the
# hook. Confirm it on the host.
#
# Also set GitHub Actions → General → Fork pull request workflows to
# "Require approval for all outside collaborators". Approval must not be
# treated as permission to use the cluster runner. This hook still refuses
# a fork pull_request after an approval. A same-repo pull_request is allowed.
set -euo pipefail

event="${GITHUB_EVENT_NAME:-}"
repo="${GITHUB_REPOSITORY:-}"
payload="${GITHUB_EVENT_PATH:-}"

refuse() {
  echo "refuse-untrusted-self-hosted: $1" >&2
  exit 1
}

case "$event" in
  pull_request|pull_request_target|workflow_run)
    ;;
  *)
    exit 0
    ;;
esac

if [[ -z "$payload" || ! -f "$payload" ]]; then
  refuse "refusing ${event} because the event payload is missing."
fi

head="$(python3 - "$payload" "$event" <<'PY'
import json, sys
doc = json.load(open(sys.argv[1], encoding="utf-8"))
event = sys.argv[2]
if event in ("pull_request", "pull_request_target"):
    repo = ((doc.get("pull_request") or {}).get("head") or {}).get("repo") or {}
    print(repo.get("full_name") or "")
elif event == "workflow_run":
    repo = (doc.get("workflow_run") or {}).get("head_repository") or {}
    print(repo.get("full_name") or "")
else:
    print("")
PY
)"

if [[ -z "$head" || "$head" != "$repo" ]]; then
  refuse "refusing ${event} from a fork."
fi
