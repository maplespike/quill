## ADDED Requirements

### Requirement: The export uses an allowlist

The export manifest MUST name the server packages `api-server`, `quill-mcp`, `pipeline-core`, `database`, and `engine`, plus a `sdk-*` package glob, plus the root files required to build that subset. The export MUST drop SEDI sources, `*.disabled` files, secrets, charts, Kubernetes manifests, deploy files, ops files, config, `.github`, the portal, docs, and scripts. A file tagged `oss-export: private-only` MUST be dropped.

#### Scenario: A private test is tagged

- **WHEN** a test reads `charts/`, `.github/workflows`, or a repository-root Dockerfile
- **THEN** the file carries the private-only tag
- **AND** the manifest lists that file

### Requirement: The overlay is standalone

The overlay MUST provide a public README, `CONTRIBUTING.md`, `SECURITY.md`, a grouped `.env.example`, `docker-compose.oss.yml`, `Dockerfile.api`, `Dockerfile.mcp`, and a GitHub-hosted CI workflow. The Dockerfiles MUST NOT copy the whole build context, MUST NOT run the portal audit generator, and MUST NOT copy portal paths. Compose images MUST use `ghcr.io/maplespike/quill-api` and `ghcr.io/maplespike/quill-mcp`. The public workflow MUST use `ubuntu-latest` and MUST NOT select a self-hosted runner.

#### Scenario: Compose describes the public stack

- **WHEN** a reader opens `docker-compose.oss.yml`
- **THEN** the file defines api, mcp, and redis
- **AND** postgres is behind a profile
- **AND** the file does not define a portal service

### Requirement: The export script fails closed and does not publish

`scripts/oss-export.mjs` MUST write a temp tree, apply the overlay and the transforms, regenerate `pnpm-lock.yaml`, and run install, build, and test. It MUST run gitleaks and a forbidden-string scan. The scan MUST include private addresses, tailnet names, internal host words, home paths, project-data paths, the configured identity tokens, and live key prefixes. A `192.168` match in the two SSRF guard files MUST be allowed. Any hit or failed command MUST exit non-zero. The script MUST NOT push.

#### Scenario: Scan-only stops before install

- **WHEN** the operator passes `--scan-only`
- **THEN** the planned phases are materialize and scan
- **AND** install, build, and test are not planned
