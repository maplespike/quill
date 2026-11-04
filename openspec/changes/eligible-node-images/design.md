# Design: In-cluster registry

## Decision

Push to `registry.registry.svc.cluster.local:5000`. Do not ssh. Do not
import the image into each node's containerd.

nexus and sentry-agent already mirror that host in
`/etc/rancher/k3s/registries.yaml`: plain HTTP, endpoint pinned to the
ClusterIP. The ARC runner image ships the same file. GHCR is retired.
No pull secret is added.

## Flow

1. `deploy-prod` `build-and-pin` runs on nexus.
2. `pin-images.sh` builds api, mcp, portal, and ingest, scans each image,
   and pushes `…/quill/<svc>:<git sha>` with `k3s ctr images push --plain-http`
   to the mirrored endpoint. A local `ctr import` only stages the docker
   build for that push. It is not a copy to another node.
3. The script reads `Docker-Content-Digest` from the registry v2 API.
   That digest is the pin. A push can rewrite the manifest, so the local
   containerd digest is not the pin.
4. `quill-search` has no Dockerfile in this repo. The script re-tags the
   digest already in nexus containerd and pushes it. If the bytes are not
   there, the script exits and names the missing digest. It does not
   invent an image.
5. `apply-image-pins.mjs` writes the digests into `values-prod.yaml`.
6. `--check` HEADs `/v2/quill/<svc>/manifests/<digest>` and fails if the
   status is not 200 or the digest header does not match. This is before
   the pin commit.
7. `--prune --keep 5` keeps the pinned digest and the five newest tags
   (git commit time) and DELETEs the other manifests. The registry API
   unlinks the manifest. Blob deletion is `registry garbage-collect` in
   the registry pod. The volume is 50Gi Longhorn.

Charts render `registry.registry.svc.cluster.local:5000/quill/<svc>@sha256:<digest>`
with `imagePullPolicy: IfNotPresent`.

## Redis

Unchanged from the probe fix: `timeoutSeconds: 5`, liveness
`failureThreshold: 5`, and a startupProbe. Requests and limits stay at
the 128mb cache budget.

## Rollback

Revert the values pin to the previous digest only after that digest is
in the registry. A revert to `imagePullPolicy: Never` puts the pod back
on whichever node happens to have the old layers.
