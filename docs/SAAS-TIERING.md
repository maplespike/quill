---
last-reviewed: 2026-07-01
status: active
---

# MapleSpike SaaS Tiering Strategy

> Canonical reference for how MapleSpike scopes its SaaS (hosted) vs. self-hosted/community versions. This document defines the line between "here's the repo, self-host it" and "sign up at maplespike.ca."

---

## Industry Context

MapleSpike follows the established **open-core** model used by Grafana, Elastic, Supabase, Airbyte, and dbt Labs:

| Platform | Community Gets | SaaS Gates |
|---|---|---|
| **Grafana** | Full OSS visualization; self-managed backends | SSO, managed Mimir/Loki/Tempo, HA |
| **Elastic** | Basic search/observability engine | Security/ML features, managed orchestration |
| **Supabase** | Full Postgres engine (Docker); community support | Backups, PITR, branching, SSO, SLA |
| **Airbyte** | Full pipeline engine (MIT); all connectors | RBAC, SSO, PII masking, enterprise connectors |
| **dbt Labs** | Full transformation engine (CLI) | IDE, scheduler, CI/CD, governance, collaboration |
| **MapleSpike** | Full pipeline + 207 modules + 184 MCP tools (AGPL/Apache/MIT) | Hosting, SSO, RBAC, audit, SLA, team seats, custom modules |

**The pattern:** The community version is the full engine — never crippled. The SaaS version removes operational toil and adds governance features that organizations need for compliance.

---

## The Clean Line: Where Community Ends and SaaS Begins

```
┌─────────────────────────────────────────────────────────────┐
│  COMMUNITY (self-hosted)          │  MAPLESPIKE SaaS        │
│  ──────────────────────────────── │  ─────────────────────  │
│  ✓ All 207 data modules           │  ✓ Everything in        │
│  ✓ All 184 MCP tools              │    Community            │
│  ✓ Entity resolution engine       │  + Managed hosting      │
│  ✓ Cross-reference queries        │  + Multi-tenant         │
│  ✓ SQLite-backed local DB         │  + SSO / SAML / RBAC    │
│  ✓ API key auth                   │  + Audit logs           │
│  ✓ Docker Compose deployment      │  + Automated backups    │
│  ✓ Community support (GitHub)     │  + Usage dashboard      │
│  ✓ SDK (MIT) — zero friction      │  + SLA / support        │
│                                    │  + Team seats           │
│  You run the infra.                │  We run the infra.      │
└─────────────────────────────────────────────────────────────┘
```

**What we NEVER gate:**
- Data modules (government data is inherently public)
- MCP tools (adoption driver)
- The engine and cross-reference queries
- The SDK (MIT — maximum adoption)
- The API server and MCP server (Apache 2.0 — self-host freely)

**What we DO gate:**
- Infrastructure management (the core SaaS value prop)
- Multi-tenancy and tenant isolation
- SSO / SAML / RBAC
- Audit logs and compliance reporting
- SLA and priority support
- Team seats and collaboration features
- Usage analytics dashboard
- Custom data modules / private ingestion
- Commercial license (bypass AGPL for proprietary embedding)

---

## Tier Breakdown

### Tier 0: Community / Self-Hosted

```
git clone https://github.com/reverb256/quill
cd maplespike
docker compose up
```

| Attribute | Value |
|---|---|
| **Price** | Free, forever |
| **Data modules** | All 207 |
| **MCP tools** | All 184 |
| **API calls** | Unlimited (your infra) |
| **AI / RAG** | BYOK only (bring your own AI key) |
| **Auth** | API key (single-tenant) |
| **Database** | SQLite (local) |
| **Support** | GitHub Issues, Discussions |
| **License** | AGPL (pipeline-core/engine), Apache 2.0 (servers), MIT (SDK) |

### Tier 1: Free SaaS

