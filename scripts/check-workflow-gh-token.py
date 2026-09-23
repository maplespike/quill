#!/usr/bin/env python3
"""Regression guard: every workflow step that invokes `gh` must set GH_TOKEN.

Incident: pr-validation.yml "Commit message check" exited 4 because `gh pr view`
ran without GH_TOKEN in its env block (run 35769381611, 2026-09-22).
"""
import re
import sys
from pathlib import Path

WORKFLOW_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".github/workflows")


def check_workflow(path: Path) -> list[str]:
    """Return list of error messages for steps that use gh without GH_TOKEN."""
    lines = path.read_text().splitlines()
    errors: list[str] = []
    in_step = False
    step_indent = 0
    step_has_gh = False
    step_has_gh_token = False
    step_name = ""

    for line in lines:
        # Detect step start: `- name:` at any indent
        m = re.match(r"^(\s*)-\s+name:\s*(.+)$", line)
        if m:
            # Check previous step before starting new one
            if step_has_gh and not step_has_gh_token:
                errors.append(
                    f"{path}: step '{step_name}' uses gh without GH_TOKEN"
                )
            in_step = True
            step_indent = len(m.group(1))
            step_name = m.group(2)
            step_has_gh = False
            step_has_gh_token = False
            continue

        # Detect step end: a new key at same or lower indent that is not a list item
        if in_step and re.match(r"^\s*\S", line) and not re.match(r"^\s*-\s", line):
            if step_has_gh and not step_has_gh_token:
                errors.append(
                    f"{path}: step '{step_name}' uses gh without GH_TOKEN"
                )
            in_step = False
            continue

        if not in_step:
            continue

        # Check for gh usage in the step's run block
        if re.search(r"\bgh\s", line):
            step_has_gh = True

        # Check for GH_TOKEN in the step's env block
        if "GH_TOKEN" in line:
            step_has_gh_token = True

    # Check the last step
    if step_has_gh and not step_has_gh_token:
        errors.append(f"{path}: step '{step_name}' uses gh without GH_TOKEN")

    return errors


def main() -> int:
    all_errors: list[str] = []
    for wf in sorted(WORKFLOW_DIR.glob("*.yml")) + sorted(WORKFLOW_DIR.glob("*.yaml")):
        all_errors.extend(check_workflow(wf))

    if all_errors:
        for e in all_errors:
            print(e)
        print(f"\nFAIL: {len(all_errors)} workflow step(s) use gh without GH_TOKEN")
        return 1

    print("PASS: all workflow steps using gh set GH_TOKEN")
    return 0


if __name__ == "__main__":
    sys.exit(main())
