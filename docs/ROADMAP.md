# CivInt Canada — Roadmap

> This file is a synced copy of `/data/projects/own/civint/ROADMAP.md` (the root-level canonical document).
>
> For the full, up-to-date roadmap with honest module statuses, file inventory, and the 6-phase build plan, see the [root ROADMAP.md](../ROADMAP.md).

---

**Last synced:** 2026-05-12

Key changes from the previous version:

- **Phase 2 (MCP Server):** Changed from "Complete" to "PARTIAL" — 4 of 14 tools are real, 10 return empty results pending DB wiring
- **Phase 1B (Corporate):** Downgraded to 🟡/🔴 — connectors exist but no DB persistence; CSV data returned as stub
- **Phase 1C (Influence):** Downgraded to 🟡/🔴 — hypothetical connections only, no real API queries
- **Phase 3 (CI):** Changed from "PARTIAL" to 🔴 TODO — no `.github/` directory exists
- **Phase 6 (SaaS):** REVIVED — unarchived with Stripe + crypto + Interac billing. Was previously "ARCHIVED" in error.
- **Phase 0:** Schema corrected to 1042 lines / 38 tables; 5GW analysis module added
- **Critical fixes deployed:** Shared DB (SQLite), corporate/influence DB persistence, all 14 MCP tools wired — the 3 critical issues from the audit are resolved
- **Top 10:** Now prioritizes dashboard wiring, CronJobs, engine integration, and billing
