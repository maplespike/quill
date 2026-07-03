# GHCR cleanup — purging old `reverb256/maplespike/*` images

**Status:** Documented post-rename (2026-07-03). No automatic cleanup attempted because
manual confirmation is required before destructive operations on shared CI infrastructure.

## Why

The 2026-07-03 repo rename (see [ADR 0007](./decisions/0007-repo-rename.md)) moved all
container images from `ghcr.io/reverb256/maplespike/{quill-mcp,quill-api,quill-portal,quill-ingest,quill-engine,...}`
to `ghcr.io/reverb256/quill/{quill-mcp,quill-api,quill-portal,quill-ingest,quill-engine,...}`.
The old images are **cosmetic waste** — no production traffic follows them, but they
continue to occupy disk in GHCR's storage tier.

This document describes how to purge them. **Run manually, not in CI** — these are
destructive operations that should be reviewed before execution.

## What's safe to delete

Every tag under these image names ceased being canonical on 2026-07-03:

| Image | Status post-rename |
|---|---|
| `ghcr.io/reverb256/maplespike/quill-mcp` | superseded by `ghcr.io/reverb256/quill/quill-mcp` |
| `ghcr.io/reverb256/maplespike/quill-api` | superseded by `ghcr.io/reverb256/quill/quill-api` |
| `ghcr.io/reverb256/maplespike/quill-portal` | superseded by `ghcr.io/reverb256/quill/quill-portal` |
| `ghcr.io/reverb256/maplespike/quill-ingest` | superseded by `ghcr.io/reverb256/quill/quill-ingest` |
| `ghcr.io/reverb256/maplespike/quill-engine` | superseded by `ghcr.io/reverb256/quill/quill-engine` |

Preserve: nothing at `maplespike/*` is canonical post-rename. The container *registry
namespace* `reverb256/maplespike` itself is the org-level identity in GitHub and cannot
be deleted without deleting the GitHub org — that's a separate (much larger) consideration.

## Procedure (CLI)

GitHub Packages exposes a REST API for tag deletion. The endpoint is:

```
DELETE https://api.github.com/orgs/{org}/packages/container/{package_type}/{package_name}/versions/{version_id}
```

Requires `admin:org` scope token (classic PAT) or `packages:delete` on a fine-grained PAT.

### Step 1: enumerate package versions

```bash
ORG=reverb256
PKG=quill-mcp
gh api \
  -H "Accept: application/vnd.github+json" \
  "/orgs/$ORG/packages/container/container/$PKG/versions?per_page=100" \
  --jq '.[] | {id: .id, name: .name, created_at: .created_at, tags: [.metadata.container.tags[]]}'
```

Repeat for each image (`quill-mcp`, `quill-api`, `quill-portal`, `quill-ingest`, `quill-engine`).

### Step 2: filter to old registry path

Tag names like `dev`, `prod`, or `0.4.0` are *content identifiers* — they exist under
both `reverb256/maplespike/*` (old) and `reverb256/quill/*` (new). Don't delete by tag
alone — filter by *registry path* via the `package_url` field. The old packages have
URLs like `https://github.com/orgs/reverb256/packages/container/package/quill-mcp/...`
— the `packages/container/package` segment indicates the pre-2025 GHCR layout used for
the old `maplespike` registry namespace; the new ones use `packages/container/container`.

(Tag-identity check: if a tag like `dev` exists under both `maplespike` and `quill`, delete only
the `maplespike` version. The `quill` version is the canonical one.)

### Step 3: delete

```bash
# Dry run first
gh api -X DELETE \
  -H "Accept: application/vnd.github+json" \
  "/orgs/$ORG/packages/container/container/$PKG/versions/$VERSION_ID" \
  --dryrun 2>&1 | head -5

# Actual delete
gh api -X DELETE \
  -H "Accept: application/vnd.github+json" \
  "/orgs/$ORG/packages/container/container/$PKG/versions/$VERSION_ID"
```

Repeat per package × version.

## Procedure (Web UI)

If CLI is overkill or `gh` CLI isn't available:

1. Open https://github.com/orgs/reverb256/packages?tab=containers
2. For each old `maplespike/*` package, click into it
3. Click **Package settings** (bottom-right of the sidebar)
4. Click **Delete this package** (red button at the bottom of Settings)
5. Confirm with the package name typed into the confirmation modal
6. Repeat per package

This deletes *all tags* of the old package at once — useful if nothing should be preserved.

## Rollback / recovery

Once a package version is deleted via the GHCR API, **it cannot be recovered from GHCR**.
If a tag is needed for forensic purposes, prune the local Docker cache first to confirm
no in-cluster image references depend on the old registry path:

```bash
# Confirm no live cluster references before deleting
kubectl get pods -A -o json \
  | jq -r '.items[].spec.containers[].image' \
  | grep 'reverb256/maplespike/' && echo 'STILL REFERENCED — DO NOT DELETE' || echo 'safe to delete'
```

If `STILL REFERENCED`, do the rename in kustomization.yaml overlays first, redeploy, wait
for old pods to terminate, then run the GHCR purge.

## Cost impact

GHCR's free public tier has **500 MB** of storage per account. Each Quill image tag is
~150–250 MB compressed. The five old images × ~5 historical tags ≈ 4–6 GB of
reclaimable storage. After purge the account returns to the free tier with headroom
for the new `quill/*` images.

## Verification (post-purge)

```bash
# Public API check — old images should 404 after purge
curl -sI https://ghcr.io/v2/reverb256/maplespike/quill-mcp/manifests/dev
# expect: HTTP/2 404

# New images should still resolve
curl -sI https://ghcr.io/v2/reverb256/quill/quill-mcp/manifests/dev
# expect: HTTP/2 200 (or 401 if image exists but auth required)
```

## References

- [ADR 0007 — repo rename](./decisions/0007-repo-rename.md) — context for the rename
- [GitHub Packages: deleting a package version](https://docs.github.com/en/packages/learn-github-packages/deleting-and-restoring-a-package)
- [GitHub: REST API for packages](https://docs.github.com/en/rest/packages)
