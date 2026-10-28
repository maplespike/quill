# Quill host independence (2026-10-28)

Standing rule: no Maplespike function may rely on a single machine.

## Chart change

Production values clear hard `nodeName: nexus` pins for api, mcp, redis,
ingestion, and search. Workloads use `nodeSelector: quill.io/workload=true`
so the scheduler may place them on nexus or forge. PVCs stay **longhorn** RWO
(already migrated off local-path); the volume attaches on whichever node runs
the pod.

`cloudflared` (disabled in values-prod) also uses the workload label instead of
`kubernetes.io/hostname: nexus`.

## Pre-accept checklist (Maple)

Before merging / syncing Argo:

1. Confirm recent backups succeeded within 24h:
   - `kubectl -n maplespike get cronjob quill-backup-sqlite quill-backup-search quill-backup-freshness`
   - Inspect the latest Job / pod logs for success.
2. Optional: create an on-demand backup Job from the CronJob (Maple/Infra only;
   do not skip verification).
3. Confirm nodes labelled `quill.io/workload=true` include at least nexus and forge.

Observed during authoring (read-only): sqlite last schedule 2026-10-28T01:15:00Z,
search 2026-10-28T01:45:00Z, freshness 2026-10-28T18:20:00Z.

## Rollback

1. Restore previous pins in `charts/quill/values-prod.yaml`:
   - `api.storage.nodeName: nexus` (and remove `api.nodeSelector` if desired)
   - `mcp.nodeName: nexus` (drop mcp.nodeSelector)
   - `redis.nodeName: nexus` (drop redis.nodeSelector)
   - `ingestion.nodeName: nexus`
   - `search.nodeName: nexus`
   - `cloudflared.nodeSelector.kubernetes.io/hostname: nexus`
2. Sync Argo / ship via deploy-prod as usual.
3. Confirm pods Ready on nexus: `kubectl -n maplespike get pods -o wide`.

## Out of scope here

`deploy-prod.yml` still has an image-build job on
`runs-on: [self-hosted, nixos, nexus]` because images land in the local
containerd store. Shared registry or forge image mirror is Infra follow-up.
Do not change runner counts from this doc.
