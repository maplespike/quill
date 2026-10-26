## ADDED Requirements

### Requirement: Live integration tests skip an HTML error page

A live integration test MUST skip when the upstream answers with a success status and an HTML document. The skip message MUST name the host and the status. The test MUST NOT skip when the success body is JSON, including JSON that a server labels `text/html`. The test MUST NOT skip an RSS or other XML feed.

#### Scenario: Portal returns HTTP 200 and an HTML error page

- **WHEN** the live call returns status 200, `Content-Type: text/html`, and a body that starts with `<!DOCTYPE html`
- **THEN** the test skips
- **AND** the skip reason names the host and says the response is an HTML document

#### Scenario: Portal returns JSON labelled as HTML

- **WHEN** the live call returns status 200, `Content-Type: text/html`, and a body that starts with `{`
- **THEN** the test does not skip because of the content type

#### Scenario: Gazette returns RSS

- **WHEN** the live call returns status 200, `Content-Type: application/xml`, and a body whose root is `<rss`
- **THEN** the test does not skip because of the body type

### Requirement: A contract break still fails the suite

A live integration test MUST fail when the upstream returns a 4xx status. A live integration test MUST fail when a 2xx body is not an HTML document and is not valid JSON. A JSON parse error that is not caused by an HTML body MUST fail the test.

#### Scenario: Endpoint answers 404 with an HTML page

- **WHEN** the live call returns status 404 and an HTML body
- **THEN** the test does not skip

#### Scenario: Endpoint answers 200 with truncated JSON

- **WHEN** the live call returns status 200, `Content-Type: application/json`, and a body `{not json`
- **THEN** the test does not skip

#### Scenario: Tool parser rejects truncated JSON

- **WHEN** a live tool throws `Unexpected token n in JSON at position 1`
- **THEN** the test does not skip as an HTML parse error

### Requirement: The integration-test job gates the workflow

The `integration-test` job in `.github/workflows/ci.yml` MUST NOT set `continue-on-error`. The `build-and-test` steps that run the api-server and quill-mcp integration suites MUST NOT set `continue-on-error`.

#### Scenario: Workflow file is checked

- **WHEN** the upstream-outage unit test reads `.github/workflows/ci.yml`
- **THEN** the `integration-test` job contains no `continue-on-error` key
- **AND** the api-server and quill-mcp integration steps contain no `continue-on-error` key
