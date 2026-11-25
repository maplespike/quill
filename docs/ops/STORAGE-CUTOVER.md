# Prod storage cutover: off Longhorn, onto local-path and NFS

Production runs SQLite on the `quill-api-data` volume (not a SQL dump and
restore). The end state is that api-data and search-data live on local-path
copies, backups live on an Infra-provided NFS volume, and there are no
Longhorn PVCs in use anywhere — prod and staging. The existing Longhorn
PVCs are never deleted or replaced in this procedure. Rollback is flipping
`storageCutover.useLocalPathCopies` back to `false`. Deleting the old
Longhorn PVCs is a separate later step and needs Reverb's explicit yes.

`storageCutover.useLocalPathCopies` defaults to `false`. While it is false,
the cutover claims are not rendered and workloads keep the Longhorn claims.
Flipping it to `true` both creates the new claims and points workloads at
them. Because of that, set `storageCutover.backupsVolumeName` to the Infra
NFS PersistentVolume name, and freeze (scale api and search to 0, suspend
CronJobs) **before** enabling the flag, then copy the volumes, then scale
back up. Enabling the flag with an empty `backupsVolumeName` fails the
render rather than creating a PVC that cannot bind.

## Sizing and quota

media-k8s #671 (`383ade63`) caps Longhorn in `maplespike` at **40Gi / 3
claims** and local-path at **50Gi / 4 claims**. The local-path copies in
this cutover are only api-data and search-data (10Gi / 2), which fits.
Backups are not local-path: `quill-backups-local` is a static-bind RWX PVC
(`storageClassName` empty, no node pin) sized to match the existing 30Gi
claim, bound to the NFS PV Infra provides.

| new claim | size | actual (2026-11-24 11:31 PM CT) | backing |
| --- | ---: | ---: | --- |
| quill-api-data-local | 5Gi | 2.46 GiB | local-path (pinned in values) |
| quill-search-data-local | 5Gi | 0.16 GiB | local-path (pinned in values) |
| quill-backups-local | 30Gi | 17.25 GiB | Infra NFS PV (RWX static bind) |
| **local-path total** | **10Gi / 2** | **2.62 GiB** | under the 50Gi / 4 cap |

Leave `backupsVolumeName` empty in git until Infra provides the PV name.
Do not put a node pin on the backups claim. The backup job stays
co-located with api-data and mounts the NFS volume there (RWX). It writes
the SQLite snapshot and search archive to an emptyDir scratch volume
first, verifies with `PRAGMA integrity_check` and sha256, then copies onto
the backups mount and prunes to the existing retention. A write probe
fails the job if the backups mount is missing or not writable.
`activeDeadlineSeconds` is set on the backup jobs.

## Runbook (in order)

1. **Infra provides the NFS PersistentVolume** (RWX, capacity at least 30Gi).
   Set `storageCutover.backupsVolumeName` to that PV's name. Do not enable
   the flag before this is set.

2. **Freeze**
   - Pause Argo CD `selfHeal` on the quill application.
   - Suspend the `quill-backup-*` and `quill-ingest-*` CronJobs.
   - Scale `quill-api` and `quill-search` to 0.

3. **Enable the flag** (`storageCutover.useLocalPathCopies: true`) and
   sync, with replicas still at 0, so the new PVCs exist but running
   workloads do not mount empty volumes. Confirm `quill-backups-local` is
   Bound to the Infra PV, and that the api/search local-path copies Bound.

4. **Copy the volumes off**, in this order, with a sha256 manifest of every
   file (path + size + digest) on the source and the destination, and a
   comparison before declaring each copy good. Take Longhorn snapshots and
   Longhorn backups of each source volume before copying it.
   1. **backups first** (`quill-backups` → `quill-backups-local` on the
      Infra NFS bind);
   2. then **api-data** (`quill-api-data` → `quill-api-data-local`);
   3. then **search** (`quill-search-data` → `quill-search-data-local`).

5. **Scale api then search back up**, confirm 1/1 and a health probe, then
   unsuspend CronJobs and re-enable selfHeal only after that.

6. **Rollback** is setting `storageCutover.useLocalPathCopies` back to
   `false` and syncing. The original Longhorn PVCs are untouched.

7. **Staging leaves Longhorn** as its own later pass. Staging currently
   pins the cutover flag off so it does not inherit a prod flip. Its node,
   size, and claim come from Infra and are TBD. Do not treat a prod
   cutover as a staging cutover.

8. **End state** is no Longhorn PVCs in use, prod and staging. **Do not
   delete** the old Longhorn PVCs in this change. Deleting them is a
   separate later step and needs Reverb's explicit yes.
