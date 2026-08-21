# 0007 — Repo rename: `maplespike` → `quill` (data-layer product)

**Status:** ACCEPTED (2026-07-03)
**Date:** 2026-07-03
**Owner:** j_kro
**Supersedes:** _none_ (this ADR records the repo-level commitments of ADR 0005 Phases C/E)
**Driver:** ADR 0005 ("Quill is the canonical product name") renamed the package itself
(`packages/quill-mcp/`, `@maplespike/quill-mcp`) but left four layers still advertising the
parent brand, not the product — the GitHub repo, the local directory, every container image,
and the npm binary (`maplespike-quill`). ADR 0006 made `quill.maplespike.{ca,lan}` canonical
hostnames for the same reason. The repo itself was the longest-standing violation of the
"Quill canonicals" rule and the only one that customers and CI both reach into directly.

## Context

After ADRs 0005 and 0006 the data-layer product had three names depending on which surface
you touched:

| Surface | Said | Should say |
|---|---|---|
| npm package / import | `@maplespike/quill-mcp` | `@maplespike/quill-mcp` *(already correct, ADR 0005)* |
| npm CLI binary | `maplespike-quill` | `quill` |
| GitHub URL | `github.com/reverb256/maplespike` | `github.com/reverb256/quill` |
| Local checkout path | `~/projects/maplespike/` | `~/projects/quill/` |
| Container image | `maplespike-quill` | `ghcr.io/reverb256/quill/quill-mcp` |
| K8s resource | `deployment/maplespike-quill` | `deployment/quill-mcp` |
| MCP client config | `{ "command": "npx", "args": ["maplespike-quill"] }` | `{ "command": "npx", "args": ["@maplespike/quill-mcp"] }` |

The mismatch was confusing new contributors (they expected the data-layer MCP server to be
called "Quill" because the npm package and the brand SPA call it Quill, then discovered the
GitHub URL still said "maplespike") and slowed CI debugging (container image names didn't
match the resource names that surfaced in their alerts).

## Decision

Rename every **product-level identifier** that names a Quill deliverable. Preserve every
**brand-level identifier** that names MapleSpike the organization. The split is principled,
not aesthetic — **infra and customer-facing brand stay; product advertising moves**.

## Renamed (product-level identifiers)

| Layer | Before | After |
|---|---|---|
| GitHub repo | `reverb256/maplespike` | `reverb256/quill` |
| Local directory | `maplespike/` | `quill/` |
| Root `package.json` `name` | `maplespike` | `quill` |
| npm binary (quill-mcp) | `maplespike-quill` | `quill` |
| Log prefix (`[maplespike-quill]` etc.) | `[maplespike-quill]` | `[quill]` |
| Container image path | `operator-registry/maplespike/` | `ghcr.io/reverb256/quill/` |
| Container image names | `maplespike-{quill,api,portal,ingest,engine,...}` | `quill-{mcp,api,portal,ingest,engine,...}` |
| K8s deployments / services | `maplespike-{quill,api,portal,...}` | `quill-{mcp,api,portal,...}` |
| Helm chart directory | `charts/maplespike/` | `charts/quill/` |
| Nix flake image outputs | `maplespike-{quill,api,...}-image` | `quill-{mcp,api,...}-image` |
| Nix flake aggregate outputs | `maplespike-{all,build-all,push-all}` | `quill-{all,build-all,push-all}` |
| Prometheus job name | `maplespike-quill` | `quill-mcp` |
| Cloudflare Worker names | `maplespike-edge`, `maplespike-ai` | `quill-edge`, `quill-ai` |
| Consumer-facing env-var convention (executed 2026-07-03) | see comprehensive Preserved-table row below — all product-level `MAPLESPIKE_*` env vars renamed to `QUILL_*` (full list in Mapping section) | n/a — replaced by the Preserved-table row + the brand-level env-var row |
| Systemd unit name | `maplespike-quill.service` | `quill-mcp.service` |
| Org-container relation | `operator-registry/maplespike/...` | `ghcr.io/reverb256/quill/...` |

## Preserved (brand-level identifiers)

