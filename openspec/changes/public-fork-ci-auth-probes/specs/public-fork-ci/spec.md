## ADDED Requirements

### Requirement: Fork pull requests stay off self-hosted runners
A code workflow MUST use `on: pull_request`. A job that runs for a fork MUST resolve `runs-on` to a GitHub-hosted runner. A same-repo pull request and a push MUST stay on the self-hosted labels. A workflow MUST NOT use `pull_request_target` and check out the pull request head.

#### Scenario: Fork pull request
- **Given** the pull request head repository is not this repository
- **When** a code job is scheduled
- **Then** `runs-on` resolves to `ubuntu-latest`

#### Scenario: Same-repository pull request
- **Given** the pull request head repository is this repository
- **When** a code job is scheduled
- **Then** the job uses the self-hosted runner labels

#### Scenario: Push
- **Given** a push to this repository
- **When** a code job is scheduled
- **Then** the job uses the self-hosted runner labels

#### Scenario: Pull request target checkout
- **Given** a workflow uses `pull_request_target`
- **When** a job checks out the pull request head SHA
- **Then** the fork-runner policy gate fails

### Requirement: workflow_run does not build fork code on the cluster
A self-hosted `workflow_run` job MUST require `head_repository.full_name == github.repository` and MUST NOT check out the triggering head SHA.

#### Scenario: Fork workflow run
- **Given** a completed workflow run whose head repository is a fork
- **When** CI Doctor is evaluated
- **Then** the job is skipped
