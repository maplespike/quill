## ADDED Requirements

### Requirement: Root-level llms.txt file

The repository SHALL include an `llms.txt` file at the repository root, following the llmstxt.org convention, that describes the project to LLM crawlers and agents.

#### Scenario: LLM crawler reads root llms.txt

- **WHEN** a client requests `https://github.com/reverb256/quill/raw/main/llms.txt` or reads the repository root file
- **THEN** the file SHALL contain a project summary, a one-line description, and a structured list of key documentation and resource links (README, docs, API endpoints)

#### Scenario: llms.txt format

- **WHEN** the root `llms.txt` is read
- **THEN** its first line SHALL be the project name (H1), the second line SHALL be a one-line description, and subsequent lines SHALL be markdown links with brief descriptions

### Requirement: Root-level llms-full.txt file

The repository SHALL include an `llms-full.txt` file at the repository root that is a fuller, self-contained LLM-readable project card.

#### Scenario: llms-full.txt exists

- **WHEN** a client reads the repository root `llms-full.txt`
- **THEN** the file SHALL exist and SHALL contain a more complete project description than `llms.txt`, including architecture, package list, and usage notes

### Requirement: Code of Conduct

The repository SHALL include a `CODE_OF_CONDUCT.md` file adopting a recognized community standard code of conduct.

#### Scenario: Code of Conduct file exists

- **WHEN** a contributor or reviewer opens `CODE_OF_CONDUCT.md`
- **THEN** the file SHALL reference the Contributor Covenant version 2.1 and provide a link to the full text and the project's reporting contact

#### Scenario: Code of Conduct is link-first

- **WHEN** the file is created
- **THEN** it SHALL link to the official Contributor Covenant text rather than embedding the full license text in the repo
