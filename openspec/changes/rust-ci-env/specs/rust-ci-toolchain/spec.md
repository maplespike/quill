## ADDED Requirements

### Requirement: Fail-closed toolchain lookup
Rust CI MUST resolve the runner's existing cargo and MUST fail when cargo is missing.

#### Scenario: Cargo is on the runner
- **Given** cargo is installed for the runner user
- **When** a Rust job starts
- **Then** the preflight prints cargo and rustc versions
- **And** the job runs the existing cargo command

#### Scenario: Cargo is missing
- **Given** the runner user has no cargo
- **When** a Rust job starts
- **Then** the preflight exits non-zero
- **And** the job does not download a toolchain

### Requirement: Forks stay off the self-hosted pool
A pull request from a fork MUST NOT run `rust-fmt`, `rust-clippy`, or `rust-test`.

#### Scenario: Fork pull request
- **Given** the pull request head repository is not this repository
- **When** Rust CI is evaluated
- **Then** the three self-hosted jobs are skipped

#### Scenario: Same-repository pull request
- **Given** the pull request head repository is this repository
- **When** Rust CI is evaluated
- **Then** the three jobs are eligible to run
