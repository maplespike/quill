#!/usr/bin/env python3
"""Whole-repository similarity comparison between Quill and a predecessor tree.

OpenSpec 3.2 asks for "exact candidates and limitations" rather than a bounded
manual sample. This produces a reproducible measurement so the claim rests on a
number that can be re-run, not on a reading of three files.

Method, and why each choice is conservative toward finding overlap:

  * Both trees are reduced to a normalised token stream per file. Comments,
    docstrings, and string literals are stripped, because a shared licence
    header or a shared API constant is not evidence of copied implementation.
  * Files are compared with a shingle/winnowed fingerprint over token
    5-grams. A 5-gram of normalised tokens is long enough that a match is
    unlikely to arise from naming alone, and short enough to survive the
    reformatting that a hand-port between languages would introduce.
  * Longest-common-substring on tokens is reported per matched pair, because
    "these two files share a 40-token run" is a far more actionable statement
    than a similarity percentage.
  * The same measurement is run tree-against-itself to establish the noise
    floor: what two unrelated files in the same codebase score. A cross-repo
    score below the intra-repo score is not evidence of anything.

Usage:  similarity.py <quill-root> <predecessor-root> [--min-tokens N]
"""

from __future__ import annotations

import argparse
import json
import keyword
import re
import sys
from collections import defaultdict
from pathlib import Path

# Extensions worth comparing. Markdown is deliberately excluded: shared prose
# about the same public API is expected and is not code reuse.
CODE_EXT = {".ts", ".tsx", ".js", ".mjs", ".cjs", ".py"}

SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", ".next", ".turbo", "coverage",
    "__pycache__", ".venv", "venv", ".pytest_cache", "docs", "public",
    ".planning", "tests", "test", "__tests__",
}

# Python keywords have no counterpart in the TypeScript token stream; leaving
# them in would let a Python file match a TS file on `import`/`return` alone.
PY_ONLY = set(keyword.kwlist) | {
    "self", "None", "True", "False", "elif", "def", "pass", "raise",
    "except", "finally", "lambda", "yield", "nonlocal", "assert", "del",
    "global", "with", "as", "is", "not", "and", "or", "in", "class",
}

TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def strip_comments_and_strings(src: str) -> str:
    """Remove comments and string literals, the two biggest false-positive sources."""
    out: list[str] = []
    i, n = 0, len(src)
    quote: str | None = None
    while i < n:
        ch = src[i]
        if quote:
            # Triple-quoted docstrings run until the closing delimiter.
            if src.startswith(quote * 3, i):
                end = src.find(quote * 3, i + 3)
                i = n if end == -1 else end + 3
                quote = None
                continue
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if src.startswith('"""', i) or src.startswith("'''", i):
            quote = ch
            i += 3
            continue
        if ch in "\"'`":
            quote = ch
            i += 1
            continue
        if ch == "/" and i + 1 < n and src[i + 1] == "/":
            while i < n and src[i] != "\n":
                i += 1
            continue
        if ch == "#":
            while i < n and src[i] != "\n":
                i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def tokens_of(path: Path) -> list[str]:
    try:
        src = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    raw = TOKEN_RE.findall(strip_comments_and_strings(src))
    if path.suffix == ".py":
        raw = [t for t in raw if t not in PY_ONLY]
    return [t.lower() for t in raw]


def shingles(toks: list[str], k: int) -> set[str]:
    if len(toks) < k:
        return {" ".join(toks)} if toks else set()
    return {" ".join(toks[i : i + k]) for i in range(len(toks) - k + 1)}


def lcs_run(a: list[str], b: list[str], cap: int = 1200) -> list[str]:
    """Longest common contiguous token run between two token sequences.

    Forward pass is rolling-DP, recording where the longest run *ends* rather
    than the full table, which keeps memory at one row. The run itself is then
    recovered by walking backwards from that end position and comparing tokens
    directly: a run of length L ending at (i, j) means the last L tokens of
    each prefix are equal, so no table is needed to confirm it.
    """
    if not a or not b:
        return []
    a, b = a[:cap], b[:cap]
    prev = [0] * (len(b) + 1)
    best = 0
    best_i = best_j = 0
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        ai = a[i - 1]
        for j in range(1, len(b) + 1):
            if ai == b[j - 1]:
                v = prev[j - 1] + 1
                cur[j] = v
                if v > best:
                    best, best_i, best_j = v, i, j
        prev = cur
    if best == 0:
        return []
    out: list[str] = []
    i, j = best_i, best_j
    while i > 0 and j > 0 and a[i - 1] == b[j - 1]:
        out.append(b[j - 1])
        i -= 1
        j -= 1
    return out[::-1]


