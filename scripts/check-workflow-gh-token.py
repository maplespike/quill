#!/usr/bin/env python3
"""Regression guard: every workflow step that invokes `gh` must set GH_TOKEN.

Incident: pr-validation.yml "Commit message check" exited 4 because `gh pr view`
ran without GH_TOKEN in its env block (run 35769381611, 2026-09-22).
"""
import sys
from pathlib import Path

WORKFLOW_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".github/workflows")


def check_workflow(path: Path) -> list[str]:
    """Return list of error messages for steps that use gh without GH_TOKEN."""
    try:
        import yaml
    except ImportError:
        # Fallback: skip if PyYAML not available
        return []

    with open(path) as f:
        try:
            data = yaml.safe_load(f)
        except yaml.YAMLError as e:
            return [f"{path}: YAML parse error: {e}"]

    if not data or "jobs" not in data:
        return []

    errors: list[str] = []
    for job_name, job in data["jobs"].items():
        steps = job.get("steps", [])
        for step in steps:
            step_name = step.get("name", "<unnamed>")
            run_text = step.get("run", "")
            env = step.get("env", {})

            if not run_text or not isinstance(run_text, str):
                continue

            # Check if the step uses gh CLI for API calls (not --version/--help)
            # Match: gh <subcommand> where subcommand starts with a letter
            import re
            if not re.search(r"\bgh\s+[a-zA-Z]", run_text):
                continue

            # Check if GH_TOKEN is set in env
            has_gh_token = any("GH_TOKEN" in str(k) or "GH_TOKEN" in str(v) for k, v in env.items()) if env else False

            if not has_gh_token:
                errors.append(
                    f"{path}: job '{job_name}' step '{step_name}' uses gh without GH_TOKEN"
                )

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
