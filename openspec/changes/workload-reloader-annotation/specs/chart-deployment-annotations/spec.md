# Spec: Chart deployment annotations

## Requirement 1 — default rendering

Given a render with `charts/quill/values-prod.yaml`,
when the API Deployment is rendered,
then it has no `reloader.stakater.com` annotation.

## Requirement 2 — explicit workload annotation

Given a values file setting `api.deploymentAnnotations` to
`{"reloader.stakater.com/auto": "true"}`,
when the API Deployment is rendered,
then the annotation appears under `metadata.annotations`
and does not appear under `spec.template.metadata.annotations`.

## Requirement 3 — gate

Given the chart test suite,
when `pnpm run test:chart-reloader` runs,
then both requirements are asserted against actual `helm template` output.
