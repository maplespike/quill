---
last-reviewed: 2026-09-21
status: active
---

# Image pinning — Quill production

Every Quill workload runs a **digest-pinned** image from the node containerd
store. No workload runs a mutable tag. This page states the rule, the one
command that applies it, and the check that enforces it.

Gate: **A3-IMAGEPIN** (issue #755, ledger `GATES-gaps-20260922.md`).

## The rule

1. `charts/quill/values-prod.yaml` pins each image in `images.<svc>` —
   `api`, `mcp`, `portal`, and `ingest` (the CronJob runner): `digest` (the pin)
   plus `tag` (the immutable build tag it was read from).
2. The chart renders `<registry>/quill-<svc>@sha256:<digest>`. See
   `templates/_helpers.tpl` → `quill.image`. The ingest CronJobs use the same
   helper, so no chart-wide tag can leave their reference blank.
3. `image.pullPolicy` is `Never`. The image must already exist in the node
   containerd store. A network pull is a bug, not a fallback.
4. Every workload with `imagePullPolicy: Never` needs a node pin
   (`nodeName` / `nodeSelector`), because the store is per node. Today all
   Quill pods pin `nexus`.
5. Third-party images (postgres, cloudflared) must be digest- or
   version-pinned. Never `:latest`, `:stable`, `:local`.

## Why

Production used to pin `docker.io/library/quill-*:local` with
`imagePullPolicy: Never`. `:local` is a mutable tag rebuilt in place. Two
failures follow:

- A rebuilt tag can serve the previous build's layers. Nothing detects it.
- Nothing in git says which build is live.

A digest cannot be re-pointed. A rollout either runs that exact content or
fails loudly. The `tag` field records the build identity in git, and the chart
stamps it on the pod template as `quill.maplespike.ca/image-build-tag`.

## Apply a pin

Run the script on the node that holds the store (default `nexus`; the script
refuses to run anywhere else). It builds, imports, registers the digest name
kubelet needs, and prints the block for `values-prod.yaml`:

```bash
ssh nexus 'cd ~/quill-build && scripts/pin-images.sh'              # build from HEAD
ssh nexus 'cd ~/quill-build && scripts/pin-images.sh --existing'   # re-pin the current image, no build
ssh nexus 'cd ~/quill-build && scripts/pin-images.sh --svc mcp'    # one service
```

Then commit the printed `images:` block. ArgoCD renders `charts/quill` +
`values-prod.yaml` from `main`; never `kubectl set image` by hand.

The script reads each digest back from the store. A typo therefore cannot
create a pin that points at content the node does not have.

## Verify

```bash
# Gate (rendered + live read-back + store resolvability):
bash scripts/gates-run.sh A3          # expects: A3 PASS

# Chart only (no cluster, this is the CI gate):
node scripts/gates/check-image-pins.mjs --values charts/quill/values-prod.yaml

# Live refs against values-prod.yaml:
node scripts/gates/check-image-pins.mjs --values charts/quill/values-prod.yaml --live

# Read the live references directly:
kubectl -n maplespike get deploy -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[*].image}{"\n"}{end}'
```

CI runs the chart check and `scripts/test-image-pins.mts`
(`pnpm run test:pins`) on every push to `main` and `prod`.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Pod stuck `ErrImageNeverPull` | The digest name is absent from that node's store, or the pod scheduled onto a node without the store | Run `pin-images.sh` on the node, and keep the `nodeName: nexus` pin |
| Pod stuck `InvalidImageName` | The reference has no tag and no digest — an empty chart-wide `image.tag` left `quill-ingest:` behind on 2026-09-22 | Pin the workload in `images.<svc>` and render it with the `quill.image` helper |
| `A3 FAIL: … does not match the pinned digest` | A live deployment drifted from `values-prod.yaml` | Commit the intended pin; let ArgoCD sync |
| Rollout stalls, old pod keeps serving | New digest is not resolvable | `maxUnavailable: 0` keeps the old pod up. Fix the store, push again |

Rollback: revert the `images:` block to the previous commit's digests. The
store keeps old images, so the reverted digest still resolves.

## Notes

- Re-importing the same layers with a different tag name creates a new OCI
  index digest. Pin what is in the store today, not what a rebuild would
  produce. `pin-images.sh --existing` does that.
- `ctr images tag --force <image> <repo>@<digest>` accepts any well-formed
  digest, so always read the digest from `ctr images ls` — never type it.
