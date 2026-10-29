---
last-reviewed: 2026-10-29
status: active
---

# Image pinning — Quill production

Every Quill workload runs a **digest-pinned** image from the in-cluster
registry. No workload runs a mutable tag. kubelet pulls. It does not depend
on one node's containerd store.

Gate: **A3-IMAGEPIN** (issue #755).

## The rule

1. `charts/quill/values-prod.yaml` pins each image in `images.<svc>` —
   `api`, `mcp`, `portal`, `ingest`, and `search`: `digest` plus `tag`.
2. The registry host is `registry.registry.svc.cluster.local:5000`.
   `image.repositoryPath` is `quill`. The chart renders
   `registry.registry.svc.cluster.local:5000/quill/<svc>@sha256:<digest>`.
3. `image.pullPolicy` is `IfNotPresent`. nexus and sentry-agent both mirror
   that host in `/etc/rancher/k3s/registries.yaml` (plain HTTP, endpoint
   pinned to the ClusterIP). A pod can start on either node.
4. `imagePullPolicy: Never` is not used. Never made the image local to one
   machine. Infra does not allow a shell from one node to another, so a
   local image cannot follow the pod.
5. Third-party images (postgres, cloudflared, redis) stay version-pinned.
   Redis is `IfNotPresent` and is not part of this registry.

## Why

Production used to pin `docker.io/library/quill-*:local` with
`imagePullPolicy: Never`. `:local` is a mutable tag. A digest cannot be
re-pointed. After pods were allowed to schedule on sentry-agent as well as
nexus, a Never image that existed only on nexus stayed `ErrImageNeverPull`.
Copying the tarball over ssh is not allowed. The registry is the shared
store. Both nodes already mirror it.

The `tag` field is the git sha that was pushed. The chart pulls the digest,
not the tag.

## Apply a pin

Run the script on nexus (docker and the search image are there):

```bash
scripts/pin-images.sh
scripts/pin-images.sh --svc mcp
```

It builds api, mcp, portal, and ingest, pushes
`registry.registry.svc.cluster.local:5000/quill/<svc>:<git sha>`, and reads
the digest back from the registry v2 API. That digest is the pin.

`quill-search` has no Dockerfile in this repo. The script re-tags the
digest already in nexus containerd and pushes that. If that digest is not
in the local store, the script stops and says so. It cannot invent the bytes.

Then commit the printed `images:` block. Argo CD renders `charts/quill` +
`values-prod.yaml` from `main`.

## Verify

```bash
# Chart only (no cluster). CI runs this:
node scripts/gates/check-node-images.mjs --values charts/quill/values-prod.yaml

# Registry has every pinned digest. deploy-prod runs this before the pin commit:
node scripts/gates/check-node-images.mjs --values charts/quill/values-prod.yaml --check

# Drop old manifests. Keeps the pinned digest and the 5 newest tags.
# DELETE does not free blob space. Run garbage-collect in the registry pod.
node scripts/gates/check-node-images.mjs --values charts/quill/values-prod.yaml --prune --keep 5
```

The registry volume is 50Gi (Longhorn). Prune unlinks old manifests so the
volume does not fill with tags. The blobs remain until a server-side
`registry garbage-collect`.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Pod `ImagePullBackOff` on the registry host | The digest was never pushed, or the node is not mirroring the registry | Re-run `pin-images.sh` on nexus. Confirm `registries.yaml` on that node. |
| `registry: FAIL … no manifest` | deploy-prod's check ran before the push, or the push rewrote the digest and the pin was not updated | The pin must be `Docker-Content-Digest` from the registry, which `pin-images.sh` prints |
| `imagePullPolicy: Never` in a render | A template or values file went back to a node-local image | Set `IfNotPresent` and the registry digest |
| Registry volume fills up | Manifest DELETE does not delete blobs | Run garbage-collect in the registry pod |
