#!/usr/bin/env python3
"""Sisyphus dispatcher — called by Hermes cron job.
Polls issues, creates worktrees, checks for continuations, cleans up.
"""
import json, subprocess, os, sys

REPO = "/data/projects/own/maplespike"
STATE = os.path.join(REPO, ".sisyphus", "state.json")
TRACK = os.path.join(REPO, ".sisyphus", "track.sh")

def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)

def main():
    os.chdir(REPO)

    # 1. Poll for new issues
    print("=== Poll ===")
    r = run(["bash", TRACK, "poll"])
    print(r.stdout or "(no output)")
    if r.returncode != 0:
        print(f"Poll failed: {r.stderr}", file=sys.stderr)

    # 2. Check for continuation needs
    print("=== Continuation Check ===")
    r = run(["bash", TRACK, "status", "json"])
    if r.returncode == 0:
        state = json.loads(r.stdout)
        for num, info in state.get("active", {}).items():
            status = info.get("status", "")
            attempts = info.get("attempts", 0)
            pr_url = info.get("pr_url")
            if status in ("retrying", "continuation") and pr_url:
                print(f"Issue #{num} needs continuation ({status}, attempt {attempts})")
                cr = run(["bash", TRACK, "continue", str(num)])
                print(cr.stdout or "")
            elif status == "created" and info.get("path"):
                print(f"Issue #{num} created but not started: {info['path']}")

    # 3. Cleanup closed issues
    print("=== Cleanup ===")
    r = run(["bash", TRACK, "cleanup"])
    print(r.stdout or "(nothing to clean)")

    # 4. Summary
    print("=== Summary ===")
    run(["bash", TRACK, "status"])

if __name__ == "__main__":
    main()
