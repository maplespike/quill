---
last-reviewed: 2026-10-26
status: active
---

# Quill backups

Production data for the `maplespike` namespace is recoverable from a daily copy on a Longhorn volume. The copy is not on the same disk as the live file.

Run the drill before you need a restore:

```bash
bash scripts/restore-drill.sh --local
bash scripts/restore-drill.sh
```

The first command uses a scratch file on this machine. The second starts the in-cluster drill Job.

## Stores

| Store | Live location | Durable? | Backup |
| --- | --- | --- | --- |
| API SQLite | PVC `quill-api-data`, Longhorn, file `/data/quill/maplespike.db` | Yes. Longhorn. The API pod is pinned to `nexus`. | Daily `VACUUM INTO` at 01:15 UTC. 14 days. PVC `quill-backups`, path `sqlite/`. |
| Search index | PVC `quill-search-data`, Longhorn, directory `/data/index` | Yes, after this chart is synced. The previous claim `quill-search-index` has no storage class. On this cluster that means `local-path` (one node disk). | Daily tar at 01:45 UTC. 14 days. PVC `quill-backups`, path `search/`. |
| Postgres | StatefulSet is off (`database.enabled: false`) | When you turn it on, the data claim uses Longhorn. | Daily `pg_dump -Fc` at 01:15 UTC. Rendered only when the StatefulSet is enabled. Secret `quill-db-secret`. |
| Redis | `emptyDir` on `quill-redis`. RDB and AOF are off. | No. A restart drops the cache and the rate-limit counters. That is intentional. | None. |
| Qdrant | Not in this chart. The API default endpoint is `http://qdrant:6333`. | Outside this chart. | Not backed up here. |

The backup claim uses storage class `longhorn` and access mode `ReadWriteOnce`. Longhorn is the class the API volume already uses. ReadWriteOnce does not need an NFS client. The backup, freshness, and drill pods are pinned to `nexus` with `nodeName`, the same pin as the API pod, so they can mount that one claim. Set `backups.accessMode` to `ReadWriteMany` only after the NFS client on the NixOS node is verified. Retention is 14 days, by file mtime. The freshness CronJob runs every 6 hours and fails when the newest backup is older than 26 hours. The drill CronJob runs Sunday at 03:30 UTC. It restores into an emptyDir and checks row counts. It does not write the live database.

## Run the drill

On a machine that has this repo and `kubectl` for the cluster:

```bash
bash scripts/restore-drill.sh
```

The script creates a Job from CronJob `quill-backup-drill` in namespace `maplespike`. The Job copies the newest SQLite backup to `/scratch/sqlite/restored.db`, runs `PRAGMA integrity_check`, and compares table counts with the sidecar written at backup time. It extracts the newest search archive and checks `quill-meta.json`. A passing run ends with `restore drill: ok`.

A scratch namespace cannot mount `quill-backups`. PersistentVolumeClaims do not cross namespaces. The scratch database is the emptyDir on that Job.

Check the schedule yourself:

```bash
kubectl -n maplespike get cronjob -l component=backup
kubectl -n maplespike get pvc quill-backups quill-search-data quill-api-data
```

## Manual steps after the sync

Argo CD applies the chart. Do these checks on the cluster. Do not put secret values in the repo.

1. Confirm PVC `quill-backups` is `Bound` with access mode `ReadWriteOnce`. The SQLite, search, freshness, and drill pods must show `nodeName: nexus`. If the claim stays `Pending`, the Longhorn class is not provisioning that mode. Do not switch to `ReadWriteMany` unless the NFS client on `nexus` is already verified.
2. Confirm the search pod becomes `Ready` on `nexus`. While `search.migrateLegacyIndex` is true the pod is pinned there, because PVC `quill-search-index` is `local-path` and is bound to `nexus`. The init container copies that claim onto `quill-search-data`. Its image is `redis.image` from this chart, `public.ecr.aws/docker/library/redis:8.2.3-alpine`, with `imagePullPolicy: IfNotPresent`. That image is already cached on `nexus`. Read the init log. It says either that it copied the index or that the durable volume already has one.
3. Read the search health document from inside the cluster. The `docs` count must match the count from before the sync. Then set `search.migrateLegacyIndex` to `false` and sync. Leave `search.nodeName` set to `nexus`. The backup claim is `ReadWriteOnce`, so the search pod and the search backup must stay on that node. `search.nodeSelector` applies only when `nodeName` is empty. Clear `nodeName` only if you also set `backups.accessMode` to `ReadWriteMany`.
4. Do not `kubectl delete pvc quill-search-index` until step 3 is done. Argo CD will create the claim again while the template still lists it. Deleting it early, before the copy, drops the only copy of the index. The chart now renders `quill-search-index` only while `search.migrateLegacyIndex` is true, so setting it to `false` makes Argo CD prune the claim (done 2026-10-26, after confirming no workload mounted it and the index segments on `quill-search-data` matched).
5. The freshness CronJob fails until the first successful daily backup (01:15 UTC for SQLite, 01:45 UTC for the index). That first failure is expected. After those jobs succeed, freshness must stay green.
6. No new Secret is required. SQLite and the search archive do not read a Secret. A future Postgres backup reads existing Secret `quill-db-secret` keys `postgres-user`, `postgres-password`, and `postgres-database`.

## Restore SQLite for real

This replaces the live database. Stop writers first.

```bash
kubectl -n maplespike scale deploy/quill-api --replicas=0
kubectl -n maplespike get cronjob -o name | while read -r job; do
  case "$job" in
    *ingest*|*engine*) kubectl -n maplespike patch "$job" --type merge -p '{"spec":{"suspend":true}}' ;;
  esac
done
```

Copy the newest `sqlite/maplespike-*.db` over `/data/quill/maplespike.db` from a pod on `nexus` that mounts `quill-api-data` and `quill-backups`. Delete `maplespike.db-wal` and `maplespike.db-shm` in that directory before you start the API. Then scale `quill-api` back to 1 and set `suspend` back to false on the CronJobs you paused.

Confirm with the drill command, or open the file and run `SELECT count(*)` on the tables you care about.

## Restore the search index for real

Scale `deploy/quill-search` to 0. Extract the newest `search/index-*.tar.gz` into the `index/` directory on `quill-search-data`. Scale the deployment back to 1. `GET /health` must show the `docs` value from the matching `index-*.meta.json`.

You can rebuild the index from the SQLite corpus instead. The index is derived. The archive is the faster path back to the last built index.

## Restore Postgres

The production chart does not run Postgres. When `database.enabled` is true, the daily dump is a custom-format file on `quill-backups` under `postgres/`.

To check a dump without replacing the live database, create a scratch database and load the dump:

```bash
# Run inside a pod that has pg_restore and can reach Service quill-db.
# The password is key postgres-password on Secret quill-db-secret.
createdb -h quill-db -U "$PGUSER" restore_drill
pg_restore --no-owner --dbname restore_drill /backups/postgres/<dump>
psql -h quill-db -U "$PGUSER" -d restore_drill -c '\dt'
dropdb -h quill-db -U "$PGUSER" restore_drill
```

Do not restore over the live database name unless you intend to replace it.

## What a failed backup means

`kubectl -n maplespike get jobs -l component=backup`

A failed `quill-backup-sqlite-*` Job means tonight's copy did not land. The previous files stay until they are older than 14 days. A failed `quill-backup-freshness-*` Job means the newest file is missing or older than 26 hours. Fix the backup Job before you delete old files.
