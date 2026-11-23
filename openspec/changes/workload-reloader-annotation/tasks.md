# Tasks: Workload-side Reloader trigger

- [x] Add `api.deploymentAnnotations` to `charts/quill/values.yaml`, default `{}`.
- [x] Render the value under the API Deployment `metadata.annotations`.
- [x] Add `scripts/test-chart-reloader.mts` with default and override cases.
- [x] Wire `test:chart-reloader` into `package.json`.
- [x] Record proposal, design, and spec.
- [ ] Set the trigger in `media-k8s` staging `valuesObject` after this change lands.
- [ ] Remove the inert Secret-side annotation from the staging ExternalSecret.
- [ ] Verify on the cluster: new ReplicaSet and a reload after a key change.
