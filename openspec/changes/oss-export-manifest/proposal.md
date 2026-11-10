# Proposal: Public export manifest

## Why

The API and MCP servers will be published from a new public repository with fresh history. This private repository stays the source of truth. The export needs an allowlist, a public overlay, and a fail-closed scan before any publish step exists.

## What Changes

- Add `oss/export.yml` for the allowlist, excludes, transforms, and scan rules.
- Add `oss/overlay/` with the public README, contributing guide, security policy, env example, compose file, Dockerfiles, and public CI workflow.
- Add `scripts/oss-export.mjs` to build a temp tree, regenerate the lockfile, install, build, test, and scan. The script does not publish.
- Add `docs/oss-export.md` and a fast unit test. Do not add the export to private CI.

## Capabilities

### New Capabilities

- `oss-export`: the manifest, the overlay, and the fail-closed local export.

### Modified Capabilities

- None.

## Impact

- Packages: none of the server runtime paths change, except four tests gain a private-only tag.
- No new dependency. No API or MCP contract change.
- Infra still adds the deploy key, the private workflow, and the GHCR publish.
