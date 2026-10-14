## Context

`.github/workflows/rust-ci.yml` uses `runs-on: [self-hosted, nixos]`. #1045 is merged and already puts `if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository` on these jobs. This slice keeps that guard. Downloading rustup in the job would execute remote code on the self-hosted pool. That is rejected. Sentry's runner user now has cargo at `/home/j_kro/.cargo/bin`, which is `$HOME/.cargo/bin` for that user and is on PATH. The helper still fails when cargo is missing.

## Decisions

1. Resolve cargo from `$HOME/.cargo/bin`, `/usr/local/bin`, `/usr/bin`, and `/run/current-system/sw/bin`.
2. Exit non-zero when `cargo` is absent. Do not install or change host tooling.
3. Put the #1045 fork guard on `rust-fmt`, `rust-clippy`, and `rust-test`.
4. Do not move any job onto a broader runner set.

## Rollout

Workflow-only. Rollback restores the previous workflow. Runners that lack cargo keep failing until an operator provisions cargo for the runner user. This change does not do that provisioning.

## Verification

A shell that can see cargo prints `cargo --version` and `rustc --version`. A PATH with no cargo exits 1 and prints the missing-cargo line. Fork pull requests skip the three jobs.
