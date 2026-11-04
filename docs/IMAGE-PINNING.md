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
2. Until the deploy-prod pin commit, `images.<svc>` has only `digest` and
   `tag`. The chart renders `docker.io/library/quill-<svc>@sha256:<digest>`
   with `image.pullPolicy: Never`. That is the live pin. Merging this
   change does not alter it.
3. The pin commit sets, on every service in the same file write,
   `registry: registry.registry.svc.cluster.local:5000`,
   `repository: quill/<svc>`, `pullPolicy: IfNotPresent`, and the registry
   digest. The chart then renders
   `registry.registry.svc.cluster.local:5000/quill/<svc>@sha256:<digest>`.
   nexus and sentry-agent mirror that host over plain HTTP.
4. If any service's manifest HEAD fails, the pin file is not written.
   A partial switch is rejected.
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
