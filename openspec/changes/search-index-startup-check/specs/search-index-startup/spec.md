## ADDED Requirements

### Requirement: Serve refuses an unusable index

`quill-search serve` MUST check the index directory before it binds a port. The process MUST exit non-zero, MUST NOT listen, and MUST print `refusing to serve` when the directory is missing, when `quill-meta.json` is missing, or when the sidecar doc count is below the production floor. The floor MUST be greater than the 30-doc sample corpus unless the operator sets the floor to 0.

#### Scenario: Sample-sized index

- **WHEN** the index sidecar reports 30 docs and the floor is the default
- **THEN** the process exits non-zero
- **AND** the message contains `refusing to serve` and `undersized`

#### Scenario: Missing sidecar

- **WHEN** the directory contains a tantivy index and does not contain `quill-meta.json`
- **THEN** the process exits non-zero
- **AND** the message names `quill-meta.json`

### Requirement: A corpus rebuild writes the sidecar

When serve is given a corpus and the current index is unusable, the process MUST rebuild the directory from that corpus before it listens. The rebuild MUST write `quill-meta.json`. The process MUST still refuse to listen when the rebuilt doc count is below the floor.

#### Scenario: Rebuild a missing directory

- **WHEN** the index directory does not exist and a corpus of 3 documents is supplied with a floor of 1
- **THEN** the directory contains `quill-meta.json` with `docs` equal to 3
- **AND** startup reports a rebuild

### Requirement: Same-namespace pods can reach search on 8083

`quill-allow-intra-namespace` MUST allow TCP ingress on port 8083 from pods in the namespace, in the same port list as the other in-namespace services. The cluster-service egress rule MUST allow TCP 8083 on the service CIDR. The public edge policy MUST NOT allow port 8083.

#### Scenario: Rendered production policies

- **WHEN** the chart is rendered with `charts/quill/values-prod.yaml`
- **THEN** NetworkPolicy documents contain `port: 8083` exactly twice
- **AND** `quill-allow-edge-ingress` does not list port 8083

### Requirement: The backup script explains a missing sidecar

`charts/quill/files/search-backup.sh` MUST exit non-zero when `quill-meta.json` is missing. The message MUST say that no archive was written and MUST name `docs/runbooks/search-reindex.md`. The script MUST NOT create an archive in that case.

#### Scenario: Sidecar absent

- **WHEN** the index directory has no `quill-meta.json`
- **THEN** the script exits non-zero
- **AND** stderr contains `refused to archive` and `docs/runbooks/search-reindex.md`
- **AND** the destination has no archive
