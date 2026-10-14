## Why

Rust CI jobs run on self-hosted runners in non-login shells. `cargo` is not guaranteed to be on the default PATH. A missing toolchain must fail the job. Fork pull requests must not run on that pool.

## What Changes

- Source `scripts/ci-rust-env.sh` before `cargo fmt`, Clippy, and tests.
- Prepend the runner user's cargo bin directories and exit when `cargo` is missing.
- Run `rust-fmt`, `rust-clippy`, and `rust-test` only for same-repository events.
- Trigger the workflow when `scripts/ci-rust-env.sh` changes.

## Capabilities

### New Capabilities

- `rust-ci-toolchain`: Fail-closed toolchain lookup and a same-repo guard on self-hosted Rust jobs.

## Impact

Workflow and one shell helper only. No Rust source change and no toolchain install. Related to #1058. #1045 is merged; this slice keeps its same-repo guard on the three Rust jobs. Sentry now has cargo at `/home/j_kro/.cargo/bin` on PATH. The helper resolves `$HOME/.cargo/bin` and keeps the existing PATH. A runner that still has no cargo fails the preflight. That failure is correct.
