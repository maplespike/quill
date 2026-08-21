## ADDED Requirements

### Requirement: README header with logo and tagline

The README SHALL open with a centered header containing the logo, project name, and a one-line tagline.

#### Scenario: README header

- **WHEN** a reader opens the README
- **THEN** the first content SHALL be a centered block with the logo image, the project name, and a one-line tagline

### Requirement: README badge row

The README SHALL include a row of shields.io badges in the header block.

#### Scenario: Badges present

- **WHEN** a reader opens the README
- **THEN** the header SHALL include at least the following badges: project status, license, and CI build status, each linking to a real target

#### Scenario: Badges link to real targets

- **WHEN** a badge is clicked
- **THEN** it SHALL navigate to the corresponding real resource (e.g. the CI workflow run page, the license file, the project homepage)
