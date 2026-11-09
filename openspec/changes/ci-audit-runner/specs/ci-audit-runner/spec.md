## ADDED Requirements

### Requirement: Independent audit runner

The dependency audit SHALL use a GitHub-hosted runner for all supported events without removing its existing checks.

#### Scenario: Audit runs

- **WHEN** the dependency audit is eligible after the build succeeds
- **THEN** it SHALL install the frozen dependency graph, check native bindings, and fail on critical advisories on a GitHub-hosted runner

#### Scenario: Fork pull request

- **WHEN** a fork pull request makes the audit eligible
- **THEN** the audit SHALL not run untrusted code on a self-hosted runner
