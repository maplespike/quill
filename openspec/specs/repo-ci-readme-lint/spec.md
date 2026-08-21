# repo-ci-readme-lint Specification

## Purpose
TBD - created by archiving change professionalize-repo-presentation. Update Purpose after archive.
## Requirements
### Requirement: README lint CI job

The repository SHALL run a CI job that checks documentation links and markdown formatting.

#### Scenario: Dead link check

- **WHEN** a pull request or push touches `*.md` files
- **THEN** the CI job SHALL run lychee against the documentation and fail if it finds dead links

#### Scenario: Markdown lint check

- **WHEN** a pull request or push touches `*.md` files
- **THEN** the CI job SHALL run markdownlint-cli2 against the documentation and fail on lint errors

#### Scenario: Pinned action versions

- **WHEN** the CI job is defined
- **THEN** all actions SHALL be pinned to specific versions (not `stable` or `latest`)

