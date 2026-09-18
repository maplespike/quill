## ADDED Requirements

### Requirement: Public operation rate card

The API SHALL publish a public rate card of operation cost weights, generated from the `operations` block of `plans.json`, and the pricing surfaces SHALL render the same weights.

#### Scenario: Rate card is public and generated

- **WHEN** any client requests `GET /v1/pricing/operations`
- **THEN** the response SHALL be HTTP 200 with the operation ids, labels, and weights, and the values SHALL match `plans.json` exactly

#### Scenario: Default weight

- **WHEN** an operation has no explicit weight in the `operations` block
- **THEN** its cost SHALL be 1 call

### Requirement: Pre-run cost estimate

The API SHALL expose `POST /v1/pricing/estimate`, mapping `{operation, params}` to an estimated call cost with no side effects.

#### Scenario: Estimate for a known operation

- **WHEN** a client posts a valid operation id
- **THEN** the response SHALL return the operation's call weight and SHALL NOT increment any usage counter (negative control: metering unchanged after the call)

#### Scenario: Unknown operation rejected

- **WHEN** a client posts an unknown operation id
- **THEN** the API SHALL return HTTP 400 and SHALL NOT guess a weight

### Requirement: Per-response cost echo

Responses for operations with weight greater than 1 SHALL include a `meta.cost` field reporting the calls charged, so agents can observe the price paid.

#### Scenario: Expensive operation echoes cost

- **WHEN** an operation with weight greater than 1 completes
- **THEN** its response envelope SHALL include `meta.cost` equal to the operation's weight

#### Scenario: Default operation stays quiet

- **WHEN** an operation with weight 1 completes
- **THEN** the response MAY omit `meta.cost` and SHALL remain byte-compatible with current clients

### Requirement: Estimate honesty under reweighting

Weights SHALL be advisory pricing language: changing a weight SHALL require updating the rate card in the same change, and SHALL NOT silently alter metering behavior.

#### Scenario: Weight change is atomic

- **WHEN** an operation's weight changes in `plans.json`
- **THEN** the rate card, estimate endpoint, and cost echo SHALL all reflect the new weight in the same deployment
