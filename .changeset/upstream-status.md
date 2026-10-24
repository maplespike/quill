---
"@maplespike/api-server": minor
"@maplespike/portal": minor
---

Add `GET /v1/upstream/status` and an upstream outage notice.

A declarative `upstream-maintenance` config (10 government hosts, EN+FR copy) drives an
in-process prober with N-of-M hysteresis: DOWN needs 3 failures in a 5-minute window, leaving
DOWN needs 5 consecutive successes. The route reports `up`, `degraded`, `down`, `scheduled`,
`partial` (StatCan's nightly data lock), `announced` (NL's portal shutdown) or
`blocked_permanent` (lobbycanada 403 — logged, never a banner). An expected-back time appears
only inside a declared window; observed downtime reports `null` and may say "usually".

The portal renders one line when a host affecting a feature is not up, with a link to the
publisher's own status page and no personal data. No database migration: state is in memory and
rebuilt within one probe interval after a restart. Set `QUILL_UPSTREAM_PROBE=0` to disable
probing.
