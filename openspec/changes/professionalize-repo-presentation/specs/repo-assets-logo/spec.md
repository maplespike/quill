## ADDED Requirements

### Requirement: Canonical logo assets

The repository SHALL include a canonical `assets/logo/` directory containing the project logo as an SVG source file.

#### Scenario: Logo SVG exists

- **WHEN** a contributor looks for the project logo
- **THEN** `assets/logo/logo.svg` SHALL exist and SHALL render the project's mark

#### Scenario: PNG renders for verification

- **WHEN** the logo is changed or added
- **THEN** a PNG render SHALL be produced from the SVG (e.g. `assets/logo/logo.png`) to verify the SVG renders correctly
