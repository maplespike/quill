# 0010 — secretKeyRef optional policy: required refs fail the gate, protected optional refs warn

**Status:** ACCEPTED (2026-09-23)
**Date:** 2026-09-23
**Last-reviewed:** 2026-09-23
**Owner:** j_kro
**Driver:** t_a56dfa27 (ops). The secret-lockstep gate (`scripts/check-secret-lockstep.sh`) was built after the 2026-08-15 incident (key-name drift on `jwtSecret` → api pods crash-looping on "JWT_SECRET must be set in production"). The chart marked every sync-owned `secretKeyRef` `optional: true`, so the gate could only warn on the exact failure class it was built to prevent — a negative control replay of the incident passed the gate with exit 0.

## Decision

**Option (b) from t_a56dfa27, implemented as commit 9866f556.** In `charts/quill/templates/**`, drop `optional: true` from secretKeyRefs that are load-bearing for auth or billing. The existing required-ref logic then catches drift for those keys — the gate fails CI instead of warning. Refs kept optional are only those where the consumer genuinely degrades without the secret.

- Required (fail on drift): `jwtSecret`, `apiKey`, `githubClientId`, `githubClientSecret`, `internalJwtSecret`, `pii-hash-secret`, `quill-billing-secret`, `stripe-secret-key`, `stripe-webhook-secret` (quill-secrets + maplespike-secrets in deployments.yaml).
- Kept optional (warn on drift): `opencorporatesApiKey` — quill cronjob ref; a missing key degrades one enrichment pipeline, not the job.

`optional: true` protects the **pod** from crash-at-mount, not the **app** from refusing to boot with an empty secret. The 2026-08-15 and 2026-09-21 incidents were both app-level failures (missing env → auth broken or crash-loop), so the protection has to sit at the required-ref layer for the keys the app enforces.

## Consequences

- The gate now reports 11 required + 1 optional refs against the 9-key MAPPING table, and fails on any required-key drift.
- Pods in dev/self-host that lack the secret block scheduling (CreateContainerConfigError) instead of booting with silently-broken auth — loud failure at schedule time is the intended behavior.
- `charts/quill/values-prod.yaml` carries the policy rationale as a comment next to the credentials block.
- If a future secret is sync-owned but genuinely degradable, it gets `optional: true` and warns; the policy is per-ref, not a blanket rule.

## Alternatives considered

- **(a) Fail on optional-ref drift for a protected key list** — rejected as redundant state: the ref's optional flag and a protected-key list encode the same fact twice, and the chart is the source of truth. Dropping `optional: true` is one edit per ref, not a second list to keep in sync.
- **(c) Keep warn-only and document that the gate no longer guards the original incident class** — rejected: this is the status quo the 2026-08-15 incident exposed as broken. The gate's purpose is to make key-name drift a build failure; warn-only makes it advisory.
