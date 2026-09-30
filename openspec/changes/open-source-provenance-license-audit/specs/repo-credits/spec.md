## MODIFIED Requirements

### Requirement: Credits attribution table

The repository SHALL include a `CREDITS.md` file that records attribution for underlying technologies and repositories that informed the project. License claims SHALL distinguish declared package metadata from independently verified license text and SHALL not imply that a credit table is a complete dependency inventory.

#### Scenario: Credits and audit scope are clear

- **WHEN** a reader opens `CREDITS.md`
- **THEN** it SHALL link to the current software license/provenance audit and describe what the credits list does and does not establish

### Requirement: Pattern inspiration credit

When Quill references or is inspired by another repository, the credits SHALL identify the relationship and state whether direct code reuse was confirmed, not found within a defined audit, or remains unreviewed. Lack of a match in a heuristic scan SHALL NOT be stated as proof of no copying.

#### Scenario: Candidate source review

- **WHEN** a repository is identified as a likely precursor or source
- **THEN** the audit SHALL record the reviewed repository/revision, files or areas compared, method, results, license evidence, and limitations

### Requirement: License conflict reporting

The repository SHALL compare root/package license documents, package manifest license fields, and file-level SPDX declarations. It SHALL report conflicts and missing declarations without automatically changing licensing terms.

#### Scenario: Conflicting declarations

- **WHEN** package metadata, package license text, and/or source SPDX declarations disagree
- **THEN** the audit SHALL list each conflict with paths and SHALL mark the intended legal treatment unresolved until an authorized owner decision is recorded

### Requirement: Resolved dependency inventory

The repository SHALL provide a deterministic inventory of resolved third-party JavaScript dependencies and raw declared license expressions, generated from the committed lockfile and locally available metadata without installing or updating packages.

#### Scenario: Unknown license metadata

- **WHEN** a dependency's license metadata is missing or cannot be resolved locally
- **THEN** the inventory SHALL retain the package/version and classify the license as unknown rather than infer permission

#### Scenario: Inventory scope is explicit

- **WHEN** a reader reviews the inventory
- **THEN** it SHALL distinguish dependency inventory from a final package-specific distribution SBOM/NOTICE and state whether dev dependencies are included
