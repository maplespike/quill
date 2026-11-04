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

The merge leaves the live `docker.io/library/quill-<svc>@sha256` refs and
`imagePullPolicy: Never` in place. `deploy-prod` switches every service to
the registry digest and `IfNotPresent` in one commit, after each manifest
HEAD succeeds. A miss writes nothing.

After that commit, `imagePullPolicy` is `IfNotPresent`. The build still runs on nexus
(`runs-on: [self-hosted, nixos, nexus]`). `scripts/pin-images.sh` pushes
`registry.registry.svc.cluster.local:5000/quill/<svc>:<git sha>`. nexus and
sentry-agent both mirror that host over plain HTTP, so either node can pull
the digest. Nodes do not copy images to each other.

`quill-search` has no Dockerfile in this repo. The script pushes the digest
already in the nexus containerd store. If that image is missing, the push
stops.

`deploy-prod` then HEADs every pinned digest on the registry v2 API and
fails the pin commit if any digest is missing or does not match. It also
deletes older manifests, keeping the pinned digest and the 5 newest tags.
Blob space comes back only after a server-side registry garbage-collect.

Do not change runner counts from this doc.
