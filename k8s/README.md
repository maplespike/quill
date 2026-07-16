# MapleSpike Kubernetes Manifests

This directory contains the Kubernetes manifests for deploying
the MapleSpike suite on the homelab k3s cluster (`nexus`).

## Structure

```
k8s/
├── README.md                   # This file
├── maplespike/                 # Core MapleSpike services
│   ├── kustomization.yaml
│   ├── quill-api-deployment.yaml
│   ├── quill-api-service.yaml
│   ├── quill-mcp-deployment.yaml
│   ├── quill-mcp-service.yaml
│   ├── quill-portal-deployment.yaml
│   ├── quill-portal-service.yaml
│   ├── quill-hpa.yaml
│   └── quill-networkpolicy.yaml
└── mosaic/                     # Mosaic server
    ├── mosaic-deployment.yaml
    ├── mosaic-service.yaml
    └── mosaic-networkpolicy.yaml
```

## Namespace

All manifests deploy to the `maplespike` namespace.

## Applying

```bash
# Apply everything with kustomize
kubectl apply -k k8s/maplespike/
kubectl apply -k k8s/mosaic/   # if mosaic/ has kustomization.yaml

# Or apply individual files
kubectl apply -f k8s/maplespike/quill-api-deployment.yaml
```

## Services

| Service        | Type       | Port | Replicas | Image                           |
|----------------|------------|------|----------|---------------------------------|
| quill-api      | ClusterIP  | 8082 | 2        | nexus:5000/quill-api:latest     |
| quill-mcp      | ClusterIP  | 3001 | 2        | nexus:5000/quill-mcp:latest     |
| quill-portal   | ClusterIP  | 8080 | 2        | nexus:5000/quill-portal:latest  |
| mosaic-server  | ClusterIP  | 8080 | 1        | nexus:5000/mosaic-server:latest |

## Autoscaling

quill-api and quill-portal each have an HPA configured with:
- minReplicas: 2
- maxReplicas: 6
- targetCPUUtilizationPercentage: 70

## Network Policies

- **quill-network-policy**: Restricts ingress to quill-api pods from the
  cloudflared namespace. Allows DNS (port 53) and HTTP/S (80/443) egress.
- **mosaic-network-policy**: Restricts ingress to mosaic pods from the
  maplespike namespace. Allows DNS egress.

## Images

All container images are hosted on the local registry at `nexus:5000`.
Images are rebuilt and pushed via the CI/CD pipeline (`build-push.yml`).

## HPA

To verify HPA status after deployment:

```bash
kubectl -n maplespike get hpa
kubectl -n maplespike describe hpa quill-api-hpa
```
