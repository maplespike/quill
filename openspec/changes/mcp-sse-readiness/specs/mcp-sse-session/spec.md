## ADDED Requirements

### Requirement: Standard endpoint framing
The server MUST announce a same-origin relative message URI as plain text in its first endpoint event.

#### Scenario: Client discovers message URI
- **Given** an authenticated SSE stream
- **When** the client reads the endpoint event
- **Then** its data is an unquoted `/messages?clientId=<UUID>` URI
- **And** the client can initialize and enumerate 184 registered tools through that URI

### Requirement: Owner-bound command delivery
The server MUST bind message posts and quota identity to the authenticated stream owner.

#### Scenario: Another credential attempts delivery
- **Given** a stream opened with a valid Bearer credential
- **When** a POST has no credential or a different credential
- **Then** the POST returns 401 and no command runs

#### Scenario: Owner calls a tool
- **Given** an authenticated stream
- **When** the owner posts a read-only catalog call with the same credential
- **Then** the result arrives as a JSON-RPC message event using the captured quota identity

### Requirement: Graceful shutdown
The server MUST close active streams on termination.

#### Scenario: Terminate with an open stream
- **Given** a connected SSE client
- **When** the server receives SIGTERM
- **Then** the stream ends and the server exits successfully without forced termination
