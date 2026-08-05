# Archived Helm chart — do not use

**Moved here in #825 (DRY consolidation).** This chart was a third, parallel
description of the `maplespike` namespace (Deployments, Services, cloudflared,
Secrets) that had diverged from the kustomize source: it lacked probes entirely,
used a third secret name (`quill-secrets`), and used a `stable` image tag.

**The single source of truth is `k8s/maplespike/` (kustomize).** Deploy via:

```sh
kubectl apply -k k8s/maplespike/
# or, from Nix (same output):
nix run .#saas-manifests | kubectl apply -f -
```

If this chart is ever needed again (e.g. for external users wanting a Helm
install), it must be regenerated FROM `k8s/maplespike/` (helmize the kustomize
output), not hand-maintained — that is what caused the drift.
