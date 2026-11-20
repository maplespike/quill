## ADDED Requirements

### Requirement: Verify delegated Astral credentials

When configured with an Astral Key base URL, Quill MCP SHALL POST the presented token as JSON to `/api/v1/auth/verify` and accept it only on a successful HTTP response with `valid` equal to true. Trailing slashes on the base URL SHALL be supported.

#### Scenario: Access token accepted

- **GIVEN** Astral Key reports a token valid with an HTTP success response
- **WHEN** the token is presented to Quill MCP
- **THEN** delegated Astral verification accepts the token

#### Scenario: Invalid or failed verification

- **GIVEN** Astral Key rejects the token, responds with an HTTP error, returns malformed data, times out, or cannot be reached
- **WHEN** the token is presented to Quill MCP
- **THEN** delegated Astral verification rejects the token without preventing other configured authentication methods from running
