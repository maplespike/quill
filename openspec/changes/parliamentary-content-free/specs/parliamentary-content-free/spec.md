# Parliamentary content free

## Requirements

### Requirement: Parliamentary tools and routes are free

House of Commons and Senate committee, debate, Hansard, and vote tools, including the openparliament tools, MUST be free. They MUST NOT require a Pro or other paid plan, and they MUST NOT increment paid-plan usage quotas.

#### Scenario: Tool price is zero

- GIVEN a parliamentary tool name
- WHEN the price is resolved
- THEN the tier is free and the price is zero

#### Scenario: Export route is free

- GIVEN a free tenant
- WHEN the tenant calls `/v1/export/committees` or `/v1/export/parliamentary-voting`
- THEN the free-tier gate allows the call
- AND the call does not increment the paid-plan usage counter

### Requirement: Public parliamentary responses carry attribution and a short excerpt

Every parliamentary response MUST include the source link (`ourcommons.ca` or `sencanada.ca`) and the line "Reproduced for non-commercial use. This is not an official version and does not imply endorsement." Public excerpts MUST be 300 characters or fewer.

#### Scenario: Excerpt cap

- GIVEN a parliamentary field longer than 300 characters
- WHEN the response is shaped by the shared helper
- THEN the field is at most 300 characters
- AND the response includes the reuse line and a house link