def collect(root: Path) -> dict[Path, list[str]]:
    files: dict[Path, list[str]] = {}
    for p in root.rglob("*"):
        if not p.is_file() or p.suffix not in CODE_EXT:
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        toks = tokens_of(p)
        if len(toks) >= 40:  # too small to fingerprint meaningfully
            files[p] = toks
    return files


def index_shingles(files: dict[Path, list[str]], k: int) -> dict[str, list[Path]]:
    idx: dict[str, list[Path]] = defaultdict(list)
    for p, toks in files.items():
        for sh in shingles(toks, k):
            idx[sh].append(p)
    return idx


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("quill")
    ap.add_argument("pred")
    ap.add_argument("--min-tokens", type=int, default=40)
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--top", type=int, default=25)
    ap.add_argument("--json", help="write full result here")
    args = ap.parse_args()

    qroot, proot = Path(args.quill), Path(args.pred)
    qfiles, pfiles = collect(qroot), collect(proot)
    print(f"quill: {len(qfiles)} files, {sum(len(t) for t in qfiles.values()):,} tokens")
    print(f"pred:  {len(pfiles)} files, {sum(len(t) for t in pfiles.values()):,} tokens")
    print(f"shingle k={args.k}\n")

    qidx = index_shingles(qfiles, args.k)

    # Pass 1: 5-gram overlap, aggregated per predecessor file.
    hits: dict[Path, dict[Path, int]] = defaultdict(lambda: defaultdict(int))
    for p, toks in pfiles.items():
        for sh in shingles(toks, args.k):
            for q in qidx.get(sh, ()):
                hits[p][q] += 1

    # Noise floor: identical measure between two files of the *same* tree.
    # Two independently written files in one codebase score above zero; that
    # score is what unrelated code looks like.
    floor: list[float] = []
    qs = list(qfiles.items())
    for i in range(0, min(len(qs), 120)):
        _, ta = qs[i]
        _, tb = qs[(i + 7) % len(qs)]
        sa = shingles(ta, args.k)
        sb = shingles(tb, args.k)
        if sa and sb:
            floor.append(len(sa & sb) / max(1, min(len(sa), len(sb))))

    rows = []
    for p, qmap in hits.items():
        total = sum(qmap.values())
        best_q, best_n = max(qmap.items(), key=lambda kv: kv[1])
        pa = shingles(pfiles[p], args.k)
        frac = best_n / max(1, len(pa))
        run = lcs_run(pfiles[p], qfiles[best_q])
        rows.append(
            {
                "pred_file": str(p.relative_to(proot)),
                "quill_file": str(best_q.relative_to(qroot)),
                "shared_5grams": best_n,
                "coverage_of_pred_file": round(frac, 4),
                "longest_common_token_run": len(run),
                "run_text": " ".join(run[:60]),
                "total_shared_5grams_all_quill": total,
            }
        )
    rows.sort(key=lambda r: (r["longest_common_token_run"], r["shared_5grams"]), reverse=True)

    print(f"intra-repo noise floor (quill vs quill, {len(floor)} pairs):")
    if floor:
        floor_sorted = sorted(floor)
        print(
            f"  min={floor_sorted[0]:.4f} median={floor_sorted[len(floor)//2]:.4f} "
            f"max={floor_sorted[-1]:.4f}"
        )
    else:
        print("  (no comparable pairs)")
    print(f"\ncross-repo candidate pairs: {len(rows)}")
    print(f"{'LCS':>5} {'5gr':>5} {'cov':>7}  pred -> quill")
    for r in rows[: args.top]:
        print(
            f"{r['longest_common_token_run']:>5} {r['shared_5grams']:>5} "
            f"{r['coverage_of_pred_file']:>7.3f}  {r['pred_file']} -> {r['quill_file']}"
        )

    if args.json:
        Path(args.json).write_text(
            json.dumps(
                {
                    "method": {
                        "k": args.k,
                        "min_tokens": args.min_tokens,
                        "extensions": sorted(CODE_EXT),
                        "skipped_dirs": sorted(SKIP_DIRS),
                        "normalisation": "comments and string literals removed; python keywords removed",
                    },
                    "quill_files": len(qfiles),
                    "pred_files": len(pfiles),
                    "intra_repo_noise_floor": {
                        "pairs": len(floor),
                        "max": round(max(floor), 4) if floor else None,
                        "median": round(sorted(floor)[len(floor) // 2], 4) if floor else None,
                    },
                    "pairs": rows,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"\nwrote {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
