# Design: Workload-side Reloader trigger

## Data flow

`media-k8s` `quill-staging` Application `valuesObject`
  → `charts/quill/templates/deployments.yaml` (API Deployment metadata)
  → stakater/reloader watches the Deployment and the referenced Secret
  → Secret data change (from ESO) triggers a pod rollout.

## Security

No secret value enters the chart or git. The annotation contains only a key name
and boolean. Production has no annotation because the value defaults to empty.

## Rollout

Chart change lands on `main` first. Separately, staging's `valuesObject` sets the
annotation. ArgoCD re-renders the API Deployment and Reloader rolls the pod on
the next Secret change. No image rebuild or re-pin is needed: no image digest or
port changes.

## Rollback

Remove `api.deploymentAnnotations` from staging `valuesObject`. To disable the
chart value entirely, revert the template block; the default `{}` renders nothing.
