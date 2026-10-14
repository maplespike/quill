#!/usr/bin/env bash
# Source from CI before cargo commands. Do not install or change host tooling.
export PATH="${HOME}/.cargo/bin:/usr/local/bin:/usr/bin:/run/current-system/sw/bin:${PATH}"
if ! command -v cargo >/dev/null 2>&1; then
  printf '%s\n' 'Rust CI runner is missing cargo. Provision the repository Rust toolchain for the runner user.' >&2
  return 1 2>/dev/null || exit 1
fi
cargo --version
rustc --version
