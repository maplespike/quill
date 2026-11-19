#!/usr/bin/env python3
"""Regression guard: gitleaks/gitleaks-action must receive GITLEAKS_LICENSE.

Incident: the secrets CI job failed on every PR and on main until 2026-10-02.
gitleaks/gitleaks-action requires a licence for organisation repositories.
The step passed only GITHUB_TOKEN, so the action exited with
"[maplespike] is an organization. License key is required."
Dropping the env line reproduces that failure on every PR regardless of
the diff.

The check reads workflow YAML only. It prints the variable name and the
required secret reference. It does not read or print a secret value.
"""
import re
import sys
from pathlib import Path

DEFAULT_WORKFLOWS = Path(".github/workflows")
ACTION_RE = re.compile(r"^gitleaks/gitleaks-action(?:@.+)?$")
SECRET_REF_RE = re.compile(r"""^["']?\$\{\{\s*secrets\.GITLEAKS_LICENSE\s*\}\}["']?$""")
CONSEQUENCE = (
    "the org-repo scan fails on every PR regardless of contents"
)


def indent_of(line: str) -> int:
    return len(line) - len(line.lstrip(" \t"))


def is_blank(line: str) -> bool:
    return line.strip() == ""


def is_comment(line: str) -> bool:
    return line.lstrip().startswith("#")


def key_of(line: str) -> tuple[str, int] | None:
    """Mapping key and its content indent. A leading `- ` counts as two columns."""
    match = re.match(r"^(\s*)(?:-\s+)?([A-Za-z0-9_.-]+):", line)
    if not match:
        return None
    extra = 2 if line.lstrip().startswith("- ") else 0
    return match.group(2), len(match.group(1)) + extra


def block_end(lines: list[str], start: int, indent: int) -> int:
    for index in range(start + 1, len(lines)):
        line = lines[index]
        if is_blank(line) or is_comment(line):
            continue
        if indent_of(line) <= indent:
            return index
    return len(lines)


def ancestors(lines: list[str], index: int) -> list[tuple[int, int]]:
    """Enclosing mapping keys above `index`, nearest first."""
    chain: list[tuple[int, int]] = []
    level = indent_of(lines[index]) + 1
    cursor = index - 1
    while cursor >= 0 and level > 0:
        line = lines[cursor]
        if not is_blank(line) and not is_comment(line):
            indent = indent_of(line)
            if indent < level:
                chain.append((cursor, indent))
                level = indent
        cursor -= 1
    return chain


def license_value_ok(raw: str) -> bool:
    """True when the mapping value is the secrets reference. Never log `raw`."""
    value = raw.split(" #", 1)[0].strip()
    return SECRET_REF_RE.fullmatch(value) is not None


def env_license_status(
    lines: list[str], start: int, end: int, container_indent: int
) -> str | None:
    """'ok' or 'bad' when an env map at `container_indent` sets the key.

    None when that map does not set GITLEAKS_LICENSE. The returned status
    never includes the value.
    """
    status: str | None = None
    for index in range(start, end):
        line = lines[index]
        if is_blank(line) or is_comment(line):
            continue
        parsed = key_of(line)
        if not parsed or parsed[0] != "env" or parsed[1] != container_indent:
            continue
        for entry_index in range(index + 1, end):
            entry = lines[entry_index]
            if is_blank(entry) or is_comment(entry):
                continue
            if indent_of(entry) <= container_indent:
                break
            entry_key = key_of(entry)
            if (
                not entry_key
                or entry_key[0] != "GITLEAKS_LICENSE"
                or entry_key[1] != container_indent + 2
            ):
                continue
            raw = re.sub(r"^\s*GITLEAKS_LICENSE:\s*", "", entry)
            # Last key wins, matching YAML. Do not keep `raw` after the check.
            status = "ok" if license_value_ok(raw) else "bad"
    return status


def sibling_env_license(lines: list[str], index: int, indent: int) -> str | None:
    start = index - 1
    while start >= 0:
        line = lines[start]
        if not is_blank(line) and not is_comment(line) and indent_of(line) < indent:
            break
        start -= 1
    end = index + 1
    while end < len(lines):
        line = lines[end]
        if not is_blank(line) and not is_comment(line) and indent_of(line) < indent:
            break
        end += 1
    return env_license_status(lines, start + 1, end, indent)


