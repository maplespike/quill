## ADDED Requirements

### Requirement: The Pages deploy verdict is classified, not assumed

The "Deploy Docs to GitHub Pages" workflow SHALL probe
`GET /repos/{repository}/pages` before any Pages deploy step and SHALL
classify the result as `enabled`, `not-enabled`, or `error`. The workflow
SHALL NOT assume either state and SHALL NOT hard-code a disabled deploy.

#### Scenario: Pages site exists

- **GIVEN** a repository with a Pages site
- **WHEN** the workflow runs the probe
- **THEN** the probe SHALL emit `verdict=enabled` and exit 0
- **AND** the deploy steps (`configure-pages`, `upload-pages-artifact`,
  `deploy-pages`) SHALL run

#### Scenario: Pages not enabled under the current plan

- **GIVEN** a private repository on a plan that does not include GitHub
  Pages, so `GET /pages` returns 404
- **WHEN** the workflow runs the probe
- **THEN** the probe SHALL emit `verdict=not-enabled` and exit 3
- **AND** the workflow SHALL skip ONLY the deploy steps, emit a warning
  annotation naming the reason and the enabling steps, and finish green
- **AND** every build step (portal, docs) SHALL still have run

#### Scenario: Probe failure is loud, never a silent skip

- **GIVEN** a probe that exits non-zero without a verdict (crash, missing
  token, missing `gh`, rate limit, 5xx)
- **WHEN** the workflow evaluates the probe result
- **THEN** the job SHALL fail
- **AND** the workflow SHALL NOT treat a missing verdict as `not-enabled`

### Requirement: The gating is regression-pinned

The probe's verdict contract (exit codes, output values, fail-closed
preconditions) and the workflow wiring (probe step with per-run token,
every deploy step gated on the verdict) SHALL be covered by unit tests that
run in CI on every push.

#### Scenario: Gating removed by a refactor

- **GIVEN** a change that un-gates a deploy step or drops the probe step
- **WHEN** CI runs the Pages deploy gating unit tests
- **THEN** the lane SHALL fail
