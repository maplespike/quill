---
last-reviewed: 2026-07-10
status: active
---

# K8s Manifests — Nix-Generated (SaaS Path)

The SaaS deployment to the homelab k3s cluster is **generated from Nix**
(`nix/saas-manifests.nix`), not hand-edited. The generator emits the same
cloudflared-shaped objects the live cluster runs:

- `namespace/maplespike` (+ `ai-inference`)
- `cloudflared` Deployment + `cloudflared-config` ConfigMap (traffic for `*.maplespike.ca`)
- `quill-api` / `quill-mcp` / `quill-portal` Deployments + Services
- LAN Traefik Ingress (`15-ingress-lan.yaml` shape)

The hand-maintained `k8s/maplespike/*.yaml` files are kept as a
human-readable reference but the Nix generator is the source of truth.
(`k8s/base/` was retired — the reference manifests moved to `k8s/maplespike/`
on 2026-08-10; the Nix generator is canonical for the live cluster.)
Image registry/tag and public domain are parameters, so dev vs prod are just
different call sites.

## Build + apply

```bash
# Generate manifests (writes result/manifests.yaml)
nix build .#saas-manifests -L

# Apply to the cluster (namespace maplespike)
kubectl apply -f result/manifests.yaml

# Or use the one-shot deploy app
nix run .#deploy-saas
```

## Image tagging

The generator references `nexus:5000/quill-{api,mcp,portal}:<tag>` with
**per-service pinned tags** (defaulting to the shared `tag` param):

```nix
saas-manifests = saasManifests {
  inherit pkgs;
  registry = "nexus:5000";
  tag = "2026-08-10-3";       # shared default
  apiTag = "2026-08-10-3";    # api/mcp carry the module-resolution fix
  mcpTag = "2026-08-10-3";
  portalTag = "2026-08-10";   # portal is static Python — no -3 fix needed
  domain = "maplespike.ca";
};
```

Push images first (canonical registry is `nexus:5000`, GHCR push is retired —
see docs/GHCR-CLEANUP.md):

```bash
nix run .#push-images   # defaults REGISTRY=nexus:5000 TAG=stable COMMIT=<sha>
```

> The cluster's `deny-latest-tag-deployments` admission policy forbids `:latest`
> in Deployments — always pin concrete tags as above.

## Why not easykubenix / Helm?

- easykubenix was removed (PR #733): its `manifestYAML = builtins.readFile`
  is an Import-From-Derivation that breaks `nix flake check --no-build`.
- There is no Helm chart in the repo, so the generated `values.yaml` was
  removed. Plain Nix → YAML (concatenated `---` documents) is the most
  transparent and still pure-evaluable.

## Self-hosting (non-cluster)

For a single box, use the Podman Quadlet units instead — see
`nix/selfhost.nix` and `./selfhost.sh`:

```bash
./selfhost.sh up      # build images + install units + start
./selfhost.sh down    # stop + disable
./selfhost.sh status  # health check
# or: nix run .#selfhost up
```

See also: `NIX-FIRST-WORKFLOW.md`, `NIX-IMAGES.md`, `docs/ROUTING.md`.
