# Tasks

- [x] Push api, mcp, portal, and ingest to the in-cluster registry from deploy-prod
- [x] Re-tag and push the pinned quill-search image from the nexus containerd store
- [x] Render `registry…/quill/<svc>@sha256:<digest>` with IfNotPresent
- [x] Fail the pin commit when the registry v2 API does not serve that digest
- [x] Prune to the pinned digest plus the 5 newest tags
- [x] Drop ssh and per-node ctr import from the deploy path
- [x] Keep the Redis probe headroom
