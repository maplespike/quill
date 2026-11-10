# Public export

The public repository `maplespike/quill-api` is a fresh tree. This private repository stays the source of truth. `scripts/oss-export.mjs` builds that tree in a temp directory. It does not publish. No push credential is used.

## Run it

From the repository root:

```bash
pnpm run oss:export
```

That command materializes the allowlist, applies `oss/overlay/`, regenerates `pnpm-lock.yaml`, runs `pnpm install`, `pnpm run build`, and `pnpm run test`, then runs gitleaks and the forbidden-string scan. A hit or a failed command exits non-zero. The temp path is printed. The script leaves the directory in place so you can inspect it.

Scan only, with no install:

```bash
node scripts/oss-export.mjs --scan-only
```

Set `GITLEAKS_BIN` when the `gitleaks` binary is not on `PATH`.

The fast unit test is `pnpm run test:oss-export`. It checks the manifest and the scan rules. It does not copy the tree and it does not install dependencies.

## What the export keeps

`oss/export.yml` is the allowlist. It keeps the five server packages, every `packages/sdk-*` directory, and the root files named in the open-source plan. The overlay replaces the README and adds `CONTRIBUTING.md`, `SECURITY.md`, `.env.example`, `docker-compose.oss.yml`, the two Dockerfiles, and a public CI workflow.

Server packages stay AGPL-3.0-only. The export rewrites `packages/sdk-*` package metadata to Apache-2.0 and writes the Apache licence file next to them. It does not change those files in this private tree.

## What it drops

The manifest drops SEDI sources, files tagged `oss-export: private-only`, `*.disabled`, `secrets/`, `.sops.yaml`, `charts/`, `k8s/`, `deploy/`, `ops/`, `config/`, `.github/`, the portal, `docs/`, and `scripts/`. The export script itself stays here. It is not part of the public tree.

The private-only tag is on the tests that read `charts/`, `.github/workflows`, or a repository-root Dockerfile.

## The scan

The scan fails closed. It looks for private network addresses, tailnet names, internal host words, home-directory paths, project-data paths, two identity tokens, and live key prefixes. `sk_live` does not match a longer product prefix such as a client sample key. `scan.allows` in `oss/export.yml` lists Stripe lines that are prefix checks or synthetic fixtures. Each entry names one file, one rule, and the exact line. The report prints those hits under `Allowlisted`. They do not fail the scan. Any other line that carries the same prefix still fails. Gitleaks uses `oss/overlay/.gitleaks.toml`, which ignores unit-test lines that repeat the word FAKE. `192.168` inside the SSRF guards is allowed by path:

- `packages/api-server/src/routes/extraction.ts`
- `packages/api-server/src/routes/webhooks.ts`

On the current main branch the scan is expected to fail. Other changes remove the internal host names, the home path, and the project-data path. Run the scan again after those changes merge. The hit count should reach zero. SEDI removal is also required before `pnpm run build` can succeed in the export, because the corporate module still imports the excluded file.

## What Infra still adds

This repository does not run the export in CI yet.

1. Create the public repository `maplespike/quill-api`. Turn on secret scanning, push protection, branch protection, and Dependabot security updates.
2. Store a deploy key, or a GitHub App key, that can write to that public repository only. Keep it as a secret on this private repository. Do not put it in SOPS output.
3. Add a workflow on this private repository. Run it on `ubuntu-latest` when `main` changes the allowlisted paths, and on `workflow_dispatch`. Keep concurrency at 1. The workflow runs `scripts/oss-export.mjs` and publishes one squashed commit. Use the author `MapleSpike <noreply@maplespike.ca>`. The commit message names the private SHA and does not name pull-request titles.
4. Publish `ghcr.io/maplespike/quill-api` and `ghcr.io/maplespike/quill-mcp` from tagged releases of the public repository. The public CI workflow in the overlay already runs lint, typecheck, test, and gitleaks on `ubuntu-latest`. It uses no secrets and no self-hosted runner.