| Layer | Why preserved |
|---|---|
| `@maplespike/*` npm scope | Org-level — describes who publishes, not what product. ADR 0005 §Implementation explicitly fixes to `@maplespike/quill-mcp`; the scope stays. |
| `maplespike.ca` public domain | Parent brand surface; product lives at subdomain (`quill.maplespike.ca`) per ADR 0006. |
| `*.maplespike.lan` LAN DNS | Infrastructure-level naming; LAN DNS is infra, not product. |
| K8s base namespace `maplespike` (`k8s/base/namespace.yaml`, dev overlay) | Infra identity — owns dev / integration traffic and every RBAC, ServiceAccount, NetworkPolicy, and cert. ADR 0006's Ingress pattern explicitly references `namespace: maplespike`. Renaming the base namespace would invalidate those bindings; deferred to a separate infra migration. |
| K8s prod overlay namespace (`k8s/overlays/prod/kustomization.yaml`) | `quill-prod`. *Current state:* the prod overlay namespace is `quill-prod`. This ADR captures the rename as a single mechanical sweep without preserving a pre-sweep snapshot, so we cannot claim a specific `maplespike-prod → quill-prod` delta with confidence from this commit alone. (Verified: `rg 'maplespike-prod'` returns zero hits in source after the rename.) |
| PostgreSQL user `maplespike` | Infra identity — the DB owner; renaming it would orphan every existing role grant. |
| `maplespike-brand/` site directory | Separate product (the brand SPA). Out of scope — has its own ADR lifecycle. |
| `maplespike-relay/` directory | Separate product (Fediverse relay). Out of scope. |
| License / copyright headers (`MapleSpike © …`) | Legal entity attribution. Renaming the legal entity is out of scope and would force an AGPL relicensing conversation. |
| `MAPLESPIKE_*` env vars (brand-level — kept) | Env vars that name a brand surface stay: `MAPLESPIKE_DOMAIN`, `MAPLESPIKE_ORIGIN`, `MAPLESPIKE_BILLING_EMAIL`, `MAPLESPIKE_OAUTH_REDIRECT_BASE`, `MAPLESPIKE_OAUTH_{PROVIDER}_CLIENT_ID`, `MAPLESPIKE_OAUTH_{PROVIDER}_CLIENT_SECRET`, and all `MAPLESPIKE_TREASURY_*` chains (treasury wallets belong to the legal entity / org, not the product). Plus `MAPLESPIKE_NAME` when used as *application metadata string* rather than env var config (default remains `MapleSpike` in license/AGPL contexts). |
| `MAPLESPIKE_*` env vars (product-level — renamed) | **Comprehensive list** (executed 2026-07-03): `MAPLESPIKE_LOG_LEVEL`, `MAPLESPIKE_STORAGE`, `MAPLESPIKE_DB_PATH`, `MAPLESPIKE_DB_HOST`, `MAPLESPIKE_DB_PORT`, `MAPLESPIKE_DB_NAME`, `MAPLESPIKE_DB_USER`, `MAPLESPIKE_DB_PASSWORD`, `MAPLESPIKE_AI_ENDPOINT`, `MAPLESPIKE_AI_MODEL`, `MAPLESPIKE_GATEWAY_URL`, `MAPLESPIKE_GATEWAY_API_KEY`, `MAPLESPIKE_CHAT_MODEL`, `MAPLESPIKE_EMBED_MODEL`, `MAPLESPIKE_LOCAL_MODEL`, `MAPLESPIKE_LOCAL_ENDPOINT`, `MAPLESPIKE_QDRANT_ENDPOINT`, `MAPLESPIKE_QDRANT_COLLECTION`, `MAPLESPIKE_PII_HASH_SECRET`, `MAPLESPIKE_BILLING_SECRET`, `MAPLESPIKE_BILLING_IMAP_{HOST,PORT,USER,PASS,TLS}`, `MAPLESPIKE_DEV_API_KEY`, `MAPLESPIKE_API_BASE`, `MAPLESPIKE_FREE_QUOTA`, `MAPLESPIKE_LOCALE`, `MAPLESPIKE_HANDLER_TIMEOUT_MS`, `MAPLESPIKE_PIPELINE`, `MAPLESPIKE_JWT_TOKEN`, `MAPLESPIKE_API_URL`, `MAPLESPIKE_API_KEY`, `MAPLESPIKE_CANLII_API_KEY`, `MAPLESPIKE_AI_API_KEY`, and `MAPLESPIKE_NAME`/`MAPLESPIKE_VERSION` when used as runtime config (defaults: `QUILL_NAME` default `Quill`, `QUILL_VERSION` default `0.x`). All rename to `QUILL_*`. |
| Cloudflare D1 IDs (product-data scope) | Renamed: edge-worker audit DB `maplespike-audit` → `quill-audit` (`packages/edge-worker/wrangler.toml`); root cache DB `maplespike-cache` → `quill-cache` (`wrangler.toml`). These hold product-generated state. |
| Cloudflare D1 IDs (brand-infra scope) | Preserved: `packages/api-server` D1 binding `database_name = "maplespike"` stays — it stores brand-level auth state (sessions, rate-limit counters, API-key grants) and binds to the API gateway surface reached via `api.maplespike.ca`. Renaming it would invalidate every API-key grant row, so it is deferred. |

