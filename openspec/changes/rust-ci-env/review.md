## Pre-implementation Review

- The helper does not curl, rustup, or write outside the process environment.
- Every self-hosted job in this workflow has the same-repo `if`.
- A comment must not contain `runs-on: [self-hosted`, or a later edit can turn that text into a top-level `if`.
- #1045 is merged. This slice keeps the Rust job guard and does not copy #1045's other workflow edits.
- No fork code runs on the pool.

## Verdict

Proceed. Do not add a job-local toolchain installer.
