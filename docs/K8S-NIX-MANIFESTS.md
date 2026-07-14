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

The hand-maintained `k8s/base/*.yaml` files are kept as a human-readable
reference but the Nix generator is the source of truth. Image registry/tag
and public domain are parameters, so dev vs prod are just different call
sites.

## Build + apply

```bash
# Generate manifests (writes result/manifests.yaml)
nix build .#saas-manifests -L

# Apply to the cluster (namespace maplespike)
kubectl apply -f result/manifests.yaml

# Or use the one-shot deploy app
TAG=stable nix run .#deploy-saas
```

## Image tagging

The generator references `nexus:5000/quill-{api,mcp,portal}:<tag>`.
Push images first:

```bash
REGISTRY=ghcr.io/reverb256 TAG=stable nix run .#push-images
```

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