## Naming criteria

The split is governed by three rules, in priority order:

1. **Customer-facing brand is sacred.** `maplespike.ca`, AGPL copyright headers, and the
   npm scope are load-bearing for trust, AGPL compliance, and SEO. Never rename these
   without a wider decision (e.g., corporate rebrand).
2. **Product identifiers advertise the product.** Any identifier whose purpose is to name a
   *specific* Quill deliverable (image, binary, deployment, log prefix) gets the product
   name. The word "MapleSpike" never appears inline in a Quill resource path.
3. **Infra identifiers are infra.** Namespaces, DB roles, LAN DNS, ServiceAccounts, and
   RBAC objects describe infrastructure, not products. They stay at brand-level because
   they outlive the product.

## Considered alternatives

| Option | Trade­off | Decision |
|---|---|---|
| **A. Full org rename** — also rename npm scope to `@quill/`, domain to `quill.ca`, DB user, license headers | Fully consistent product naming across every layer. **Cost:** triggers AGPL relicensing discussion (the AGPL clause cites the legal entity), invalidates every existing RBAC binding, breaks customer bookmarks and the brand SPA, requires coordinated Cloudflare + K3s + Postgres migration under load. Disproportionate to the goal. | **REJECT** |
| **B. Cosmetic-only rename** — rename only the GitHub repo and the directory; keep `maplespike-` prefix on images, K8s resources, Helm chart, etc. | Minimal disruption. **Cost:** fails ADR 0005's "Quill is canonical." Just moves the confusion one layer down. | **REJECT** |
| **C. Scope-limited rename** *(this ADR)* — rename product identifiers; preserve brand and infra identifiers. | Clean product naming where it matters (npm binary, container images, K8s resources, CI logs). Preserves everything that's owed to the parent brand or infra identity. Reversible per-resource via `git log -p`. | **ACCEPT** |

## Consequences

- ✅ **Every product surface says "Quill."** New contributors reading the README find the
  GitHub URL, the npm binary, the container image, and the K8s resource all agree.
- ✅ **Customer-facing brand is unchanged.** Existing bookmarks, certificate chains, RBAC
  bindings, AGPL clauses, and the brand SPA work without modification.
- ✅ **Reversible.** Each renamed site is a single-file (or single-line) revert; the full
  audit trail is in git history (`git log --diff-filter=R --summary`).
- ✅ **ADR 0005/0006 commitments are now satisfied at every layer.** The "Quill canonical"
  invariant holds for the npm package, the binary, the repo URL, the image registry, the
  K8s resource, and the hostname.
- ⚠️ **One pre-existing test gap surfaced (not rename-caused).** `quill-mcp` package test
  "bilingual descriptions present where applicable" fails for `search_lode` — the tool
  has no French translation in `packages/i18n/src/fr-tools.json`. The rename sed patterns
  never touched `descriptions: { 'fr-CA': … }` fields; the gap was already there. Filed as
  a separate data-coverage issue.
