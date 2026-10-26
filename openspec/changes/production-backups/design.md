## Context

Production (`charts/quill/values-prod.yaml`) stores the API database in SQLite on PVC `quill-api-data` (storage class `longhorn`, pod pinned to `nexus`). The search Deployment mounts PVC `quill-search-index`, which sets no storage class. Redis is an emptyDir cache with persistence disabled. Postgres is a StatefulSet gated by `database.enabled: false`. Qdrant is not in this chart.

Backups must be chart changes. Argo CD applies `charts/quill` from `main`. Images that use `imagePullPolicy: Never` must keep a node pin. New CronJobs that run the API image must run on `nexus`.

## Goals / Non-Goals

**Goals:**

- A daily consistent copy of the SQLite file and of the search index.
- Copies stored on the Longhorn class the API volume already uses, kept for 14 days.
- A freshness Job and a scratch restore that checks row counts.
- A Longhorn claim for the search index, with a one-time copy from the legacy claim.

**Non-Goals:**

- Backing up Redis or Qdrant.
- Replacing the live database from the drill Job.
- A new container image or a new Secret.

## Decisions

- SQLite copy is `VACUUM INTO` via `node:sqlite` in the pinned API image. A read-only mount cannot run that statement, so the Job mounts the API claim read-write on `nexus` and only writes the destination.
- The search archive uses `redis.image` (`public.ecr.aws/docker/library/redis:8.2.3-alpine` in production) because that image contains `tar` and a shell and is already cached on `nexus`. Pull policy follows `redis.pullPolicy`, which is `IfNotPresent`.
- The backup claim defaults to `ReadWriteOnce` on `longhorn`. Longhorn `ReadWriteMany` needs an NFS client, and the NixOS nodes have not verified one. `backups.accessMode` can still be set to `ReadWriteMany`. Backup, freshness, and drill pods use `nodeName` from `api.storage.nodeName` (`nexus`).
- The legacy search claim is unchanged. Adding `storageClassName` would patch an immutable field and fail the sync. A new claim `quill-search-data` is the durable volume. An init container copies the legacy index once while `search.migrateLegacyIndex` is true. That pod is pinned to `nexus` for the copy, because `quill-search-index` is local-path on `nexus`.
- Postgres `pg_dump` is rendered only when `database.enabled` is true. It reads Secret `quill-db-secret`. Port 5432 is added to the network policy only in that case. The dump command does not print the password.
- The drill restores into an emptyDir. A second namespace cannot mount the backup claim.

## Risks / Trade-offs

- [Operator sets ReadWriteMany before NFS works] → the backup claim stays Pending. The default is ReadWriteOnce. The doc says to keep that mode.
- [Search leaves nexus while the backup claim is ReadWriteOnce] → the search backup cannot mount the index. The doc says to leave `search.nodeName` set to `nexus`.
- [Legacy volume and the new volume cannot schedule together] → search stays Pending. The doc says to read the pod event before deleting the legacy claim.
- [Freshness fails before the first backup] → expected. The doc says so.
- [Search rollout] → strategy is Recreate so two pods do not fight for the ReadWriteOnce claim.

## Migration Plan

1. Merge. Argo CD syncs.
2. Confirm `quill-backups` is Bound and the search init container copied the index.
3. Set `search.migrateLegacyIndex` to false and sync.
4. Leave the legacy claim in the chart until a later change removes the template. Do not delete it before the copy.

Rollback: set `backups.enabled` to false and point the search Deployment back at `quill-search-index`. The backup files remain on the backup claim until that claim is deleted.

## Open Questions

- None. Qdrant stays out of scope because it is not a chart resource.
