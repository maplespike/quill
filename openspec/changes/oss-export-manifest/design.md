# Design: Public export

## Context

The owner chose a new public repository filled by an export from this private tree. Two other changes remove internal host names and add SPDX headers. A third removes SEDI. This change does not do that work. It builds the export gate those changes must pass.

## Goals / Non-Goals

**Goals:**

- Describe the public tree in one manifest.
- Ship a self-host overlay that builds from that tree.
- Fail closed on a local scan. Publish nothing.

**Non-Goals:**

- Add the export workflow to private CI. Infra does that later.
- Remove SEDI imports, internal URLs, or missing SPDX headers.
- Accept outside pull requests. The public contributing guide says issues are welcome and pull requests are not accepted yet.

## Decisions

1. **Allowlist, then overlay.** The copier walks the private tree and keeps only manifest paths. The overlay is applied after transforms, so the public README and Dockerfiles replace private ones.
2. **SDK licence stamp in the export only.** Server manifests stay AGPL-3.0-only. `packages/sdk-*` metadata in the temp tree is rewritten to Apache-2.0. The private tree is unchanged, so the licence-coherence gate stays green.
3. **Scan before install.** Forbidden strings and gitleaks run on the materialized tree. `--scan-only` skips install, build, and test. The default run continues and still exits non-zero when an earlier phase failed.
4. **SSRF allowlist by path.** `192.168` is ignored only in `routes/extraction.ts` and `routes/webhooks.ts`.
5. **Private-only tag.** Four tests that read charts, the private workflow, or a root Dockerfile get `oss-export: private-only` on the first line. The manifest lists them as well.

## Risks / Trade-offs

- [Risk] The export build fails until SEDI imports are gone. → The script reports the failure. It does not patch those imports.
- [Risk] The string scan fails on internal hosts that another change removes. → The scan report is grouped by file so the follow-up can be checked against zero.
- [Risk] A new test reads a private path and is exported. → The tag and the path list are both required. The unit test locks the current four.

## Migration Plan

No runtime migration. Operators run `pnpm run oss:export` locally. Infra adds the key and the workflow after the scan is clean.

Rollback: revert the commit. No service behavior changes.

## Open Questions

None. The repository name is `maplespike/quill-api`. Server code stays AGPL-3.0-only. `packages/sdk-*` is Apache-2.0. Outside pull requests are not accepted at launch.
