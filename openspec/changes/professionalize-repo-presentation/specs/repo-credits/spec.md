## ADDED Requirements

### Requirement: Credits attribution table

The repository SHALL include a `CREDITS.md` file that records attribution for the project's underlying technologies and inspirations.

#### Scenario: CREDITS.md exists with attribution table

- **WHEN** a reader opens `CREDITS.md`
- **THEN** the file SHALL contain a table listing each credited project or technology, its license, and the date or version referenced

#### Scenario: License verification method documented

- **WHEN** a project or technology is credited
- **THEN** the entry SHALL note that license information was verified by fetching the project's LICENSE file (not the GitHub API metadata) and the method SHALL be documented in the file

### Requirement: Research and vision attribution

The repository SHALL record credit for research agents, pattern-inspiration repositories, and the product vision owner.

#### Scenario: Research agent credit

- **WHEN** the project's ideas or architecture were produced with the assistance of a research agent
- **THEN** the agent SHALL be credited in `CREDITS.md` or `docs/VISION.md`

#### Scenario: Pattern inspiration credit

- **WHEN** the project references or is inspired by other repositories
- **THEN** those repositories SHALL be credited with a link and license noted, and any direct code reuse SHALL be explicitly flagged

#### Scenario: Product vision owner

- **WHEN** `CREDITS.md` is read
- **THEN** it SHALL name the product vision owner

### Requirement: No unlicensed code vendoring

The repository SHALL NOT vendor code from repositories without a license.

#### Scenario: No-license repo referenced

- **WHEN** a referenced repository has no license
- **THEN** only the idea or pattern is referenced, and no code from it SHALL be copied into the repository
