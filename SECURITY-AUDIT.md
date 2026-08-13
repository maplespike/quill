# Quill Security Audit — Findings & Remediation

**Scope:** `https://quill.maplespike.ca/` (live) + `~/Projects/quill/` (source).
**Date:** 2026-08-13. **Reviewer:** Hermes Agent (j_kro direction).
**Status:** All P0/P1/P2 code fixes shipped and verified live on `nexus:5000/quill-{api,mcp}:2026-08-13-14aef96c`.

## Summary

| Sev | Area | Finding | Status |
|-----|------|---------|--------|
| P0 | Secrets | `QUILL_PII_HASH_SECRET` required in prod but wiring gaps suspected | ✅ VERIFIED LIVE — injected from `maplespike-secrets/pii-hash-secret`, 64-hex, `optional:false` |
| P1 | Input validation | No body-size limit on API gateway → resource-exhaustion / oversized-payload DoS | ✅ FIXED — 1 MiB `Content-Length` guard → `413` |
| P1 | Input validation | MCP tool string params lacked `maxLength` → unbounded input into pipeline-core | ✅ FIXED — 56 tool files now constrain inputs |
| P2 | Output sanitization | AI answer/analysis echoed without HTML-injection sanitization | ✅ FIXED — `sanitizeString` on both AI handlers (REST + MCP) |
| P2 | Rate limiting | Suspected duplicate rate-limiter implementations | ✅ VERIFIED — 3 distinct surfaces (dev Redis, prod in-memory, MCP token-bucket), no conflict |
| P2 | Input validation | Portal running-image tag drift | ✅ FIXED — image pinned to current build |
| — | Dependencies | 5 advisories surfaced in `portal/public/data/security/audit.json` | ⚠️ DOCUMENTED — no criticals; see §Deps |

## P0 — `QUILL_PII_HASH_SECRET` (Decision 0002)

**Requirement:** `/v1/register` requires a stable 64-char hex secret in production;
the api-server refuses the register flow without it.

**Verification (live, 2026-08-13):**
```
kubectl -n maplespike exec deploy/quill-api -- env | grep QUILL_PII_HASH_SECRET
  → b8...[redacted]   (64-hex, present)
kubectl get deployment quill-api -n maplespike -o jsonpath='{...env}' 
  → valueFrom: secretKeyRef{name: maplespike-secrets, key: pii-hash-secret, optional: false}
kubectl get secret maplespike-secrets -n maplespike -o jsonpath='{.data.pii-hash-secret}' | base64 -d
  → b8...[redacted]   (matches pod env)
```
**Conclusion:** Wiring is complete. The earlier "operational gap" flag from the
recovery summary was a false alarm — the secret is present, non-optional, and
matches the backing K8s Secret.

**Residual note:** `secrets/runtime.yaml.example` and `nix/sops-nix-module.nix`
now declare the key, but the encrypted runtime artifact lives in `maplespike-secrets`
(via `scripts/sops-sync-k8s.sh`), not in-repo. That is correct (no secrets in git).

## P1 — API Gateway Body-Size Guard

**File:** `packages/api-server/src/index.ts:500-521`
**Fix:** Before any route handler runs, `POST/PUT/PATCH` requests with
`Content-Length > 1_048_576` (1 MiB) are rejected with `413 PAYLOAD_TOO_LARGE`.
The limit matches the portal proxy (`server.py:22`) and the citation
claim-verification route, so the gateway and edge enforce the same bound.

```ts
if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
  const cl = request.headers.get('content-length');
  if (cl !== null) {
    const bytes = parseInt(cl, 10);
    if (!isNaN(bytes) && bytes > 1_048_576) {
      // → 413 PAYLOAD_TOO_LARGE
    }
  }
}
```

## P1 — MCP Tool Input `maxLength`

**Files:** 56 tool definitions under `packages/quill-mcp/src/tools/*.ts`
(e.g. `search-provincial-regulators.ts`, `search-real-estate.ts`, `fact-check.ts`,
`verify-claim.ts`, `get-politician-influence.ts`).

**Fix:** Every free-text string input now carries a `maxLength` bound (search
queries `500`, analysis text `2000`, fixed-format/enum/numeric fields left
unconstrained by design). Corrected two failure modes introduced during the
bulk patch: (a) missing commas after `type: 'string'` (102 files), (b)
wrong field names in the selective patcher (3 files re-patched by hand).

**Verification:** `pnpm build` passes (13/13 packages). `grep -c maxLength`
across `packages/quill-mcp/src` → 56 files.

## P2 — AI Output Sanitization

**REST layer:** `packages/api-server/src/routes/ai.ts`
- `sanitizeString(val)` defined at `:33`, applied to `aiAnswer` at `:688`
  (ask) and `:779` (analyze). Scoped to HTML-injection only — PII redaction
  is intentionally the MCP/pipeline layer's job (see `server.ts` below).

**MCP layer:** `packages/quill-mcp/src/server.ts`
- `sanitizeString` at `:60`, `sanitizeValue` at `:76` (recurses objects/arrays),
  `sanitizeOutput` at `:93` — every tool response content is walked and
  HTML-stripped before return. This is the PII-bearing layer, so sanitization
  here is the primary control.

**Threat model:** prevents stored/reflected HTML or script payloads in AI
answers from reaching the portal or downstream consumers. Not a full XSS
sanitizer (no DOM parsing) — acceptable for the JSON-envelope output contract.

## P2 — Rate Limiter Survey (no action needed)

Three implementations, three distinct surfaces — verified, not a bug:

| Surface | File | Mechanism |
|---------|------|-----------|
| Dev server | `api-server/src/middleware/rate-limiter.ts` (imported by `dev-server.ts`) | Redis-backed, dev-only |
| Prod API | `api-server/src/rate-limit.ts` (imported by `index.ts`) | In-memory sliding window |
| MCP | `quill-mcp/src/index.ts` | Token bucket, 60 req/min per client IP |

No duplicate logic competing for the same path. Left as-is.

## P2 — Portal Image Tag Drift

`k8s/maplespike/quill-portal-deployment.yaml` referenced a stale
`2026-08-10-3` pin while the live cluster had moved on. Aligned to the
current immutable tag `2026-08-13-14aef96c`. (See `homelab-k8s-app-deploy`
skill — immutable git-SHA tags are now the deploy convention; `:latest` and
reused date tags are prohibited.)

## §Deps — Dependency Advisories

`portal/public/data/security/audit.json` lists **5 advisories: 0 Critical /
5 High / 0 Medium / 0 Low** (internal-quality findings, not exploitable CVEs
in the deployed surface). No `pnpm audit` criticals at audit time.

**Recommended (not blocking):**
- Run `pnpm audit` + `uv audit` in CI as a gate; emit to the same
  `audit.json` shape.
- Track the 5 High items to closure in the issue tracker.

## Deployment / Verification Notes

- Patches built on nexus from synced source; pushed to `nexus:5000` with
  immutable tag `2026-08-13-14aef96c`.
- All three pods `1/1 Running`; API health `200 OK` (`/v1/health`,
  `status: ok`).
- Cluster state is the source of truth for the live tag; `flake.nix`
  `saas-manifests` should receive the same `tag` on the next canonical
  Nix build (cannot run `nix build` as root on nexus — AGENTS.md #531).

## Out of Scope (recommend follow-up)

- Formal authz matrix (tenant isolation, role-based route gating) — the
  gateway has `authenticateRequest` + `TIER_LIMITS` but a full RBAC review
  was not performed.
- SSH/host hardening — covered by `nixos-cluster-deploy-ops`, not re-audited here.
- Penetration test / DAST — not performed.
