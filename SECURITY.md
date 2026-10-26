---
last-reviewed: 2026-10-26
status: active
---

# MapleSpike Security Policy

## Reporting Vulnerabilities

Report security vulnerabilities by opening a private security advisory on [github.com/maplespike/quill](https://github.com/maplespike/quill/security/advisories/new) or by email to [security@maplespike.ca](mailto:security@maplespike.ca). Do not file public issues for active vulnerabilities.

**Response target:** Acknowledgment within 48 hours, triage within 5 business days.

## Project Context

MapleSpike is Canada's sovereign data layer — a deterministic ingestion pipeline for Canadian public data (federal, provincial, municipal). It runs on a self-hosted NixOS/K3s cluster with no foreign cloud dependency for core data processing.

**Critical architectural constraint:** The ingestion pipeline uses **zero LLMs**. All parsing is deterministic (CSV, JSON-stat, XML, JSON). LLMs are used only for user-facing reasoning (natural language queries, anomaly detection). This eliminates entire classes of prompt-injection and model-hallucination attack surfaces from the data pipeline itself.

## Known Threat Vectors

### 1. Data Integrity (Primary Risk)

The pipeline ingests data from external government APIs and publishes it verbatim with trust scores. Threats:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Government API compromise (MITM, DNS poisoning) | HTTPS enforcement; integrity hashes are available for some records and do not by themselves authenticate the upstream source | Active |
| Data drift (source changes schema silently) | CI live-data-check workflow validates endpoints on every push to main | Active |
| Malicious or corrupted source data | Trust scoring (>=60% threshold), deterministic parsers reject malformed input | Active |
| Ingestion of non-public or privacy-sensitive data | Source registry and privacy controls; public availability or portal membership is not treated as a license grant. Dataset terms and privacy scope require source-specific review. | Review required |

### 2. Supply Chain

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Compromised npm dependencies | Dependabot weekly scans (npm, docker, github-actions ecosystems) | Active |
| Major version bumps introducing breaking changes | Auto-merge blocks major bumps — manual review required | Active |
| Unpinned GitHub Actions | Dependabot monitors github-actions ecosystem weekly | Active |
| Legacy Docker image supply chain | CI forbids Dockerfiles — all images built via Nix | Active |

#### Dependency Vulnerability Patching Strategy

When Dependabot or `pnpm audit` flags a vulnerability, we apply patches in the following priority order:

1. **Direct dependency bump** — update the package in the relevant `package.json`.
2. **Workspace override** — add a semver range to `pnpm-workspace.yaml` (`overrides`) to force a patched version for all consumers.
3. **Npm alias override** — for unmaintained packages with no upstream patch, redirect the package name to a community fork via `npm:<fork>@<version>`.
4. **Document and accept** — if none of the above are feasible and the vulnerable code path is unreachable in production, document the risk here with a justification.

**Current patched aliases & overrides:**

| Package | Original Vuln | Mitigation | Justification |
|---------|--------------|------------|---------------|
| `bigint-buffer` | CVE-2025-3194 (HIGH) — buffer overflow in `toBigIntLE()` | **Documented & accepted** (ADR 0009): alert stays open; `scripts/check-no-native-bindings.sh` fails CI if the native binding ever appears in the tree or the package enters `onlyBuiltDependencies` | The advisory lives in the native addon, which is never built here (`onlyBuiltDependencies` excludes the package); the pure-JS path performs no raw memory ops. The alias-swap fix (`bigint-buffer-fixed@1.1.6`) was measured and reverted in bd00fbfb: it drags `node-gyp` → `tar <= 7.5.18`, a CRITICAL (GHSA-23hp-3jrh-7fpw), and turned the audit gate red (12 findings). |
| `tar` | Multiple path traversal / arbitrary file write CVEs, incl. GHSA-23hp-3jrh-7fpw (CRITICAL, patched >= 7.5.19) | **Not overridden** (ADR 0009): the current lockfile resolves zero `tar` consumers (no `tar`, no `node-gyp` — only the unrelated `node-gyp-build@4.8.4`); the npm-style intent (`tar >= 7.5.16`) stays in `package.json` `overrides`, which pnpm ignores | An override for a resolution that does not exist is inert config implying protection the tree does not have. If the bigint-buffer alias swap is ever re-attempted (which resurrects `node-gyp` → `tar`), the swap must first prove `tar >= 7.5.19` resolution; the audit gate would catch it otherwise (it did on 4a2c0ca8). |
| `astro` | SSRF, XSS, replay (HIGH/MOD/LOW) | Bumped to `^6.4.8` + `@astrojs/react` to `^6.0.0` | Major version bump required for security patches; breaking changes resolved (e.g. `ViewTransitions` → `ClientRouter`). |
| `undici` | TLS bypass, WS DoS (HIGH) | Overridden to `>=8.5.0` | api-server direct dev dependency. |
| `nodemailer` | Raw option bypass, CRLF/JSON/TLS injection (HIGH/MOD/LOW) | Overridden to `>=9.0.1` | notification-service direct dependency. |
| `vite` | fs.deny bypass, NTLM disclosure (HIGH/MOD) | Overridden to `>=7.3.5` | Transitive via `@astrojs/react` and `vitest`. |
| `ws` | Memory DoS, uninitialized memory (HIGH/MOD) | Overridden to `>=8.21.0` | Transitive via `@solana/web3.js`. |
| `uuid` | Buffer bounds check (MOD) | Overridden to `>=11.1.1` | Transitive via `jayson`. |
| `esbuild` | Dev-server CORS, arbitrary file read (MOD/LOW) | Overridden to `>=0.28.1` | Transitive via `tsx` and `drizzle-kit`. |
| `@babel/core` | Arbitrary file read (LOW) | Overridden to `>=7.29.6` | Transitive via `@vitejs/plugin-react`. |

> **Note:** `js-yaml` was removed from overrides because forcing `>=4.2.0` broke Astro 6 CJS interop (`@astrojs/internal-helpers`). The vulnerability is moderate severity and only affects the `@changesets/cli` dev tool, not production code.

### 3. Cluster Infrastructure

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Unauthorized cluster access | K3s on private network, Tailscale mesh for remote access | Active |
| Secret exposure | agenix-encrypted .age files, decrypted at deploy time only | Active |
| Pod escape / privilege escalation | K8s manifests validated by scripts/validate-k8s-manifests.sh in CI | Active |
| Unverified container images | Nix-built images with reproducible closures | Active |
| Fork pull request on a self-hosted runner | `pull_request` jobs select the runner in `runs-on`. A fork resolves to `ubuntu-latest`. GitHub withholds secrets and supplies a read-only token. `merge-when-green.yml` is the only `pull_request_target` workflow, and it does not check out pull request code. Install `scripts/ci/refuse-untrusted-self-hosted.sh` on each self-hosted runner. Set "Require approval for all outside collaborators". | Workflow gate is in CI. The runner hook is an operator install. |

### 4. AI Agent Risks

| Threat | Mitigation | Status |
|--------|-----------|--------|
| AI agent fabricating completions (hallucinated PRs, reports) | CI guardrails: placeholder audit, metrics drift check, docs rot check | Active |
| Kelos agent producing substandard code | AI PR reviewer (pr-reviewer kagent) enforces zero-tolerance rules before merge | Active |
| Agent modifying security-sensitive files without review | CODEOWNERS requires @reverb256 approval on infrastructure paths | Active |
| Prompt injection via issue body | CI validates PR diff; agent system prompts enforce context-first verification | Active |

### 5. Data Exposure

| Threat | Mitigation | Status |
|--------|-----------|--------|
| API keys in frontend code | Portal is token-free — window.MAPLESPIKE.apiKey is empty by default | Active |
| Secrets in source control | agenix encryption; CI checks for committed secrets via placeholder audit | Active |
| K8s Secret values in ConfigMaps | ConfigMaps used only for non-sensitive config; secrets use Secret resources | Active |

## Security Controls Summary

| Control | Mechanism | Enforced By |
|---------|-----------|-------------|
| Commit signing verification | CI checks every PR commit for GPG signature | .github/workflows/ci.yml |
| K8s manifest validation | Security/resource/schema validation on every PR | .github/workflows/ci.yml (k8s-manifests job) |
| Documentation rot detection | TODO density check warns >5%; security docs enforce 0 TODOs | .github/workflows/docs-validation.yml |
| Metrics drift detection | Auto-generated metrics.json diff checked in CI | .github/workflows/ci.yml |
| Placeholder/stub detection | audit-placeholders.mjs blocks merge on mock data | .github/workflows/ci.yml |
| Secret scanning (gitleaks) | Full-history scan with the audited allow-list; `scripts/check-gitleaks-baseline.sh` validates the baseline (fingerprints-only ignore file, no catch-all, live fixtures) before each scan | .github/workflows/ci.yml (secrets job) |
| Dependabot automated updates | Weekly npm/github-actions, monthly docker | .github/dependabot.yml |
| PR validation | Branch naming, issue linking, conventional commits | .github/workflows/pr-validation.yml |
| Dockerfile prohibition | CI fails on any legacy Dockerfile | .github/workflows/ci.yml |

## Not in Scope

- **OWASP threat model document:** Issue #360 referenced docs/owasp-threat-model-phase9.md containing 40 TODOs. This file never existed in the repository (not on any branch, not in git history, not referenced by any file). The issue was based on a phantom from a faulty docs audit. This SECURITY.md replaces that nonexistent document.

## License metadata

Repository, package, and file-level license declarations conflict. This document does not determine which terms apply to each artifact. See [LICENSE.md](./LICENSE.md) and the [open-source audit](./docs/open-source-audit.md) for observed declarations and unresolved decisions.