| Attribute | Value |
|---|---|
| **Price** | Free |
| **Data modules** | Public data modules (no restricted/provincial gatekeeping) |
| **MCP tools** | Basic tool set |
| **API calls** | 1,000/month |
| **Rate limit** | 10/min |
| **AI / RAG** | — |
| **Auth** | API key |
| **Support** | Community |

### Tier 2: Pro SaaS ($50/mo CAD)

| Attribute | Value |
|---|---|
| **Price** | $50/mo CAD (~$35 USD) |
| **Data modules** | All 207 |
| **MCP tools** | All 184 |
| **API calls** | 50,000/month |
| **Rate limit** | 60/min |
| **AI / RAG** | ✅ (BYOK or MapleSpike credits) |
| **Developer console** | ✅ |
| **Support** | Email (< 48h) |
| **SLA** | 30-day data freshness |

### Tier 3: Business SaaS ($200/mo CAD)

| Attribute | Value |
|---|---|
| **Price** | $200/mo CAD (~$140 USD) |
| **API calls** | 250,000/month |
| **Rate limit** | 300/min |
| **SSO** | GitHub, Google OAuth |
| **Team seats** | 5 included |
| **Journalism mode** | ✅ (verified press credentials) |
| **Cross-reference reports** | ✅ (lobbying ↔ committees ↔ procurement) |
| **Usage analytics** | ✅ |
| **Support** | Priority (< 8h) |
| **SLA** | 7-day data freshness |

### Tier 4: Enterprise SaaS (custom)

| Attribute | Value |
|---|---|
| **Price** | Custom ($2,000–$25,000/yr) |
| **API calls** | 1,000,000+/month |
| **Rate limit** | 1,000/min |
| **SSO** | SAML / OIDC |
| **RBAC** | ✅ |
| **Audit logs** | ✅ (full compliance trail) |
| **SOC2** | ✅ |
| **Infrastructure** | Dedicated single-tenant K3s namespace |
| **Custom modules** | ✅ (private data ingestion) |
| **White-label** | ✅ |
| **On-premise** | ✅ |
| **Commercial license** | ✅ (bypass AGPL for embedding) |
| **Support** | < 1h response |
| **SLA** | 99.9% uptime |

---

## Feature Gate Reference

All SaaS-gated features are enforced through `packages/api-server/src/feature-gates.ts`. Use `canAccess(tier, feature)`:

```typescript
import { canAccess } from './feature-gates.js';

// In a route handler:
if (!canAccess(ctx.tenant.tier, 'aiRag')) {
  return jsonResponse(buildError('UPGRADE_REQUIRED',
    'AI queries require Pro tier or higher. Upgrade at maplespike.ca/billing',
    ctx
  ), 402);
}
```

### Full Feature Gate Matrix

| Feature Gate | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| `fullDataModules` | — | ✅ | ✅ | ✅ |
| `allMcpTools` | — | ✅ | ✅ | ✅ |
| `aiRag` | — | ✅ | ✅ | ✅ |
| `aiAnalyze` | — | ✅ | ✅ | ✅ |
| `developerConsole` | — | ✅ | ✅ | ✅ |
| `usageAnalytics` | — | — | ✅ | ✅ |
| `crossReferenceReports` | — | — | ✅ | ✅ |
| `teamSeats` | — | — | ✅ | ✅ |
| `journalismMode` | — | — | ✅ | ✅ |
| `oauthSso` | — | — | ✅ | ✅ |
| `samlSso` | — | — | — | ✅ |
| `rbac` | — | — | — | ✅ |
| `auditLogsWrite` | — | — | — | ✅ |
| `dedicatedInfra` | — | — | — | ✅ |
| `customModules` | — | — | — | ✅ |
| `whiteLabel` | — | — | — | ✅ |
| `onPremise` | — | — | — | ✅ |
| `commercialLicense` | — | — | — | ✅ |
| `prioritySupport` | — | — | ✅ | ✅ |
| `enterpriseSla` | — | — | — | ✅ |

