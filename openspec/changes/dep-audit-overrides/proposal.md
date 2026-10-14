## Why

The workspace override set lags audited releases for undici, smol-toml, nodemailer, `@grpc/grpc-js`, source-map-js, fast-copy, and sharp.

## What Changes

- Raise those overrides in `pnpm-workspace.yaml`.
- Replace the nodemailer major pins with `nodemailer: ^10.0.16`.
- Refresh `pnpm-lock.yaml` to the new resolutions.
- Leave `http-cache-semantics` unpinned and unsuppressed.

## Capabilities

### New Capabilities

- `dependency-audit-overrides`: Audited override bumps with no suppression of an unfixed advisory.

## Impact

Lockfile and override metadata only. No application source change. Related to #1058 and #1047. Builds from `main` by itself. The build-sync PR edits a different region of `pnpm-workspace.yaml`. `http-cache-semantics@4.3.0` does not fix GHSA-ch52-4w7c-c8xp / CVE-2026-93748. No override is added for it.
