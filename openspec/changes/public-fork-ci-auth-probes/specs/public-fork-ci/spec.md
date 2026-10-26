## ADDED Requirements

### Requirement: Fork pull requests stay off self-hosted runners
A workflow MUST NOT use `on: pull_request`. A job that runs for a fork MUST use a GitHub-hosted runner, MUST NOT reference repository secrets, and MUST NOT receive a write token.

#### Scenario: Fork pull request
- **Given** the pull request head repository is not this repository
- **When** a code job is scheduled
- **Then** `runs-on` is `ubuntu-latest`
- **And** the job does not read `secrets`

#### Scenario: Same-repository pull request
- **Given** the pull request head repository is this repository
- **When** a code job is scheduled
- **Then** the job uses the self-hosted runner labels

### Requirement: workflow_run does not build fork code on the cluster
A self-hosted `workflow_run` job MUST require `head_repository.full_name == github.repository` and MUST NOT check out the triggering head SHA.

#### Scenario: Fork workflow run
- **Given** a completed workflow run whose head repository is a fork
- **When** CI Doctor is evaluated
- **Then** the job is skipped
