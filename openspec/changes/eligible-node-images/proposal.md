# Proposal: Import every Quill image onto every eligible node

## Problem

After the nexus|sentry-agent affinity change, a quill-portal pod on
sentry-agent stays `ErrImageNeverPull`. Its image is
`docker.io/library/quill-portal@sha256:…` with `imagePullPolicy: Never`.
That digest exists only in nexus containerd. `scripts/pin-images.sh`
copied tarballs to forge, which no longer runs these workloads.

`quill-redis` is liveness-killed (exit 137) when `redis-cli ping` exceeds
the 3s probe timeout under IO pressure. Module load and AOF/RDB replay
have the same window: liveness starts before the process can answer.

## Proposed fix

Keep the registry-free path the repo already uses. On deploy, import each
pinned digest into nexus and into sentry-agent, then fail if either store
lacks the `repo@sha256` name. Do not add a registry or a pull secret.

Give the Redis probes headroom. Leave the cache requests and limits as
they are.

## Affected packages

- `charts/quill` (Redis probes, portal placement comment)
- `.github/workflows/deploy-prod.yml`
- `scripts/pin-images.sh` and the image-pin gate

No API or MCP contract change. No new dependency. No new secret.
