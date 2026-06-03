---
last-reviewed: 2026-06-19
status: active
---

# MapleSpike Security Policy

## Reporting Vulnerabilities

Report security vulnerabilities by opening a private issue on [github.com/reverb256/maplespike](https://github.com/reverb256/maplespike/issues) or contacting the maintainer directly. Do not file public issues for active vulnerabilities.

**Response target:** Acknowledgment within 48 hours, triage within 5 business days.

## Project Context

MapleSpike is Canada's sovereign data layer — a deterministic ingestion pipeline for Canadian public data (federal, provincial, municipal). It runs on a self-hosted NixOS/K3s cluster with no foreign cloud dependency for core data processing.

**Critical architectural constraint:** The ingestion pipeline uses **zero LLMs**. All parsing is deterministic (CSV, JSON-stat, XML, JSON). LLMs are used only for user-facing reasoning (natural language queries, anomaly detection). This eliminates entire classes of prompt-injection and model-hallucination attack surfaces from the data pipeline itself.

## Known Threat Vectors

### 1. Data Integrity (Primary Risk)

The pipeline ingests data from external government APIs and publishes it verbatim with trust scores. Threats:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Government API compromise (MITM, DNS poisoning) | HTTPS enforcement, SHA-256 citation hashes on every record | Active |
| Data drift (source changes schema silently) | CI live-data-check workflow validates endpoints on every push to main | Active |
| Malicious or corrupted source data | Trust scoring (>=60% threshold), deterministic parsers reject malformed input | Active |
| Ingestion of non-public or privacy-sensitive data | Source allowlist in registry.ts — only OGL-Canada or permissively licensed endpoints | Active |

### 2. Supply Chain

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Compromised npm dependencies | Dependabot weekly scans (npm, docker, github-actions ecosystems) | Active |
| Major version bumps introducing breaking changes | Auto-merge blocks major bumps — manual review required | Active |
| Unpinned GitHub Actions | Dependabot monitors github-actions ecosystem weekly | Active |
| Legacy Docker image supply chain | CI forbids Dockerfiles — all images built via Nix | Active |

### 3. Cluster Infrastructure

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Unauthorized cluster access | K3s on private network (10.1.1.0/24), Tailscale mesh for remote access | Active |
| Secret exposure | agenix-encrypted .age files, decrypted at deploy time only | Active |
| Pod escape / privilege escalation | K8s manifests validated by scripts/validate-k8s-manifests.sh in CI | Active |
| Unverified container images | Nix-built images with reproducible closures | Active |

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
| Dependabot automated updates | Weekly npm/github-actions, monthly docker | .github/dependabot.yml |
| PR validation | Branch naming, issue linking, conventional commits | .github/workflows/pr-validation.yml |
| Dockerfile prohibition | CI fails on any legacy Dockerfile | .github/workflows/ci.yml |

## Not in Scope

- **OWASP threat model document:** Issue #360 referenced docs/owasp-threat-model-phase9.md containing 40 TODOs. This file never existed in the repository (not on any branch, not in git history, not referenced by any file). The issue was based on a phantom from a faulty docs audit. This SECURITY.md replaces that nonexistent document.

## License

- Core (pipeline-core, engine): AGPL-3.0-or-later
- Interface (api-server, mcp-server, portal): Apache-2.0
- Client (sdk, sdk-python): MIT

See [LICENSE.md](./LICENSE.md) for full details.
