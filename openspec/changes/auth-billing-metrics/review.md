## Spec Compliance

- [x] Every requirement from the specs has at least one corresponding implementation task
- [x] Every scenario is testable (window expiry and cap use injected clocks/limits)
- [x] No requirements conflict with existing private metrics or billing behavior
- [x] Requirements are specific enough to verify after implementation

## Design Alignment

- [x] Technical approach sound for this codebase
- [x] Architecture decisions documented with rationale (API handler hook, MCP per-message hook)
- [x] No unnecessary new dependencies
- [x] Data flow is correct (auth/tool-call sites → private listeners → existing VMServiceScrape)

## Risk Assessment

- [x] Edge cases identified and handled (anonymous API, self-hosted stdio, cap eviction, TTL expiry, zero counters)
- [x] Rollback plan documented
- [x] Security implications considered (no raw or hashed identifiers in exposition; allowlisted `tier` label)
- [x] Performance impact evaluated (bounded maps, pruning on write/render, no I/O on the request path)
- [x] Migration path clear (additive in-memory metrics; image re-pin required for live series)

## Completeness

- [x] All proposal capabilities covered by specs
- [x] Scope creep identified and flagged (no dashboard, chart, or cluster-manifest changes)
- [x] Out-of-scope items explicitly called out (anonymous API callers, stdio identities, successful-charge accounting)

## Reviewer Notes

The four dashboard expressions were checked against the shipped Grafana JSON before implementation. Hook points were chosen from the actual dispatch code: `handleRequest` for API tenants and `handleMessage`/`handleToolCall` for MCP identities, quota denials, and payment attempts. Focused unit tests and typechecks pass locally; full CI and the post-merge image re-pin remain required.

## Verdict

- [x] **APPROVED** — additive, bounded, and covered by focused tests
- [ ] **CHANGES REQUESTED** — see specific items above
- [ ] **BLOCKED** — requires redesign or re-scoping