> `usageAnalytics` gates tenant-WIDE analytics (aggregate dashboards, cross-tenant
> reporting). Reading your OWN consumption is not gated: `GET /v1/usage` is
> self-scoped for every tier, and `meta.usage` rides on every response (#891).

---

## Licensing Alignment

MapleSpike's three-tier licensing structure maps cleanly to the SaaS tiers:

| License | Packages | Applies To |
|---|---|---|
| **AGPL-3.0** | pipeline-core, engine | Community self-hosted (source-sharing obligation if modified) |
| **Apache-2.0** | api-server, quill-mcp, portal | All tiers — permissive self-hosting |
| **MIT** | sdk, sdk-python, legal-core, legislation | All tiers — zero-friction adoption |
| **Commercial** | pipeline-core, engine | Enterprise tier only — bypass AGPL for proprietary embedding |

An Enterprise customer who wants to embed MapleSpike's ingestion engine in a proprietary product pays for the commercial license instead of being bound by AGPL-3.0 source-sharing obligations.

---

## Payment Methods

| Method | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| **Interac e-Transfer** | — | ✅ | ✅ | — |
| **Credit card (Stripe)** | — | 🔜 | 🔜 | — |
| **Crypto (EVM)** | — | 🔜 | 🔜 | — |
| **Invoice (NET 30)** | — | — | — | ✅ |

---

## Implementation Status

| Component | Status | Location |
|---|---|---|
| Tier constants (`free`, `pro`, `business`, `enterprise`, `internal`) | ✅ Done | `packages/api-server/src/types.ts` |
| Rate limits per tier (`TIER_LIMITS`) | ✅ Done | `packages/api-server/src/types.ts` |
| Billing plans (`community`, `free`, `pro`, `business`, `enterprise`) | ✅ Done | `packages/api-server/src/routes/billing.ts` |
| Feature gates (`FEATURE_GATES` + `canAccess()`) | ✅ Done | `packages/api-server/src/feature-gates.ts` |
| Usage tracking + quota enforcement | ✅ Done | `packages/api-server/src/usage.ts` |
| Multi-tenant storage (SQLite / PG / D1) | ✅ Done | `packages/api-server/src/{node-sqlite,pg,sqlite}-storage.ts` |
| Stripe integration | 🔴 TODO | Phase 6 |
| Crypto payment verification | 🔴 TODO | Phase 6 |
| Journalism mode verification flow | 🔴 TODO | Phase 6 |
| Usage analytics dashboard | 🔴 TODO | Phase 6 |
| SOC2 compliance | 🔴 TODO | Phase 6 |

---

## Migration Path

**Community → Free SaaS:** Sign up at maplespike.ca, get an API key, point your SDK at the hosted endpoint. No data migration needed — same SDK, same API surface.

**Free → Pro:** Upgrade in the developer console. Instant — no downtime.

**Pro → Business:** Contact sales for SSO setup and team seat provisioning. Same API surface, higher limits.

**Business → Enterprise:** Dedicated infrastructure provisioning (1-2 business days). Custom contract with SLA terms.

---

## FAQ

**Q: Can I run the full platform without ever paying MapleSpike?**
A: Yes. `git clone` + `docker compose up` gives you everything — 207 modules, 184 MCP tools, entity resolution, cross-reference queries. You run the infrastructure. The AGPL license applies to any modifications you distribute.

**Q: What happens if I hit my API limit?**
A: Requests return `429 Rate Limited` until the next billing period. You can upgrade instantly in the developer console — no downtime.

**Q: Can I use the Enterprise commercial license without buying SaaS hosting?**
A: Yes. The commercial license is a legal document that replaces the AGPL-3.0 obligations on `pipeline-core` and `engine`. It's available to Enterprise customers regardless of whether they self-host or use our SaaS.

**Q: Is there a nonprofit / academic discount?**
A: We plan to offer a 50% discount on Business tier for verified nonprofits and academic institutions. Contact billing@maplespike.lan for details.
