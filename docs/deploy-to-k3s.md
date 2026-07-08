---
last-reviewed: 2026-06-12
status: active
---

# Deploying MapleSpike to Your Own K3s Cluster

This guide walks through deploying MapleSpike on a **K3s cluster** — the same deployment model used in production. All backend data stays on your own infrastructure with zero external cloud spend.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Cluster Requirements](#cluster-requirements)
3. [Build Container Images](#build-container-images)
4. [Option A — Helm Chart (Recommended)](#option-a--helm-chart-recommended)
5. [Option B — Manual Manifests](#option-b--manual-manifests)
6. [Configuration Reference](#configuration-reference)
7. [Verify the Deployment](#verify-the-deployment)
8. [Ingress Setup](#ingress-setup)
9. [Monitoring](#monitoring)
10. [Maintenance](#maintenance)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool    | Purpose                              | Required |
|---------|--------------------------------------|----------|
| `k3s`   | Lightweight Kubernetes cluster       | Yes      |
| `kubectl` | Interact with the cluster          | Yes      |
| `helm`  | Deploy via chart (recommended)       | Option A |
| `docker` or `podman` | Build images              | Yes      |
| `pnpm`  | Build the monorepo                   | If building from source |

### Install K3s (if you don't have one)

```bash
# Single-node K3s (default)
curl -sfL https://get.k3s.io | sh -

# Multi-node: run on each agent
curl -sfL https://get.k3s.io | K3S_URL=https://<server>:6443 K3S_TOKEN=<token> sh -

# Verify
kubectl get nodes
```

K3s comes with `kubectl` built in; the kubeconfig is at `/etc/rancher/k3s/k3s.yaml`.

---

## Cluster Requirements

| Resource     | Minimum   | Recommended |
|-------------|-----------|-------------|
| CPU         | 2 cores   | 4+ cores    |
| RAM         | 4 GB      | 8+ GB       |
| Disk        | 20 GB     | 50+ GB      |
| StorageClass | Any (default `local-path`) | Fast SSD |

The cluster **must have**:
- A **default StorageClass** (K3s ships `local-path` by default) for PostgreSQL PVCs
- **DNS resolution** between pods (K3s includes CoreDNS)

### Check readiness

```bash
kubectl get nodes -o wide
kubectl get storageclass
kubectl get pods -n kube-system
```

---

## Build Container Images

MapleSpike's Dockerfile produces **four** runtime targets from a single multi-stage build:

| Target       | Description                          | Port |
|-------------|--------------------------------------|------|
| `api-server` | REST API gateway (auth, rate limits) | 8082 |
| `quill-mcp` | MCP protocol server (SSE transport)  | 3001 |
| `portal`     | Static developer portal              | 8080 |
| `ingestion`  | Pipeline runner (CronJob)            | —    |

### 1. Clone the repository

```bash
git clone git@github.com:reverb256/maplespike.git
cd maplespike
```

### 2. Build images

```bash
# API Server
docker build --target api-server -t quill-api:latest .

# MCP Server
docker build --target quill-mcp -t quill-mcp:latest .

# Portal (static HTML)
docker build --target portal -t quill-portal:latest .

# Ingestion (CronJob runner)
docker build --target ingestion -t quill-ingest:latest .
```

> **Tip for K3s single-node**: If building on the same node, `docker save` + `docker import` is optional — use `k3s ctr images import` or set `imagePullPolicy: Never` with `localhost/` image names in the manifests.

### 3. Push to a registry (for multi-node clusters)

```bash
# Tag for your registry
docker tag quill-api:latest registry.example.com/quill-api:latest

# Push
docker push registry.example.com/quill-api:latest
# ... repeat for quill-mcp, portal, ingestion
```

---

## Option A — Helm Chart (Recommended)

The Helm chart deploys all components together with a single command.

### 1. Install the chart

```bash
# From the repo root
helm install maplespike ./charts/maplespike \
  --namespace maplespike \
  --create-namespace \
  --set image.registry=ghcr.io/reverb256 \
  --set image.tag=latest \
  --set secrets.apiKey="your-api-key" \
  --set secrets.jwtSecret="your-jwt-secret" \
  --set secrets.dbPassword="your-db-password"
```

### 2. Override for your registry

If you built custom images:

```bash
helm install maplespike ./charts/maplespike \
  --namespace maplespike \
  --create-namespace \
  --set image.registry=registry.example.com \
  --set image.tag=latest \
  --set image.pullPolicy=Always \
  --set secrets.apiKey="..." \
  --set secrets.jwtSecret="..." \
  --set secrets.dbPassword="..."
```

### 3. Override for local / air-gapped images

When images are already on the node and you want `imagePullPolicy: Never`:

```bash
helm install maplespike ./charts/maplespike \
  --namespace maplespike \
  --create-namespace \
  --set image.registry=localhost \
  --set image.tag=latest \
  --set image.pullPolicy=Never \
  --set secrets.apiKey="..." \
  --set secrets.jwtSecret="..." \
  --set secrets.dbPassword="..."
```

### 4. Advanced — production values

Use the production values file as a base and override what you need:

```bash
helm upgrade --install maplespike ./charts/maplespike \
  -n maplespike \
  -f ./charts/maplespike/values-prod.yaml \
  --set image.registry=registry.example.com \
  --set secrets.apiKey="..." \
  --set secrets.jwtSecret="..." \
  --set secrets.dbPassword="..." \
  --set database.storage=10Gi
```

### What the chart deploys

| Resource                    | Kind         | Notes                            |
|-----------------------------|--------------|----------------------------------|
| `quill-api`             | Deployment   | REST API gateway                 |
| `quill-mcp`             | Deployment   | MCP protocol server              |
| `quill-portal`          | Deployment   | Developer portal (static site)   |
| `quill-db`              | StatefulSet  | PostgreSQL 17 (Alpine)           |
| `quill-ingest-<name>`   | CronJob × 22 | One CronJob per pipeline         |
| `maplespike-secrets`         | Secret       | API key, JWT secret              |
| `quill-db-secret`       | Secret       | DB user, password, database name |
| `quill-api` (svc)       | Service      | ClusterIP / NodePort 31283       |
| `quill-mcp` (svc)       | Service      | ClusterIP / NodePort 31745       |
| `quill-portal` (svc)    | Service      | ClusterIP / NodePort 30964       |
| `quill-db` (svc)        | Service      | ClusterIP :5432                  |

### Uninstall

```bash
helm uninstall maplespike -n maplespike
kubectl delete namespace maplespike
```

> PVCs for PostgreSQL are **not** deleted by `helm uninstall`. Remove them manually if needed:
> ```bash
> kubectl delete pvc -n maplespike -l app=quill-db
> ```

---

## Option B — Manual Manifests

If you prefer not to use Helm, apply the individual manifests from `k8s/manual/`.

### 1. Create namespaces

```bash
kubectl apply -f k8s/manual/00-namespace.yaml
```

### 2. Deploy the API server

```bash
kubectl apply -f k8s/manual/10-api-deploy.yaml
```

### 3. Deploy the MCP server

```bash
kubectl apply -f k8s/manual/11-mcp-deploy.yaml
```

### 4. Deploy the ingestion CronJob

```bash
kubectl apply -f k8s/manual/20-cronjob.yaml
```

### 5. (Optional) Manually create secrets

```bash
kubectl create secret generic maplespike-secrets \
  -n maplespike \
  --from-literal=apiKey="your-api-key" \
  --from-literal=jwtSecret="your-jwt-secret"

kubectl create secret generic quill-db-secret \
  -n maplespike \
  --from-literal=postgres-user=maplespike \
  --from-literal=postgres-password="your-db-password" \
  --from-literal=postgres-database=maplespike
```

> The manual manifests in `k8s/manual/` are pre-configured for **development** (in-memory storage, no database). For production with PostgreSQL, use the Helm chart or adapt the manifests.

### 6. Verify everything is running

```bash
kubectl get all -n maplespike
```

---

## Configuration Reference

### Environment variables

| Variable                | Default              | Description                              |
|-------------------------|----------------------|------------------------------------------|
| `NODE_ENV`              | `production`         | Runtime mode                             |
| `PORT`                  | `8082` (api) / `3001` (mcp) | HTTP listen port                    |
| `QUILL_API_URL`    | —                    | Base URL of the API server               |
| `QUILL_API_KEY`    | —                    | API key for server-to-server auth        |
| `QUILL_STORAGE`    | `memory`             | Storage backend: `memory` or `postgres`  |
| `QUILL_DB_HOST`    | `quill-db`      | PostgreSQL hostname                      |
| `QUILL_DB_PORT`    | `5432`               | PostgreSQL port                          |
| `QUILL_DB_NAME`    | `maplespike`         | PostgreSQL database name                 |
| `QUILL_DB_USER`    | `maplespike`         | PostgreSQL user                          |
| `QUILL_DB_PASSWORD`| —                    | PostgreSQL password                      |
| `JWT_SECRET`            | —                    | Secret for JWT token signing             |
| `QUILL_PIPELINE`   | —                    | Pipeline name for ingestion CronJob      |
| `PROMETHEUS_PUSHGATEWAY`| —                    | Pushgateway URL for pipeline metrics     |

### Secrets to set

| Secret key          | Description                         | Required |
|--------------------|-------------------------------------|----------|
| `apiKey`           | API key for server authentication   | Optional |
| `jwtSecret`        | JWT signing secret                  | For API auth |
| `dbPassword`       | PostgreSQL password                 | For DB storage |
| `canliiApiKey`     | CanLII API key (ingestion only)     | For legal modules |
| `postgres-user`    | Database user (auto-generated)      | Auto      |
| `postgres-database`| Database name (auto-generated)      | Auto      |

Set secrets via Helm:

```bash
helm install maplespike ./charts/maplespike \
  --set secrets.apiKey="sk-..." \
  --set secrets.jwtSecret="$(openssl rand -hex 32)" \
  --set secrets.dbPassword="$(openssl rand -hex 16)"
```

Or via `kubectl`:

```bash
kubectl create secret generic maplespike-secrets \
  -n maplespike \
  --from-literal=apiKey="sk-..." \
  --from-literal=jwtSecret="$(openssl rand -hex 32)"
```

---

## Verify the Deployment

### Health check endpoints

```bash
# API health
kubectl port-forward -n maplespike svc/quill-api 8082:8082 &
curl http://localhost:8082/v1/health

# MCP health
kubectl port-forward -n maplespike svc/quill-mcp 3001:3001 &
curl http://localhost:3001/health
```

### Check pod logs

```bash
# API server
kubectl logs -n maplespike -l app=quill-api --tail=50

# MCP server
kubectl logs -n maplespike -l app=quill-mcp --tail=50

# A specific ingestion job
kubectl logs -n maplespike job/quill-ingest-committees-<job-id> --tail=50
```

### Test an API call

```bash
# Forward the port
kubectl port-forward -n maplespike svc/quill-api 8082:8082 &

# Make a request (no auth needed with default config)
curl -s http://localhost:8082/v1/health | jq .
```

### Check the CronJobs are scheduled

```bash
kubectl get cronjobs -n maplespike
```

The ingestion CronJobs run various Canadian government data pipelines on schedules defined in `values.yaml`. Each CronJob runs `quill-ingest` with the pipeline name in the `QUILL_PIPELINE` environment variable.

---

## Ingress Setup

MapleSpike uses a **Caddy ingress controller** in production. Any ingress controller that supports TLS termination will work.

### Example — Traefik (bundled with K3s)

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: maplespike-ingress
  namespace: maplespike
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  rules:
  - host: api.maplespike.example
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: quill-api
            port:
              number: 8082
  - host: mcp.maplespike.example
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: quill-mcp
            port:
              number: 3001
  - host: maplespike.example
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: quill-portal
            port:
              number: 8080
  tls:
  - hosts:
    - api.maplespike.example
    - mcp.maplespike.example
    - maplespike.example
    secretName: maplespike-tls
```

```bash
kubectl apply -f ingress.yaml
```

### Without an ingress — NodePort access

The Helm chart creates NodePort services by default:

| Service            | NodePort |
|-------------------|----------|
| `quill-api`  | 31283    |
| `quill-mcp`  | 31745    |
| `quill-portal` | 30964  |

Access services at `http://<node-ip>:<nodeport>`.

---

## Monitoring

MapleSpike exposes Prometheus metrics and is observable via the stack defined in `k8s/infra.nix` (Prometheus, Alertmanager, Loki, Promtail, Pushgateway). For a standalone deployment:

### Prometheus configuration

The config at `config/prometheus.yml` scrapes:

| Target                   | Endpoint            |
|--------------------------|---------------------|
| API server               | `:8082/v1/metrics`  |
| MCP server               | `:3001/metrics`     |
| Kubernetes CronJobs      | `localhost:10250`   |

### Pushgateway for ingestion metrics

Ingestion CronJobs push metrics to a Prometheus Pushgateway:

```yaml
env:
- name: PROMETHEUS_PUSHGATEWAY
  value: "http://prometheus-pushgateway.observability:9091"
```

Deploy a Pushgateway if you want ingestion metrics:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install pushgateway prometheus-community/prometheus-pushgateway \
  -n observability --create-namespace
```

---

## Maintenance

### Updating the deployment

```bash
# Build new images
docker build --target api-server -t quill-api:new-tag .
docker build --target quill-mcp -t quill-mcp:new-tag .
docker build --target portal -t quill-portal:new-tag .
docker build --target ingestion -t quill-ingest:new-tag .

# Push to registry
docker push registry.example.com/quill-api:new-tag
# ... repeat for other targets

# Upgrade Helm release
helm upgrade maplespike ./charts/maplespike -n maplespike \
  --set image.tag=new-tag
```

### Rolling restart

```bash
kubectl rollout restart deployment -n maplespike
```

### Database backups

The PostgreSQL StatefulSet uses a PVC. Back up with `pg_dump`:

```bash
kubectl exec -n maplespike deploy/quill-db-0 -- \
  pg_dump -U maplespike maplespike > maplespike-backup-$(date +%F).sql
```

### Viewing logs

```bash
# All pods in the namespace
stern -n maplespike .

# Specific deployments
kubectl logs -n maplespike -l app=quill-api -f
kubectl logs -n maplespike -l app=quill-mcp -f
```

---

## Troubleshooting

### Pods stuck in `Pending` or `CrashLoopBackOff`

```bash
kubectl describe pod -n maplespike <pod-name>
kubectl logs -n maplespike <pod-name>
```

Common causes:

| Symptom                       | Likely cause                                 | Fix                                               |
|-------------------------------|----------------------------------------------|---------------------------------------------------|
| `Pending` — no node fits      | Insufficient CPU/memory                      | Check node resources: `kubectl describe node`     |
| `CrashLoopBackOff` — API      | Missing `JWT_SECRET` or DB connection        | Set secrets; check `QUILL_STORAGE`           |
| `CrashLoopBackOff` — DB       | PVC not bound, missing StorageClass          | `kubectl get pvc -n maplespike`                   |
| `ImagePullBackOff`            | Image not found in registry                  | Check image name, tag, and registry credentials   |
| Ingestion CronJob not running | Wrong pipeline name                          | Check `QUILL_PIPELINE` env var               |
| MCP can't reach API           | Wrong `QUILL_API_URL`                   | Check service DNS: `http://quill-api:8082`   |

### Secrets not propagating

After updating a Secret, pods need to be restarted:

```bash
kubectl rollout restart deployment -n maplespike quill-api
```

### PVC stuck in `Pending`

```bash
kubectl get pvc -n maplespike
kubectl describe pvc -n maplespike data-quill-db-0
```

If the StorageClass doesn't exist:

```bash
# K3s default
kubectl get storageclass local-path
```

### Changing from `memory` to `postgres` storage

1. Deploy the PostgreSQL StatefulSet (included in the Helm chart)
2. Set `QUILL_STORAGE=postgres` and the DB env vars
3. Restart the API deployment

```bash
helm upgrade maplespike ./charts/maplespike -n maplespike \
  --set api.env.QUILL_STORAGE=postgres \
  --set api.env.QUILL_DB_HOST=quill-db \
  --set database.enabled=true
```

### Can't pull images from `ghcr.io/reverb256`

These are production images used by the live cluster at `maplespike.lan`. If you're deploying your own instance, either:

1. **Set up your own registry** and push images there, or
2. **Build locally** and use `imagePullPolicy: Never` with `localhost/` tags

Override the registry in Helm:

```bash
helm install maplespike ./charts/maplespike \
  --set image.registry=your-registry.example.com
```

---

## Reference

- [Architecture overview](./ARCHITECTURE.md)
- [K8s-Nix manifests](./K8S-NIX-MANIFESTS.md) — Nix-generated manifests (used in production)
- [CI/CD guide](./ci-cd.md) — GitHub Actions pipeline
- [Helm chart source](../charts/maplespike/)
- [Manual K8s manifests](../k8s/manual/)
- [Dockerfile](../Dockerfile) — multi-stage build
- [MapleSpike Helm Chart](https://github.com/reverb256/quill/tree/main/charts/maplespike)
- [NixOS config](https://github.com/reverb256/nixos-config) — Cluster NixOS configuration
