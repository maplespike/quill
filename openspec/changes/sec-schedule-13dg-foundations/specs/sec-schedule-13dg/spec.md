# sec-schedule-13dg Specification

## ADDED Requirements

### Requirement: Disabled by default

Quill by Maplespike MUST keep Schedule 13D/G live ingestion unimplemented. The kill switch MUST start engaged and MUST block synthetic ingest and serving. No environment variable MUST enable live ingestion.

#### Scenario: Default runtime

- **WHEN** a caller creates a runtime and does not pass an override
- **THEN** the kill switch is engaged, live ingest throws, and serve returns no records

#### Scenario: Synthetic unlock

- **WHEN** a caller unlocks synthetic evaluation
- **THEN** live ingest still throws, every enablement gate stays unapproved, and future enablement stays uncleared

#### Scenario: Environment flag

- **WHEN** a process environment variable names this source as enabled
- **THEN** a new runtime still starts with the kill switch engaged and live ingest still throws

### Requirement: Whole-filing eligibility

The foundation MUST reject a filing as a whole when any reporting person is an individual, the group is mixed, or a type code is missing, unknown, or unparseable. Every reporting entity MUST have an explicit reviewed-eligible record with personal-vehicle risk reviewed absent. A type code MUST NOT prove eligibility. A 13F-manager flag MUST NOT prove eligibility. Unknown, missing, or ambiguous eligibility MUST fail closed.

#### Scenario: Entity type without a review

- **WHEN** every reporting person has an entity type code and no reviewed eligibility record
- **THEN** the filing is rejected and no filer row is returned

#### Scenario: Individual or mixed group

- **WHEN** any reporting person is an individual, including when another person is an entity and a review record is present
- **THEN** the whole filing is rejected and the result has no person name, person identifier, or raw body

### Requirement: Identity, dates, and amendments

The foundation MUST key a record by issuer CIK plus the class title as filed. It MUST NOT collapse two class titles. It MUST keep the event date as reported distinct from the filed date and from fetch metadata. A duplicate accession with the same canonical fields MUST NOT create a second record. A conflicting payload for the same accession MUST NOT overwrite the stored payload. An amendment MUST NOT be marked as a sale. A reported zero holding MUST NOT be marked as a sale. Percentages MUST NOT be summed across filers. Absence MUST NOT be reported as zero.

#### Scenario: Ambiguous class

- **WHEN** one filing carries two different class titles
- **THEN** the filing is rejected and the classes are not merged

#### Scenario: Amendment at zero

- **WHEN** a later synthetic accession reports a zero holding
- **THEN** the record is an amendment, `isSale` is false, and no trade is inferred

### Requirement: Retention and scrubbing

Sanitized operational logs MUST store only the time, a reason code, and the source id, and MUST be deleted at the 7-day boundary. Entity metadata retention for 365 days MUST run only when future enablement is cleared. That clearance MUST default to false, and an uncleared store MUST be emptied. A correction, withdrawal, stale mark, or kill-switch engagement MUST tombstone the record and delete the payload from the in-memory store and from any attached stand-in. The foundation MUST NOT claim deletion coverage for a store it does not have.

#### Scenario: Log boundary

- **WHEN** a log row reaches exactly 7 days of age
- **THEN** the runtime deletes that row

#### Scenario: No secondary store

- **WHEN** a runtime is created without a store list
- **THEN** its secondary-store list is empty and a later enrollment is refused

#### Scenario: Uncleared persistence

- **WHEN** synthetic evaluation is unlocked and retention is not the explicit synthetic contract
- **THEN** an admitted filing is not written to the record map or to a secondary store

### Requirement: Access budget

The access contract MUST refuse a zero budget before calling a transport. It MUST bound retries for HTTP 403 and HTTP 429. It MUST NOT open a socket by itself. The access gate and the language gate MUST stay unapproved.

#### Scenario: Zero budget

- **WHEN** the request budget is zero
- **THEN** the transport is not called and the outcome is refused
