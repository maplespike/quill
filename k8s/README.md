# MapleSpike Kubernetes Manifests

This directory contains the Kubernetes manifests for deploying
the MapleSpike suite on the homelab k3s cluster (`nexus`).

> **CANONICAL DEPLOY PATH (2026-08-10):** the single source of truth for the
> live cluster is **Nix** — `nix build .#saas-manifests && kubectl apply -f
> result/manifests.yaml` generates the bundle from `flake.nix` +
> `nix/saas-manifests.nix` (per-service pinned image tags, pinned ClusterIPs,
> canonical GNP via `builtins.readFile ../k8s/gnp-default-deny.yaml`). The
> hand-maintained files in this directory are a human-readable reference and
> are kept in lockstep with the Nix generator; the Nix generator wins on
> conflict.

## Structure

```
k8s/
├── README.md                   # This file
├── gnp-default-deny.yaml       # Canonical Calico GlobalNetworkPolicy (default-deny-enforced, 7844 for cloudflared edge)
├── maplespike/                 # Core MapleSpike services (reference manifests)
│   ├── kustomization.yaml
│   ├── quill-api-deployment.yaml
│   ├── quill-api-service.yaml
│   ├── quill-mcp-deployment.yaml
│   ├── quill-mcp-service.yaml
│   ├── quill-portal-deployment.yaml
│   ├── quill-portal-service.yaml
│   ├── quill-hpa.yaml
│   ├── quill-networkpolicy.yaml
│   └── quill-service-networkpolicies.yaml
├── cloudflared/
│   └── cloudflared.yaml        # Tunnel Deployment + ConfigMap (namespace `cloudflared`)
└── mosiac/                     # Mosiac server
    ├── kustomization.yaml
    ├── mosiac-deployment.yaml
    ├── mosiac-service.yaml
    └── mosiac-networkpolicy.yaml
```

## Namespace

All app manifests deploy to the `maplespike` namespace. `cloudflared` runs in
its own `cloudflared` namespace (must carry label
`app.kubernetes.io/name: cloudflared` for the API NetworkPolicy).

## Applying

```bash
# CANONICAL: generate + apply from Nix (single command)
nix build .#saas-manifests -L
kubectl apply -f result/manifests.yaml

# Convenience app (same thing)
nix run .#deploy-saas

# Kustomize reference path (dev only — the Nix bundle is canonical for prod)
kubectl apply -k k8s/maplespike/
kubectl apply -k k8s/mosiac/
```

## Services

| Service        | Type       | Port | ClusterIP (pinned)  | Image tag (flake.nix)     |
|----------------|------------|------|---------------------|---------------------------|
| quill-api      | ClusterIP  | 8082 | 10.43.100.10        | nexus:5000/quill-api:2026-08-10-3 |
| quill-mcp      | ClusterIP  | 3001 | 10.43.100.11        | nexus:5000/quill-mcp:2026-08-10-3 |
| quill-portal   | ClusterIP  | 8080 | 10.43.100.12        | nexus:5000/quill-portal:2026-08-10 |
| mosiac-server  | ClusterIP  | 8080 | dynamic             | nexus:5000/mosiac-server:latest |

> The ClusterIPs are **pinned** because cloudflared dials literal IPs (NOT DNS
> names — its Go resolver NXDOMAINs `*.svc.cluster.local` → edge 502s). Update
> the pins in BOTH `k8s/maplespike/*-service.yaml` AND `nix/saas-manifests.nix`
> + the `cloudflared-config` ConfigMap whenever they change. The cluster's
> `deny-latest-tag-deployments` admission policy forbids `:latest` for the
> quill-* services.

## Autoscaling

quill-api and quill-portal have HPA manifests (`quill-hpa.yaml`) with
minReplicas 2 / maxReplicas 6 / targetCPU 70%. NOTE: the metrics server has
been flaky on this cluster (see k3s etcd/encryption incident 2026-08-10); the
Nix manifests pin `replicas: 1` as the safe default.

## Network Policies

- **quill-network-policy**: Restricts ingress to quill-api pods from the
  `cloudflared` namespace. Allows DNS (port 53) and HTTP/S (80/443) egress.
- **quill-service-networkpolicies**: quill-mcp + quill-portal NetworkPolicies.
- **gnp-default-deny.yaml** (cluster-scoped, applied separately — NOT in the
  kustomization): default-deny-enforced GlobalNetworkPolicy with allows for
  pod/svc/CGNAT CIDRs, ports 30080/80/30443/443/6443/53, plus TCP+UDP 7844
  for the cloudflared edge. This file is `builtins.readFile`-d by
  `nix/saas-manifests.nix` (single source of truth).
- **mosiac-network-policy**: Restricts ingress to mosiac pods from the
  `maplespike` namespace. Allows DNS egress.

## Images

All container images are hosted on the local registry at `nexus:5000`.
Images are rebuilt and pushed via the Nix path:

```bash
nix run .#push-images    # defaults REGISTRY=nexus:5000 TAG=stable COMMIT=<sha>
```

GHCR push is RETIRED (2026-07-10 flip) — see docs/GHCR-CLEANUP.md.
