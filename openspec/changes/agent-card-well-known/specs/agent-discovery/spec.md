## ADDED Requirements

### Requirement: Agent card at the well-known path
The portal MUST serve the agent card at `/.well-known/agent-card.json`. The file MUST be byte-identical to `/agent-card.json`.

#### Scenario: A2A discovery
- **Given** a built portal `dist/`
- **When** a client requests `/.well-known/agent-card.json`
- **Then** it receives 200 with the agent card
- **And** the bytes equal `/agent-card.json`

#### Scenario: Drift fails the check
- **Given** the two copies differ
- **When** `check-agent-discovery.mjs` runs
- **Then** the check fails and names both paths
