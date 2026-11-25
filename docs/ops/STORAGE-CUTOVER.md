# Prod storage cutover: local-path copies on sentry

Production runs SQLite on the `quill-api-data` volume (not a SQL dump and
restore). This runbook copies that volume and `quill-search-data` onto new
local-path claims on sentry, then flips a Helm flag so workloads mount the
copies. `quill-backups` stays on Longhorn; an archive-disk move is a later,
separate PR.

The existing Longhorn PVCs are never deleted or replaced in this procedure.
Rollback is flipping the flag back. Deleting the old PVCs is a separate later
step and needs Reverb's yes.

## Sizing

Infra local-path cap (media-k8s #671, adjusted now that backups are not
copied): **15Gi / 3 claims**.

| new claim | size | of cap |
| --- | ---: | ---: |
| quill-api-data-local | 5Gi | |
| quill-search-data-local | 5Gi | |
| **total** | **10Gi / 2 PVCs** | **5Gi / 1 claim remaining** |

Live usage measured in media-k8s #671 at 2026-11-24 11:31 PM
America/Winnipeg (Bound claim sizes still 5Gi + 5Gi + 30Gi Longhorn as of
11:40 PM CT):

- quill-api-data actual: 2,642,993,152 B (2.46 GiB)
- quill-search-data actual: 166,879,232 B (0.16 GiB)
- combined actual: 2.62 GiB
- sentry `/`: 237G size, 172G used, 56G avail, **76%**

After a thin-provisioned copy of the actual data: about 175G used, 53G
avail, **~77%**, well under the 85% ceiling (about 22G of headroom remained
to 85%). A thick 10Gi write would still be around 77–78%.

## Runbook (in order)

1. **Freeze**
   - Pause Argo CD `selfHeal` on the quill application.
   - Suspend the `quill-backup-*` and `quill-ingest-*` CronJobs.
   - Scale `quill-api` and `quill-search` to 0.

2. **Copy the volumes off**, with:
   - a sha256 manifest of every file (path + size + digest) on the source
     and the destination, and a comparison before declaring the copy good;
   - Longhorn snapshots and Longhorn backups of `quill-api-data` and
     `quill-search-data` taken before the copy, so the Longhorn claims stay
     a complete rollback target.

   Bind the new local-path claims on sentry (they are annotated for that
   node). Do not copy `quill-backups`.

3. **Switch api-data**, set `storageCutover.useLocalPathCopies` still false
   until the api-data copy is verified, then flip workloads that mount
   `quill-api-data` by setting the flag only after both copies are verified.
   The flag switches api-data and search together; verify api-data first,
   then search, then flip once.

   Practical order once both copies verify:
   - confirm api-data copy (manifest + spot-check the SQLite file);
   - confirm search-data copy (manifest + tantivy index);
   - set `storageCutover.useLocalPathCopies: true`, sync, scale api then
     search back up, confirm 1/1 and a health probe;
   - unsuspend CronJobs and re-enable selfHeal only after that.

4. **Rollback** is setting `storageCutover.useLocalPathCopies` back to
   `false` and syncing. The original Longhorn PVCs are untouched.

5. **Do not delete** the old Longhorn PVCs in this change. That is a
   separate later step and needs Reverb's yes.
