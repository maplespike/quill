# Design: Eligible-node image import

## Decision

Copy the containerd tarball. Do not push to a registry.

`scripts/pin-images.sh` already builds on nexus, imports into that node's
k3s containerd, and exports a tarball for peers. The peer list was `forge`.
Heavy workloads now schedule on `nexus` and `sentry-agent` only. The peer
list is the heavy `affinityHosts` anchor in `charts/quill/values-prod.yaml`,
minus the build node.

GHCR push is retired and `GHCR_TOKEN` is unused. An in-cluster registry is
not the deploy path (`nexus:5000` was decommissioned). A new pull secret
would violate the "do not invent secrets" rule. The tarball path needs no
new credential and no paid registry.

## Flow

1. `deploy-prod` `build-and-pin` runs on nexus.
2. `pin-images.sh` builds api, mcp, portal, and ingest. It imports each
   digest locally, exports a file (a live pipe into remote `ctr import`
   fails on k3s v1.37), and `ssh`es the file to sentry-agent.
3. The same copy runs for pinned digests this build does not replace.
   `quill-search` is the one today. It has a pin and no Dockerfile in
   this repo.
4. `apply-image-pins.mjs` writes the new digests into `values-prod.yaml`.
   Search is left untouched.
5. `scripts/gates/check-node-images.mjs --check` reads every `images.*`
   digest and fails unless both nexus and sentry-agent list the
   `repo@sha256` name. This runs before the pin commit, so Argo CD does
   not roll a digest the peer cannot start.
6. CI runs `--plan` and the unit tests. CI does not SSH. A missing
   `--check` step, or a peer list that includes forge, fails CI.

`imagePullPolicy` stays `Never`. A pull is still a bug.

## Redis

`timeoutSeconds: 5` on startup, readiness, and liveness.
Liveness `failureThreshold: 5` (period 20s).
`startupProbe` `failureThreshold: 30` at period 10s (5 minutes) so module
load and AOF/RDB replay finish before liveness can kill the process.
Requests stay `50m` / `64Mi`. Limits stay `200m` / `192Mi`. `maxmemory`
stays `128mb`.

## Rollback

Revert the commit. The previous digests remain in the nexus store. A
sentry-agent pod still needs the digest imported there; the reverted
script's peer was forge, so a rollback of the script does not remove
images already copied to sentry-agent.
