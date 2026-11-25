## ADDED Requirements

### Requirement: Fixture records are synthetic

The API server MUST ship fixture records that are invented. Every record MUST set `synthetic` to true and MUST set `marker` to `FIXTURE`. The records MUST NOT contain real parliamentary or committee content. The fixture module MUST NOT call a live pipeline module.

#### Scenario: A caller reads the fixture list

- **WHEN** `QUILL_FIXTURES=1` and the caller requests `GET /v1/fixtures`
- **THEN** the response says that the route serves synthetic fixtures
- **AND** every record has `synthetic: true` and `marker: "FIXTURE"`

### Requirement: Fixture routes stay off in production

The fixture routes MUST stay off unless `QUILL_FIXTURES` is `1`, `true`, or `yes`. `NODE_ENV=production` MUST NOT enable them by itself. A disabled response MUST NOT include fixture records. A disabled response MUST say that the routes serve synthetic fixtures and how to enable them.

#### Scenario: Production with the flag unset

- **WHEN** `NODE_ENV` is `production` and `QUILL_FIXTURES` is unset
- **THEN** `GET /v1/fixtures` answers 404
- **AND** the body does not include a fixture actor name

#### Scenario: Production with the flag set

- **WHEN** `NODE_ENV` is `production` and `QUILL_FIXTURES=1`
- **THEN** `GET /v1/fixtures` answers 200 and returns the synthetic records
