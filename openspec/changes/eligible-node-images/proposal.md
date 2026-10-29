# Proposal: Publish Quill images to the in-cluster registry

## Problem

After the nexus|sentry-agent affinity change, a quill-portal pod on
sentry-agent stays `ErrImageNeverPull`. The image is `imagePullPolicy: Never`
and exists only in nexus containerd. Infra does not allow ssh between nodes,
so a tarball copy cannot fix it.

`quill-redis` is liveness-killed (exit 137) when `redis-cli ping` exceeds
the 3s probe timeout under IO pressure.

## Proposed fix

Push images to `registry.registry.svc.cluster.local:5000`. Both nodes already
mirror that host over plain HTTP. Charts pull the digest with
`imagePullPolicy: IfNotPresent`. deploy-prod fails unless the registry v2
API serves each pinned digest. Prune old tags. Keep the Redis probe change.

## Affected packages

- `charts/quill` (image reference, pull policy, Redis probes)
- `.github/workflows/deploy-prod.yml`
- `scripts/pin-images.sh` and the image-pin gate

No API or MCP contract change. No new dependency. No new secret.
