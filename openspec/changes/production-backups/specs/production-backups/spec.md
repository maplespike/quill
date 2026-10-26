## ADDED Requirements

### Requirement: SQLite is copied daily onto durable storage

When `backups.enabled` is true and `QUILL_STORAGE` is `sqlite`, the chart MUST render a CronJob that writes a consistent copy of `/data/quill/maplespike.db` onto the backup claim. The copy MUST use SQLite's online backup path. The CronJob MUST delete copies older than the configured retention.

#### Scenario: Production values render the SQLite job

- **WHEN** the chart is rendered with `charts/quill/values-prod.yaml`
- **THEN** a CronJob named `quill-backup-sqlite` runs at 01:15 UTC and mounts PVC `quill-backups`

### Requirement: The search index uses a storage class that survives the node

The search Deployment MUST mount a PersistentVolumeClaim that sets `storageClassName`. In production that class MUST be `longhorn`. The legacy claim MUST stay in the chart so a sync does not delete it before the copy.

#### Scenario: Production search claim is Longhorn

- **WHEN** the chart is rendered with `charts/quill/values-prod.yaml`
- **THEN** PVC `quill-search-data` requests storage class `longhorn` and the search Deployment mounts that claim

### Requirement: A scratch restore checks row counts

The repo MUST ship `scripts/restore-drill.sh`. `--local` MUST back up a scratch database, restore it, and check row counts without a cluster. The chart MUST render a drill CronJob that restores the newest backup into an emptyDir and fails when the counts do not match.

#### Scenario: Local drill passes

- **WHEN** `bash scripts/restore-drill.sh --local` runs
- **THEN** the process exits 0 and reports the restored table count and the search doc count

### Requirement: Stale backups fail a check

The chart MUST render a freshness CronJob. The Job MUST fail when a required backup is missing or older than `backups.maxAgeHours`.

#### Scenario: An old file is stale

- **WHEN** the newest backup file is older than the configured maximum age
- **THEN** the freshness check reports that store as stale and exits non-zero

### Requirement: Backup pods share the API node

The backup claim MUST default to `ReadWriteOnce`. `ReadWriteMany` MUST remain a values override. When the API storage pin is set, the SQLite, search, freshness, and drill CronJobs MUST set `nodeName` to that pin. While `search.migrateLegacyIndex` is true, the search pod MUST set `nodeName` to `nexus` and the copy init container MUST use `redis.image` with the Redis pull policy.

#### Scenario: Production pins the jobs and the search copy

- **WHEN** the chart is rendered with `charts/quill/values-prod.yaml`
- **THEN** PVC `quill-backups` requests `ReadWriteOnce`
- **AND** CronJobs `quill-backup-sqlite`, `quill-backup-search`, `quill-backup-freshness`, and `quill-backup-drill` set `nodeName: nexus`
- **AND** the search Deployment sets `nodeName: nexus`
- **AND** init container `migrate-legacy-index` uses image `public.ecr.aws/docker/library/redis:8.2.3-alpine` and `imagePullPolicy: IfNotPresent`

### Requirement: Rebuildable cache is not treated as a database

The Redis volume MUST stay an emptyDir. The chart MUST NOT render a Redis backup CronJob.

#### Scenario: Redis stays ephemeral

- **WHEN** the chart is rendered with production values
- **THEN** the Redis pod spec still uses `emptyDir` and no CronJob name contains `backup-redis`
