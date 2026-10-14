## ADDED Requirements

### Requirement: Standard endpoint framing
The server MUST announce a same-origin relative message URI as plain text in its first endpoint event.

#### Scenario: Client discovers message URI
- **Given** an authenticated SSE stream
- **When** the client reads the endpoint event
- **Then** its data is an unquoted `/messages?clientId=<UUID>` URI
- **And** the client can initialize and enumerate the registered tools through that URI

### Requirement: Owner-bound command delivery
The server MUST bind message posts and quota identity to the authenticated stream owner.

#### Scenario: Another credential attempts delivery
- **Given** a stream opened with a valid Bearer credential
- **When** a POST has no credential or a different credential
- **Then** the POST returns 401 and the original stream stays open

#### Scenario: Owner calls a tool
- **Given** an authenticated stream
- **When** the owner posts a read-only catalog call with the same credential
- **Then** the result arrives as a JSON-RPC message event using the captured quota identity

### Requirement: Credential revalidation
The server MUST authenticate the stream owner again on every message post and MUST drop the stream when that check fails.

#### Scenario: Owner credential is revoked
- **Given** a stream opened with a tenant key the API accepts
- **When** the API later rejects that key and the owner posts a command
- **Then** the POST returns 401
- **And** a later POST for that session returns 404

### Requirement: Session limits
The server MUST bound concurrent streams, command idle time, and per-session write buffers, and MUST remove a session when its client disconnects.

#### Scenario: Connection cap
- **Given** the session cap is full
- **When** another client opens `/sse`
- **Then** the request returns 503

#### Scenario: Idle expiry
- **Given** an open stream and no later command
- **When** the idle limit elapses
- **Then** the stream ends

#### Scenario: Disconnect
- **Given** a client aborts its SSE stream
- **When** a command is posted for that session
- **Then** the POST returns 404

### Requirement: Body limit
The server MUST reject a message body larger than 1 MiB and MUST NOT run that command.

#### Scenario: Oversize body
- **Given** an authenticated stream
- **When** the owner posts a body larger than 1 MiB
- **Then** the POST returns 413
- **And** a later normal command on the same session is accepted

### Requirement: Session output isolation
The server MUST write a command result only to the session that posted the command.

#### Scenario: Two open sessions
- **Given** two authenticated streams
- **When** one session posts `tools/list`
- **Then** the result is not written to the other stream

### Requirement: Graceful shutdown
The server MUST close active streams and flush quota on termination.

#### Scenario: Terminate with an open stream
- **Given** a connected SSE client
- **When** the server receives SIGTERM
- **Then** the stream ends and the server exits successfully
