## ADDED Requirements

### Requirement: SSE and streamable HTTP require a credential
`GET /sse`, `POST /messages`, and `POST /mcp` MUST reject a missing credential and an invalid credential. They MUST accept a valid API key and a valid API session JWT. `GET /health` MUST stay available without a credential.

#### Scenario: Missing credential
- **Given** the server is not in the dev-key bypass
- **When** a client calls `GET /sse` or `POST /mcp` with no credential
- **Then** the response status is 401

#### Scenario: Invalid credential
- **Given** the presented bearer is not the API key and is not a valid API session JWT
- **When** a client calls `GET /sse` or `POST /mcp`
- **Then** the response status is 401

#### Scenario: Valid API key or JWT
- **Given** the client sends the configured API key or a current HS256 API session JWT
- **When** the client calls `GET /sse` or `POST /mcp`
- **Then** the response status is 200
