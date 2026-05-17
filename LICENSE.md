---
last-reviewed: 2026-05-17
status: active
---

# MapleSpike Licensing

This document explains the licensing structure for the MapleSpike project. See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines and CLA requirements.

---

## Three-Tier License Structure

MapleSpike uses different licenses for different layers of the stack. This is intentional — each tier serves a different purpose.

| Tier | Packages | License | Rationale |
|------|----------|---------|-----------|
| **Core** | `pipeline-core`, `engine` | **AGPL-3.0-or-later** | The moat. Protects the ingestion, verification, and trust-scoring engine. The AGPL network clause ensures anyone hosting a modified version must share their source code. |
| **Interface** | `api-server`, `mcp-server`, `portal`, `docs` | **Apache-2.0** | The gateway. Permissive enough for self-hosters, researchers, and tinkerers. The patent grant protects against patent aggression. |
| **Client** | `sdk`, `sdk-python`, `legal-core`, `legislation` | **MIT** | The on-ramp. Zero-friction adoption — `npm install` or `pip install` with no legal review needed. |

Each package contains its own `LICENSE` file. The root `LICENSE` file is AGPL-3.0 for the monorepo as a whole.

---

## Why This Structure?

### Why not one license for everything?

- **AGPL on everything** protects the moat but hurts adoption. Enterprise legal teams often reject AGPL even when they'd never trigger the clause. Self-hosters hesitate. SDK adoption slows.
- **MIT on everything** drives adoption but gives away the moat. A competitor could take 65 modules of Canadian data ingestion and host a competing service with no obligation to share changes.
- **Three-tier** threads both: the moat is protected, and the path to using MapleSpike is frictionless for 90% of users (who only ever touch the SDK and API).

### Why AGPL-3.0 for core?

- The network clause (Section 13) closes the SaaS loophole — if you host a modified version as a network service, you must make the source code available to users of that service.
- This is critical for a civic data project: nobody should be able to take the pipeline that processes Canadian public data, modify it, and serve results without sharing how they did it.
- MongoDB used this exact strategy (AGPL server + MIT drivers) for years before switching to BSL.

### Why Apache-2.0 for interface?

- Permissive enough that self-hosters can deploy the API server and MCP server without legal anxiety.
- The patent grant (Section 3) means contributors can't contribute patented tech and then sue users.
- More "serious" signal to enterprise legal teams than MIT, while being equally permissive in practice.
- A competitor can fork the API layer, but without pipeline-core (AGPL), they'd have to re-implement the entire ingestion engine from scratch.

### Why MIT for client?

- Maximum adoption. No legal team in the world rejects MIT.
- The SDK is a thin client — it calls the API. No competitive moat value in restricting it.
- Python SDK needs to be as frictionless as possible for the data science community.

---

## Data vs. Code License

**This is critical and often confused.**

- **Source data** (from StatsCan, CKAN, IRCC, etc.) is under the [Open Government Licence — Canada](https://open.canada.ca/en/open-government-licence-canada). This data is always freely accessible, regardless of the code license.
- **MapleSpike code** (fetchers, parsers, citation hashing, trust scoring, etc.) is under the licenses described above. This is the software that processes and verifies the data.
- **Derived outputs** (verified records with SHA-256 citations, trust scores) are produced by MapleSpike code from open data. The data itself remains OGL-CA; the code that produces the outputs is AGPL/Apache/MIT.

In short: **the data is free. The code that makes the data useful has license terms.**

---

## Commercial License (MapleSpike Enterprise License)

Organizations that cannot accept AGPL-3.0 obligations — typically those wanting to embed `pipeline-core` or `engine` in proprietary products — can purchase a commercial license.

### What the Enterprise License covers

- Right to use `pipeline-core` and `engine` in proprietary software without AGPL-3.0 source-sharing obligations
- Priority support and SLA guarantees
- Access to private modules and early releases

### Pricing

| Tier | Annual Price | Use Case |
|------|-------------|----------|
| Business | $1,999/yr | Embed in internal tools, no source-sharing required |
| Enterprise | Custom | OEM embedding, SLA, custom modules, dedicated support |

### How to obtain

Contact legal@maplespike.lan or visit the enterprise licensing page at maplespike.lan.

### Why offer a commercial license?

1. **Pragmatism:** Some organizations genuinely cannot accept AGPL. Rather than losing them as users, we offer a legal path.
2. **Revenue:** Pure margin — same code, different legal document. Even 5 enterprise customers at $2K/yr is $10K ARR with zero marginal cost.
3. **Enforcement alternative:** "We'd rather you buy a commercial license than risk AGPL non-compliance" is a stronger position than "We'll sue you."

---

## Contributor License Agreement (CLA)

Before your first pull request is merged, you must accept the MapleSpike CLA. This grants the project the right to re-license your contributions commercially.

### Why a CLA?

Without a CLA, every external contribution creates a legal encumbrance. If we want to offer the MapleSpike Enterprise License, we need the right to re-license all contributions — not just our own code.

### How it works

- **Individual contributors:** Comment `I have read and agree to the MapleSpike CLA` on your first PR
- **Corporate contributors:** A signed CLA must be on file — contact legal@maplespike.lan
- The CLA grants MapleSpike a non-exclusive, worldwide, royalty-free license to use, modify, and re-license your contributions
- You retain copyright to your own contributions

### What the CLA does NOT do

- It does not transfer copyright ownership to MapleSpike
- It does not prevent you from using your own contributions elsewhere
- It does not give MapleSpike exclusive rights

---

## License Compliance Checklist

If you're evaluating MapleSpike for use in your project:

| What you're doing | Which license applies | Your obligations |
|-------------------|----------------------|------------------|
| Using the SDK (npm/pip) | MIT | Include copyright notice |
| Self-hosting the API server | Apache-2.0 | Include copyright + NOTICE; state changes |
| Self-hosting the MCP server | Apache-2.0 | Include copyright + NOTICE; state changes |
| Using pipeline-core in an open-source project | AGPL-3.0 | Make your source code available to network users |
| Using pipeline-core in a proprietary product | **Commercial license required** | Contact legal@maplespike.lan |
| Browsing the portal or docs | Apache-2.0 | None (read-only use) |
| Using Canadian government source data | OGL-CA | Attribute the source; see open.canada.ca for full terms |

---

## SPDX Identifiers

All key entry-point source files include SPDX license identifiers:

- AGPL-3.0 packages: `// SPDX-License-Identifier: AGPL-3.0-or-later`
- Apache-2.0 packages: `// SPDX-License-Identifier: Apache-2.0`
- MIT packages: `// SPDX-License-Identifier: MIT`

Package `package.json` files use the corresponding SPDX expression in the `license` field.

---

## Changes to This Policy

Licensing changes will be announced via GitHub Issues and the ROADMAP. The three-tier structure is a strategic decision — changes to the core (AGPL) tier are extremely unlikely. Interface tier changes would only happen to make the license more permissive, never more restrictive.