def workflow_env_license(lines: list[str]) -> str | None:
    for index, line in enumerate(lines):
        if is_blank(line) or is_comment(line):
            continue
        parsed = key_of(line)
        if not parsed or parsed[1] != 0 or parsed[0] != "env":
            continue
        return env_license_status(lines, index, block_end(lines, index, 0), 0)
    return None


def license_in_scope(lines: list[str], start: int, end: int, item_indent: int) -> str:
    """'ok', 'bad', or 'missing'. Step env overrides job env, which overrides workflow env."""
    step = env_license_status(lines, start, end, item_indent + 2)
    if step is not None:
        return step
    for index, indent in ancestors(lines, start):
        inherited = sibling_env_license(lines, index, indent)
        if inherited is not None:
            return inherited
    inherited = workflow_env_license(lines)
    if inherited is not None:
        return inherited
    return "missing"


def step_name(lines: list[str], start: int, end: int) -> str:
    for line in lines[start:end]:
        match = re.match(r"^\s*(?:-\s+)?name:\s*(.+?)\s*$", line)
        if match:
            return match.group(1).strip().strip("'\"")
    return "<unnamed step>"


def uses_action(line: str) -> str | None:
    match = re.match(r"^\s*(?:-\s+)?uses:\s*(\S+)", line)
    if not match:
        return None
    return match.group(1).strip("'\"")


def check_text(text: str, label: str) -> tuple[list[str], int]:
    """Return error lines and the number of gitleaks-action steps."""
    lines = text.splitlines()
    errors: list[str] = []
    steps = 0
    for index, line in enumerate(lines):
        if is_blank(line) or is_comment(line):
            continue
        if not re.match(r"^\s*-\s+\S", line):
            continue
        item_indent = indent_of(line)
        end = block_end(lines, index, item_indent)
        action = None
        action_line = index
        for body_index in range(index, end):
            body = lines[body_index]
            if is_blank(body) or is_comment(body):
                continue
            parsed = key_of(body)
            if not parsed or parsed[0] != "uses" or parsed[1] != item_indent + 2:
                continue
            candidate = uses_action(body)
            if candidate and ACTION_RE.fullmatch(candidate):
                action = candidate
                action_line = body_index
                break
        if action is None:
            continue
        steps += 1
        status = license_in_scope(lines, index, end, item_indent)
        if status == "ok":
            continue
        name = step_name(lines, index, end)
        if status == "bad":
            detail = (
                "sets GITLEAKS_LICENSE to a value other than "
                "${{ secrets.GITLEAKS_LICENSE }}"
            )
        else:
            detail = "does not set GITLEAKS_LICENSE"
        errors.append(
            f"{label}:{action_line + 1}: step '{name}' uses {action} but {detail} "
            f"({CONSEQUENCE})"
        )
    return errors, steps


def workflow_files(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    files = sorted(path.glob("*.yml")) + sorted(path.glob("*.yaml"))
    return [item for item in files if item.is_file()]


def check_path(path: Path) -> tuple[list[str], int]:
    files = workflow_files(path)
    if not files:
        return [f"{path}: no workflow files to check ({CONSEQUENCE})"], 0
    errors: list[str] = []
    steps = 0
    for workflow in files:
        found, count = check_text(workflow.read_text(), str(workflow))
        errors.extend(found)
        steps += count
    if steps == 0:
        errors.append(
            f"{path}: no gitleaks/gitleaks-action step, so GITLEAKS_LICENSE is not passed "
            f"({CONSEQUENCE})"
        )
    return errors, steps


def main() -> int:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_WORKFLOWS
    if not target.exists():
        print(f"{target}: not found", file=sys.stderr)
        return 2
    errors, steps = check_path(target)
    if errors:
        for error in errors:
            print(error)
        print(
            f"\nFAIL: gitleaks/gitleaks-action is missing GITLEAKS_LICENSE "
            f"({CONSEQUENCE})"
        )
        return 1
    print(
        f"PASS: {steps} gitleaks/gitleaks-action step(s) pass GITLEAKS_LICENSE from secrets"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
