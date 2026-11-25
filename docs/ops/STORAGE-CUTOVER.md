# Prod storage cutover: off Longhorn, onto local-path

Production runs SQLite on the `quill-api-data` volume (not a SQL dump and
restore). The end state is that api-data, search-data, and backups all live
on local-path copies, with no remaining Longhorn PVCs in use. The existing
Longhorn PVCs are never deleted or replaced in this procedure. Rollback is
flipping `storageCutover.useLocalPathCopies` back to `false`. Deleting the
old Longhorn PVCs is a separate later step and needs Reverb's explicit yes.

`storageCutover.useLocalPathCopies` defaults to `false`. While it is false,
the three `*-local` PVCs are not rendered and workloads keep the Longhorn
claims. Flipping it to `true` both creates the three new claims and points
workloads at them. Because of that, raise the quota, set the backups node,
and freeze (scale api and search to 0, suspend CronJobs) **before** enabling
the flag, then copy the volumes, then scale back up.

## Sizing and quota

media-k8s #671 currently caps local-path in `maplespike` at **15Gi / 3
claims**. These three copies need **at least 40Gi / 3 claims** before the
flag can be enabled:

| new claim | size | actual (2026-11-24 11:31 PM CT) | placement |
| --- | ---: | ---: | --- |
| quill-api-data-local | 5Gi | 2.46 GiB | sentry |
| quill-search-data-local | 5Gi | 0.16 GiB | sentry |
| quill-backups-local | 30Gi | 17.25 GiB | **unset** — not sentry, not the api-data node |
| **total** | **40Gi / 3** | **19.87 GiB** | |

`storageCutover.backupsNodeName` is left empty in git on purpose. Do not
push a placement value until Infra picks a node. local-path uses
WaitForFirstConsumer: with no pin, the backups volume binds on whichever
node first mounts it. **The runbook must set `backupsNodeName` before
enabling the flag**, otherwise the first backup or copy pod decides the
node, and that must not be sentry or the api-data node.

## Runbook (in order)

1. **Raise the local-path quota** in media-k8s #671 (or a follow-up) to at
   least 40Gi / 3 claims. Do not enable the flag against the 15Gi cap.

2. **Set `storageCutover.backupsNodeName`** to the node Infra chooses (not
   sentry, not the api-data node). Leave api/search copies on sentry.

3. **Freeze**
   - Pause Argo CD `selfHeal` on the quill application.
   - Suspend the `quill-backup-*` and `quill-ingest-*` CronJobs.
   - Scale `quill-api` and `quill-search` to 0.

4. **Enable the flag** (`storageCutover.useLocalPathCopies: true`) and
   sync, with replicas still at 0, so the three new PVCs exist but running
   workloads do not mount empty volumes.

5. **Copy the volumes off**, in this order, with a sha256 manifest of every
   file (path + size + digest) on the source and the destination, and a
   comparison before declaring each copy good. Take Longhorn snapshots and
   Longhorn backups of each source volume before copying it.
   1. **backups first** (`quill-backups` → `quill-backups-local`), on the
      node in `backupsNodeName`;
   2. then **api-data** (`quill-api-data` → `quill-api-data-local`) on sentry;
   3. then **search** (`quill-search-data` → `quill-search-data-local`) on sentry.

6. **Scale api then search back up**, confirm 1/1 and a health probe, then
   unsuspend CronJobs and re-enable selfHeal only after that.

7. **Rollback** is setting `storageCutover.useLocalPathCopies` back to
   `false` and syncing. The original Longhorn PVCs are untouched.

8. **Do not delete** the old Longhorn PVCs in this change. The end state of
   the cutover is that nothing still *uses* them. Deleting them is a
   separate later step and needs Reverb's explicit yes.
