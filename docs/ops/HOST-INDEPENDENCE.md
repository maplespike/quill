# Quill host independence (2026-10-28)

Standing rule: no Maplespike function may rely on a single machine.

## CPU order (Reverb 15:06 CT)

1. **nexus** first (preferred weight 100)
2. **sentry-agent** fallback
3. **forge** last — **ultra-light only** (`cloudflared`). Heavy workloads must
   never schedule on forge.

Heavy workloads (api, mcp, redis, search, portal, ingestion CronJobs, engine
sweep, backup Jobs) use **required** `nodeAffinity` on
`kubernetes.io/hostname In [nexus, sentry-agent]` plus preferred nexus.
Configurable per component via `affinityHosts` / `preferredHost` (defaults in
`values-prod.yaml` as YAML anchors `*quillHeavyHosts` /
`*quillPreferredHost`). No kubectl node-label writes — affinity uses the
built-in hostname label only.

`cloudflared` (disabled in values-prod today) may set
`affinityHosts: [nexus, sentry-agent, forge]`.

Production PVCs stay **longhorn** RWO. Hard `nodeName: nexus` pins are cleared
so the scheduler can place pods on either allowed host; the volume attaches on
the chosen node.

## Pre-accept checklist (Maple)

Before merging / syncing Argo:

1. Confirm recent backups succeeded within 24h
   (`quill-backup-sqlite`, `quill-backup-search`, `quill-backup-freshness`).
2. Confirm longhorn replicas for `quill-api-data` / `quill-search-data` include
   a healthy replica on `sentry-agent` (so that host is a real fallback).
3. Confirm portal moves off forge after sync (same affinity as other heavy
   workloads).

## Rollback

1. Restore previous `values-prod.yaml` pins, e.g. `api.storage.nodeName: nexus`,
   `mcp`/`redis`/`ingestion`/`search` `nodeName: nexus`, portal
   `nodeSelector: quill.io/workload=true` (or prior affinityHosts), and
   cloudflared `kubernetes.io/hostname: nexus` if needed.
2. Sync Argo / ship via deploy-prod as usual.
3. Confirm pods Ready on the intended node:
   `kubectl -n maplespike get pods -o wide`.

## Images

`imagePullPolicy` is `Never`. The build still runs on nexus
(`runs-on: [self-hosted, nixos, nexus]`). `scripts/pin-images.sh` imports
each digest into the nexus containerd store and copies the tarball to every
other heavy host (`sentry-agent`). `quill-search` is copied from the pin
already in `values-prod.yaml`. It is not rebuilt in that job.

`deploy-prod` then runs `scripts/gates/check-node-images.mjs --check` and
fails if any pinned digest is missing on `nexus` or `sentry-agent`. The
check runs before the pin commit. `forge` is not a target. There is no
registry and no pull secret.

Do not change runner counts from this doc.
