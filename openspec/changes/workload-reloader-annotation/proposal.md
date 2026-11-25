# Proposal: Workload-side Reloader trigger for the Quill API Deployment

## Problem

Quill staging delivers Stripe test keys from Bitwarden Secrets Manager into the
`maplespike-secrets` Secret via an ExternalSecret. The 2026-11-22 fix put
`reloader.stakater.com/auto: "true"` in the ExternalSecret target template, so
the annotation landed on the Secret. Reloader reads trigger annotations from
workload metadata, not from Secrets. Measured 2026-11-23: ESO `Ready=True`,
annotation present on the Secret, `reloader_reload_executed_total` at 0, and the
staging API pod kept its old ReplicaSet. The annotation was inert.

## Root cause

The chart has no value that renders annotations on the API Deployment metadata.
`quill.imageAnnotations` writes only `quill.maplespike.ca/image-build-tag` to the
pod template. A Secret-side trigger cannot substitute for a workload-side one.

## Proposed fix

Add `api.deploymentAnnotations` (default `{}`) to `charts/quill/values.yaml` and
render it under the API Deployment's `metadata.annotations`. Production rendering
stays unchanged because the default is empty. Staging sets the Reloader trigger
through the existing `valuesObject` in `media-k8s/helm/apps/quill-staging.yaml`.

Add `scripts/test-chart-reloader.mts` to assert the annotation renders on the
Deployment metadata and not on the pod template, and include it in `pnpm test`.

## Affected packages and boundaries

- `charts/quill` only. No API, MCP, or portal contract changes. No new dependency.
- No image rebuild: this is a chart metadata change, so the existing pinned
  digests remain valid.

## Verification

- `helm template` with default values: no reloader annotation.
- `helm template` with `api.deploymentAnnotations.reloader.stakater.com/auto=true`:
  annotation under Deployment `metadata.annotations`, absent from the pod template.
- The two new tests pass.
- After merge: ArgoCD `quill-staging` renders the annotation; the pod rolls; a
  subsequent key rotation rolls it again without a manual restart.
