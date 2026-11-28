## ADDED Requirements

### Requirement: Authenticated activity gauges
The API and hosted MCP services SHALL expose distinct-caller gauges that count each caller at most once inside a bounded rolling window, using aggregate series with no customer-controlled labels.

#### Scenario: An authenticated API tenant makes repeated requests
- **WHEN** the same authenticated tenant makes several requests inside the five-minute window
- **THEN** `quill_api_active_tenants` SHALL count that tenant once
- **AND** `quill_api_active_tenants_by_tier` SHALL report the tenant under its normalized billing tier

#### Scenario: An anonymous API request is made
- **WHEN** an unauthenticated request reaches the API handler
- **THEN** the synthetic `anon` tenant SHALL NOT be counted as an active tenant

#### Scenario: A hosted MCP message is handled
- **WHEN** the same hosted identity sends several JSON-RPC messages inside the five-minute window
- **THEN** `quill_mcp_active_identities` SHALL count that identity once
- **AND** a self-hosted stdio identity SHALL NOT be counted

#### Scenario: The caller set exceeds the bound
- **WHEN** more than 4096 distinct callers are observed inside the window
- **THEN** the service SHALL evict the oldest observed caller rather than growing the set without limit

#### Scenario: The window expires
- **WHEN** a caller has not been observed for longer than five minutes and metrics are rendered
- **THEN** that caller SHALL no longer contribute to the active gauge

### Requirement: Billing pressure counters
The hosted MCP service SHALL expose cumulative counters for quota denials and x402 payment attempts on the private metrics listener.

#### Scenario: A quota denial occurs
- **WHEN** a tool call is rejected by the free-quota preflight gate
- **THEN** `quill_mcp_quota_hits_total` SHALL increment exactly once

#### Scenario: A payment attempt is presented
- **WHEN** a tool call carries a parsed x402 payment proof while x402 is enabled
- **THEN** `quill_mcp_payment_hits_total` SHALL increment exactly once

#### Scenario: No billing event has occurred
- **WHEN** the MCP metrics listener renders before any quota denial or payment attempt
- **THEN** both counters SHALL be present with value zero

### Requirement: Caller privacy in activity metrics
The new gauges and counters SHALL NOT render raw identifiers, hashed identifiers, tokens, or customer-controlled label values.

#### Scenario: Metrics are scraped after sensitive inputs
- **WHEN** requests or tool calls contained tenant IDs, API keys, hashed identities, session labels, arguments, or query text
- **THEN** none of those values SHALL appear in the Prometheus exposition
- **AND** the only string label SHALL be the allowlisted `tier` value `free`, `pro`, `business`, `enterprise`, `internal`, or `other`
