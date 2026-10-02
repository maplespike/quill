## MODIFIED Requirements

### Requirement: Credits attribution table

The repository SHALL include a `CREDITS.md` file that records attribution for underlying technologies and repositories that informed the project. Each entry SHALL carry the credited project, its license as observed, and the date or revision referenced, together with the relationship to Quill and the evidence for any provenance claim. License claims SHALL distinguish declared package metadata from independently verified license text and SHALL not imply that a credit table is a complete dependency inventory.

`CREDITS.md` SHALL also state how its license claims were verified, and SHALL mark as unverified any entry whose license text could not be read at the cited revision.

#### Scenario: CREDITS.md exists with attribution table

- **WHEN** a reader opens `CREDITS.md`
- **THEN** the file SHALL contain a table listing each credited project or technology, its license, and the date or version referenced

#### Scenario: License verification method documented

- **WHEN** a project or technology is credited
- **THEN** the entry SHALL note that license information was verified by fetching the project's LICENSE file (not the GitHub API metadata) and the method SHALL be documented in the file

#### Scenario: Credits and audit scope are clear

- **WHEN** a reader opens `CREDITS.md`
- **THEN** it SHALL link to the current software license/provenance audit and describe what the credits list does and does not establish

## ADDED Requirements

### Requirement: Pattern inspiration credit

When Quill references or is inspired by another repository, the credits SHALL identify the relationship and state whether direct code reuse was confirmed, not found within a defined audit, or remains unreviewed. Lack of a match in a heuristic scan SHALL NOT be stated as proof of no copying. Any comparison SHALL record the scope it actually covered, and a negative result SHALL be stated as bounded by that scope rather than as an absence of copying.

#### Scenario: Candidate source review

- **WHEN** a repository is identified as a likely precursor or source
- **THEN** the audit SHALL record the reviewed repository/revision, files or areas compared, method, results, license evidence, and limitations

#### Scenario: Negative result is bounded by method

- **WHEN** a similarity comparison finds no substantial overlap
- **THEN** the recorded conclusion SHALL name the revisions compared and the detection method used, and SHALL NOT assert that no code was copied

### Requirement: License conflict reporting

The repository SHALL compare root/package license documents, package manifest license fields, and file-level SPDX declarations. It SHALL report conflicts and missing declarations without automatically changing licensing terms.

#### Scenario: Conflicting declarations

- **WHEN** package metadata, package license text, and/or source SPDX declarations disagree
- **THEN** the audit SHALL list each conflict with paths and SHALL mark the intended legal treatment unresolved until an authorized owner decision is recorded

#### Scenario: Absent metadata is not inferred

- **WHEN** a workspace package declares no license field
- **THEN** the audit SHALL report the field as absent and SHALL NOT infer a license from a sibling package, a directory name, or a neighbouring policy

### Requirement: Resolved dependency inventory

The repository SHALL provide a deterministic inventory of resolved third-party JavaScript dependencies and raw declared license expressions, generated from the committed lockfile and locally available metadata without installing or updating packages.

#### Scenario: Unknown license metadata

- **WHEN** a dependency's license metadata is missing or cannot be resolved locally
- **THEN** the inventory SHALL retain the package/version and classify the license as unknown rather than infer permission

#### Scenario: Inventory scope is explicit

- **WHEN** a reader reviews the inventory
- **THEN** it SHALL distinguish dependency inventory from a final package-specific distribution SBOM/NOTICE and state whether dev dependencies are included

### Requirement: Image-level enumeration

A release control SHALL enumerate the contents of each shipped container image, and the enumeration SHALL record the image digest so the inventory provably describes the artifact that was scanned. An enumeration that comes back empty SHALL fail the control rather than be recorded as a successful scan.

#### Scenario: Image contents are enumerated before release

- **WHEN** an image is built for release
- **THEN** an SPDX document SHALL be produced for it, carrying the image digest, before the image is made available to the cluster

#### Scenario: Empty enumeration is refused

- **WHEN** the enumeration tool exits successfully having recorded no packages
- **THEN** the control SHALL fail and SHALL NOT leave behind a file that a reviewer could mistake for a completed scan
