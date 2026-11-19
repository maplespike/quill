---
last-reviewed: 2026-11-09
name: quill-provenance-briefing
description: Produce a provenance-backed briefing on a Canadian regulation, bill, policy area, or entity — every factual claim annotated with a verifiable SHA-256 claim hash, source URL, and retrieval time from Quill MCP tools.
version: 1.0.0
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [canada, briefing, provenance, verification, mcp, quill]
    category: research
    requires_toolsets: [mcp]
---

# Quill Provenance-Backed Briefing

Writes a regulatory/policy briefing where every factual claim carries a
verifiable SHA-256 hash from Quill's claim stack, so a reader (or another agent)
can independently confirm the sourcing. This is the skill that turns Quill from
"another data MCP" into a *trusted* one.

## When to use

- "Produce a provenance-backed briefing on X regulation"
- "Summarize the evidence on this bill with sources I can verify"
- "What do the official records say about this topic — with citations I can check?"

## Workflow

1. **Scope the topic** — ask the user for the regulation/bill/policy area or
   entity. Note the desired depth (executive summary vs. full briefing).
2. **Gather evidence with claims** — call (in order):
   - `fact_check` with the topic as a claim — returns evidence + claim hashes.
   - `search_gazette` and `search_legislation` for regulatory status.
   - `search_committees` + `search_debates` for parliamentary consideration.
   - `track_bill` when a specific bill is named.
   - `ngo_narrative_tracker` / `search_ngo_rss` for policy-actor messaging.
   `fact_check` and `track_bill` attach a `claims` array. Capture `sha256`,
   `sourceName`, `sourceUrl`, and `retrievedAt` for every claim you cite.
   `search_gazette`, `search_legislation`, `search_committees`,
   `search_debates`, `ngo_narrative_tracker`, and `search_ngo_rss` do not
   attach `claims`. Cite the source URL and mark the point `[unverified]`
   until a claim hash exists.
3. **Fact-check critical numbers** — for any statistic you plan to headline,
   run `fact_check` on that exact figure. Treat the matches as related
   records, not an independent verification. Flag anything the search cannot
   corroborate.
4. **Write the briefing** — structure: Executive Summary → Status/Chronology →
   Key Evidence (each bullet: claim, source, date, sha256) → Gaps & Contradictions
   → Verification appendix listing every hash + how to verify it.
5. **Hand the reader the verification recipe** — state that a hash is checked
   with `verify_claim` (`sha256`, plus the canonical record value when you
   have it) or `get_citation` (hash). `verify_claim` compares the SHA-256 of
   Quill's canonical JSON. A raw `sha256sum` of the source text does not
   reproduce that hash. A match checks record integrity. It does not
   authenticate the source.

## Output format

```
# Briefing: <topic> (provenance-backed)
## Executive summary
## Regulatory / legislative status
## Key evidence
| Claim | Source | Date | sha256 |
## Gaps & contradictions
## Verification appendix
- sha256:<hex> — <source> — verified via verify_claim
```

## Rules

- Never assert a number without a claim hash from a tool response.
- Mark unverified information explicitly as `[unverified]`.
- If the claim store returns `verified: false`, surface that prominently.