- ⚠️ **Old GHCR images not auto-cleaned.** `operator-registry/maplespike/*` tags remain
  resolvable until manually purged (or until GHCR's retention policy rolls them out). No
  production traffic follows them — they're cosmetic waste, not a redirect surface.
- ⚠️ **GitHub auto-redirects old repo URLs.** `github.com/reverb256/maplespike` 302s to
  `github.com/reverb256/quill` for clones and web traffic; old `git remote set-url` is
  recommended for `clean/clone` hygiene but not required.

## Implementation phases (executed 2026-07-03)

The implementation was a single mechanical rename executed across four shells, not a
multi-day multi-PR rollout:

| Phase | Action | Tools |
|---|---|---|
| **1. Bulk content rename** | 6 `sed` patterns against ~65 files in `maplespike/`, `maplespike-workers/`, `maplespike-brand/` covering log prefixes, binary names, image paths, K8s resources, Nix outputs, Cloudflare worker names, Prometheus jobs, env vars, Helm chart contents | `find + sed -i` |
| **2. Root config + chart/dashboard rename** | Root `package.json` `name` field, Helm chart directory rename, Grafana dashboard filename | `sed`, `mv` |
| **3. Directory rename** | `maplespike/` → `quill/` | `mv` |
| **4. Verification + sweep** | `rg` for stale `maplespike-quill`, `maplespike-api`, `maplespike-portal`, `operator-registry/maplespike/`, `github.com/reverb256/maplespike` in JS/MJS/PY/CONF/TXT (extensions that Phase 1's find missed); final sweep confirms zero references outside preserved layers. | `rg` |

**Estimated blast radius:** ~370 references across ~65 files. Actual final count after
Phase 4 cleanup matched the estimate.

## Verification (post-rename)

```bash
# Stale product refs (expect zero):
rg -c 'maplespike-quill|maplespike-api[^-]|maplespike-portal|maplespike-ingest|maplespike-engine|maplespike-edge|maplespike-(audit|cache)' \
   quill/ maplespike-brand/ maplespike-workers/ \
   --iglob '!node_modules' --iglob '!dist' --iglob '!.git' --iglob '!*.deprecated'
# → (no output)

# Stale registry refs (expect zero):
rg -c 'operator-registry/maplespike/' quill/ maplespike-brand/ maplespike-workers/

# Stale GitHub refs (expect zero):
rg -c 'github.com/reverb256/maplespike' quill/ maplespike-brand/ maplespike-workers/

# Preserved layers still present:
rg -c '@maplespike/' quill/packages/quill-mcp/package.json
rg -c 'maplespike.ca'     quill/DESIGN.md | head -3
rg -c 'maplespike.lan'    quill/k8s/base/15-ingress-lan.yaml

# Typecheck + tests pass on the consumer of the rename:
pnpm --filter @maplespike/quill-mcp build   # exit 0
pnpm --filter @maplespike/quill-mcp test    # 24/25 pass; 1 pre-existing fr-CA gap
```

## Migration guide (for consumers)

External MCP client configs and CI pipelines need a one-time edit:

```diff
- "maplespike-quill": { "command": "npx", "args": ["maplespike-quill"] }
+ "quill": { "command": "npx", "args": ["@maplespike/quill-mcp"] }
```

```diff
- image: operator-registry/maplespike/quill-mcp:0.4.0
+ image: ghcr.io/reverb256/quill/quill-mcp:0.4.0
```

**Verification (post-execution, 2026-07-03):** Run `rg 'MAPLESPIKE_(LOG_LEVEL|STORAGE|DB_|AI_|GATEWAY|CHAT_MODEL|EMBED_MODEL|LOCAL_|QDRANT_|PII_|DEV_API|API_BASE|VERSION|FREE_QUOTA|LOCALE|HANDLER_TIMEOUT_MS|PIPELINE|JWT_TOKEN)' quill packages quill/.env* --iglob '!node_modules' --iglob '!dist' --iglob '!CHANGELOG.md'` and confirm zero matches. (Brand-level env vars retained: `MAPLESPIKE_DOMAIN`, `MAPLESPIKE_ORIGIN`, `MAPLESPIKE_BILLING_EMAIL`, `MAPLESPIKE_OAUTH_REDIRECT_BASE`, `MAPLESPIKE_OAUTH_*_CLIENT_{ID,SECRET}`, `MAPLESPIKE_TREASURY_*` chains.)

> **Note:** The env-var rename was executed 2026-07-03 across source code, `.env*` files,
> `wrangler.toml`, `docker-compose.yml`, `Dockerfile`, K8s manifests, Helm chart, and
> Nix flake. Runtime fallback: missing `QUILL_*` vars fall back to hardcoded defaults
> (e.g., `http://localhost:8082`, `maplespike.lan`) — the code does not explicitly reject
> unset or `MAPLESPIKE_*-named` vars. **Brand-level kept vars** (DOMAIN, ORIGIN, BILLING_EMAIL,
> OAUTH_*, TREASURY_*) retain their `MAPLESPIKE_` naming because they reference brand
> surfaces or org-level identities rather than product configurables.

`git remote set-url origin git@github.com:reverb256/quill.git` for clean clones.

## References

- [Decisions index](./README.md) — sibling ADRs and the status legend
- [ADR 0005 — Quill product name](./0005-quill-product-name.md) — origin of the "Quill is canonical" invariant
- [ADR 0006 — Quill hostname alias](./0006-quill-hostname-alias.md) — origin of the brand-vs-product split for DNS
- [CHANGELOG.md](../../CHANGELOG.md) §2026-07-03 — the executed diff
- [README.md §Repo rename note](../../README.md) — top-level repo orientation
- [DESIGN.md §Overview](../../DESIGN.md) — Quill's design narrative, now under the canonical name
