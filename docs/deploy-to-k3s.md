---
last-reviewed: 2026-09-17
status: active
---

# Deploying MapleSpike (Quill) to Your Own K3s Cluster

This guide walks through deploying MapleSpike on a **K3s cluster** — the same
deployment model used in production. All backend data stays on your own
infrastructure with zero external cloud spend.

> **Nix-first:** all container images, the SaaS K8s manifests, the one-touch
> self-host units, and the bare-metal NixOS module are generated from the
> repository's `flake.nix`. Non-Nix installers also ship: **`docker-compose.yml`**
> at the repo root for Docker / Podman Compose users, and **`render.yaml`** for
> zero-config Render.com Blueprint deploys. The Helm chart in `charts/quill/`
> is a parallel k8s option for clusters that prefer Helm over the Nix-generated
> manifests.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Build the Images (Nix)](#build-the-images-nix)
3. [Push Images to a Registry](#push-images-to-a-registry)
4. [Deploy — Generated Manifests](#deploy--generated-manifests)
5. [Configuration Reference](#configuration-reference)
6. [Verify the Deployment](#verify-the-deployment)
7. [Alternative — One-Touch Self-Host](#alternative--one-touch-self-host-podman-quadlets)
8. [Maintenance](#maintenance)
9. [Production Redeploy — Registry-Free Operator Flow (Nexus)](#production-redeploy--registry-free-operator-flow-nexus)

---

## Prerequisites

| Tool     | Purpose                                | Required |
|----------|----------------------------------------|----------|
| `k3s`    | Lightweight Kubernetes cluster         | Yes      |
| `kubectl`| Interact with the cluster              | Yes      |
| Nix       | Build images + render manifests        | Yes      |
| `podman` | Load/push OCI images                   | Yes      |

### Install K3s (if you don't have one)

```bash
# Single-node K3s (default)
curl -sfL https://get.k3s.io | sh -

# Multi-node: run on each agent
curl -sfL https://get.k3s.io | K3S_URL=https://<server>:6443 K3S_TOKEN=<token> sh -

# Verify
kubectl get nodes
```

K3s ships `kubectl` built in; the kubeconfig is at `/etc/rancher/k3s/k3s.yaml`.

---

## Build the Images (Nix)

The flake builds **layered OCI images** via `pkgs.dockerTools`. No Docker
daemon required — the output is a `.tar.gz` you load into any OCI runtime.

| Attribute              | Service                | Port |
|------------------------|------------------------|------|
| `quill-api-image`      | REST API gateway       | 8082 |
| `quill-mcp-image`      | MCP protocol server (SSE) | 3001 |
| `quill-portal-image`   | Static developer portal | 8080 |
| `quill-ingest-image`   | Pipeline runner (CronJob) | —  |
| `quill-engine-image`   | Sweep/engine runner    | —    |

```bash
# One image
nix build .#quill-api-image -L

# All runtime images
nix build .#quill-api-image .#quill-mcp-image .#quill-portal-image -L
```

The result is a tarball in `result/`. Load it into podman (or your runtime):

```bash
podman load < result
```

> **Note:** the build runs `pnpm install` + `pnpm build`, which needs network
> access. On a Nix daemon with `sandbox = true`, build with
> `nix build … --option sandbox false` (or set `sandbox = false` in
> `/etc/nix/nix.conf`).

---

## Push Images to a Registry

The images are tagged `quill-<svc>:latest` locally after `podman load`. Push
them to a registry your cluster can pull from (production uses the local
`registry` — see `docs/GHCR-CLEANUP.md` for the retired GHCR path):

```bash
REGISTRY=registry.example.com TAG=stable \
  nix run .#push-images
```

`push-images` tags and pushes `quill-api`, `quill-mcp`, `quill-portal` (as
well as `ingest`/`engine` if built) to
`$REGISTRY/quill-<svc>:$TAG`.

> **Pinned tags, not `latest`:** the generated manifests reference the
> per-service image tags baked into `flake.nix` (the `saas-manifests` package's
> `apiTag`/`mcpTag`/`portalTag`). If your cluster runs the
> `deny-latest-tag-deployments` admission policy (as the Quill production
> cluster does), `:latest` in a Deployment is rejected — pin concrete tags.
> To point the manifests at your own pushed tags, override the parameters when
> calling `saasManifests` in `flake.nix`.

For a **single-node / air-gapped** cluster you can skip the registry: load the
images directly onto the node and set `imagePullPolicy: Never` in the
manifests (see below).

---

## Deploy — Generated Manifests

The SaaS K8s manifests are **generated from Nix** (`nix/saas-manifests.nix`)
and match the live cloudflared-routed cluster. They produce the `maplespike`
namespace, `cloudflared` Deployment + ConfigMap, the three service
Deployments + Services, and the LAN Traefik Ingress.

The image registry/tag and public domain are parameters — pass them via the
flake or override the `saas-manifests` package's `registry`/`tag`/`domain`.

```bash
# Generate → result/manifests.yaml
nix build .#saas-manifests -L

# Apply (namespace maplespike is created by the manifest)
kubectl apply -f result/manifests.yaml

# Or one-shot (tag comes from $TAG, default stable):
TAG=stable nix run .#deploy-saas
```

The generated manifest uses these Service names:

| Service        | Port | Purpose            |
|----------------|------|--------------------|
| `quill-api`    | 8082 | REST API gateway   |
| `quill-mcp`    | 3001 | MCP server (SSE)   |
| `quill-portal` | 8080 | Developer portal   |

> The production cluster pins its Service ClusterIPs (cloudflared dials IPs directly).
> because cloudflared dials literal IPs, not DNS names — cloudflared's Go
> resolver NXDOMAINs `*.svc.cluster.local`, which regresses the tunnel to edge
> 502s. If you change the Service specs, update the `cloudflared-config`
> ConfigMap upstreams to match. `nix run .#deploy-saas` is idempotent for the
> generated resources.

### Ingress

The generated manifest includes a LAN Traefik Ingress (`maplespike-lan`) for
`*.maplespike.lan`, plus a `cloudflared` tunnel for `*.maplespike.ca`. For a
standalone deployment you can point your own ingress controller at the three
ClusterIP Services (`quill-api:8082`, `quill-mcp:3001`, `quill-portal:8080`).

---

## Configuration Reference

### Environment variables

| Variable         | Default                | Description                       |
|------------------|------------------------|-----------------------------------|
| `NODE_ENV`       | `production`           | Runtime mode                      |
| `PORT`           | `8082` (api) / `3001` (mcp) / `8080` (portal) | HTTP listen port |
| `QUILL_API_URL`  | —                      | Base URL of the API server (mcp)  |
| `QUILL_API_KEY`  | —                      | API key for server-to-server auth |
| `QUILL_STORAGE`  | `sqlite`               | Storage backend: `memory`/`sqlite`/`postgres` |
| `QUILL_DB_PATH`  | `/data/maplespike.db`  | SQLite file path (when `sqlite`)  |
| `JWT_SECRET`     | —                      | Secret for JWT token signing      |

### Secrets

| Secret key    | Description                    | Required |
|---------------|-------------------------------|----------|
| `jwt-secret`  | JWT signing secret             | For API auth |
| `apiKey`      | API key for server auth        | Optional |

---

## Verify the Deployment

```bash
# All resources in the namespace
kubectl get all -n maplespike

# API health
kubectl port-forward -n maplespike svc/quill-api 8082:8082 &
curl http://localhost:8082/v1/health

# MCP health
kubectl port-forward -n maplespike svc/quill-mcp 3001:3001 &
curl http://localhost:3001/health

# Portal
kubectl port-forward -n maplespike svc/quill-portal 8080:8080 &
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
```

```bash
# Logs
kubectl logs -n maplespike -l app=quill-api --tail=50
kubectl logs -n maplespike -l app=quill-mcp --tail=50
kubectl logs -n maplespike -l app=quill-portal --tail=50
```

---

## Alternative — One-Touch Self-Host (Podman Quadlets)

If you don't want a full K3s cluster, the same three images run as **Podman
Quadlet systemd units** on a single machine:

```bash
# Build images, install quadlet units, start (API 8082 / MCP 3001 / Portal 8080)
./selfhost.sh up

# Or via Nix app
nix run .#selfhost up
```

Other commands: `./selfhost.sh down` (stop + disable),
`./selfhost.sh logs` (tail all three), `./selfhost.sh status` (health check).

This is the documented path for a workstation or a single homelab box — it
requires only `podman` + systemd, no Kubernetes.

A bare-metal **NixOS** host can also run the services declaratively via the
`services.maplespike` module (see `nix/default.nix`):

```nix
{ services.maplespike.enable = true; }
```

---

## Maintenance

### Updating the deployment

```bash
# Rebuild images
nix build .#quill-api-image .#quill-mcp-image .#quill-portal-image -L

# Load + push
podman load < result
REGISTRY=registry.example.com TAG=stable nix run .#push-images

# Regenerate manifests (image tag comes from the flake's saas-manifests params)
nix build .#saas-manifests -L
kubectl apply -f result/manifests.yaml

# Roll out
kubectl rollout restart deployment/quill-api deployment/quill-mcp deployment/quill-portal -n maplespike
```

---

## Production Redeploy — Registry-Free Operator Flow (Nexus)

> **The platform of record is K3s.** Docker and Podman appear in this repo only
> as build-time tooling or as *self-host product* paths (Compose, Quadlets).
> The production runtime is the K3s **containerd** store on `nexus` — images go
> straight into containerd; no registry is involved.

This is the flow the Quill production cluster actually runs (verified live
2026-09-17). It assumes: the cluster runs on `nexus`, deployments carry
`nodeName: nexus` pins for image locality, and `kubectl` points at that cluster.

### 1. Sync + build (on the build host, not a workstation)

```bash
rsync -a --exclude node_modules --exclude dist --exclude .git \
  <checkout>/ nexus:~/quill-build/

ssh nexus 'cd ~/quill-build && \
  npx pnpm@10.32.1 install --frozen-lockfile --ignore-scripts && \
  npx pnpm@10.32.1 -r build'
```

Build the FULL workspace (`-r build`), not only the portal: the portal's
`gen:plans` step reads the live MCP `/health` endpoint and `gen:all` reads the
`quill-mcp` dist. On a stale dist the docs catalog disagrees with the live tool
count and the smoke test fails — by design.

### 2. Gate: smoke test

```bash
ssh nexus 'cd ~/quill-build && node packages/portal/scripts/smoke-test-dist.mjs'
# must print: All assertions passed.
```

Do not import or roll out a build that fails the smoke test.

### 3. Build images (docker = builder only) + import into K3s containerd

One command builds, imports, registers the digest name kubelet resolves with
`imagePullPolicy: Never`, and prints the pin block:

```bash
ssh nexus 'cd ~/quill-build && scripts/pin-images.sh'
# --existing re-pins the image already in the store without rebuilding.
```

Paste the printed `images:` block into `charts/quill/values-prod.yaml` and
commit it. Full rule set and failure modes: [docs/IMAGE-PINNING.md](./IMAGE-PINNING.md)
(gate A3-IMAGEPIN / #755).

### 4. Roll out (pods stay on nexus)

```bash
# ArgoCD renders charts/quill + values-prod.yaml from main. Commit, then let the
# automated sync run (or trigger it):
kubectl -n argocd patch app quill --type merge \
  -p '{"operation":{"initiatedBy":{"username":"operator"},"sync":{"revision":"main"}}}'

kubectl -n maplespike rollout status deployment/quill-api    --timeout=120s
kubectl -n maplespike rollout status deployment/quill-mcp    --timeout=120s
kubectl -n maplespike rollout status deployment/quill-portal --timeout=120s
```

If a new pod lands on another node it fails with `ErrImageNeverPull` — images
are imported per-node, so the chart carries a `nodeName: nexus` pin for api, mcp
and portal. Keep that pin while the cluster has no registry.

### 5. Verify

```bash
kubectl -n maplespike port-forward deployment/quill-mcp 13001:3001 &
curl -s http://127.0.0.1:13001/health                     # {"tools": <canon>}

kubectl -n maplespike port-forward deployment/quill-portal 18080:8080 &
curl -s http://127.0.0.1:18080/.well-known/mcp/server-cards.json   # moduleCount
curl -s http://127.0.0.1:18080/agent-card.json                     # counts.modules
```

Public checks (through the Cloudflare Tunnel):

```bash
curl -s https://mcp.maplespike.ca/health
curl -s https://quill.maplespike.ca/.well-known/mcp/server-cards.json
```

### Ordering rule

Rebuild **MCP before the portal**. The portal's `gen:plans` fetches
`https://mcp.maplespike.ca/health` for its tools count, so an older deployed MCP
image poisons the portal's stats — exactly the cluster-vs-repo drift the smoke
test catches.
