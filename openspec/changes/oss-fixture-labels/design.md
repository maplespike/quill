# Design: Synthetic fixture routes

## Context

`mock-data.ts` called `runModule()` and could return live records. `routes/mock.ts` was an empty module. The open-source plan says to keep these files only when every record is a labelled fixture.

## Goals / Non-Goals

**Goals:**

- Serve a small set of invented records.
- Make the production default off.
- Keep the change inside the API server.

**Non-Goals:**

- Remove SEDI, rewrite SPDX headers, or strip internal host names. Those are other changes.
- Seed a database. These routes only return the in-memory records.

## Decisions

1. **Enable flag.** `QUILL_FIXTURES=1|true|yes` enables the routes. Every other value leaves them off, in every `NODE_ENV`. The route text states that production stays off until the variable is set.
2. **Path.** `GET /v1/fixtures` lists records. `GET /v1/fixtures/:id` returns one. The list pattern is registered first.
3. **Auth.** The path is auth-exempt and on the Free allow list. The handler is the gate. A 401 or a 402 would hide the off switch.
4. **Envelope.** Disabled calls use `FIXTURES_DISABLED` and status 404. Enabled calls use the normal success envelope, `serves: "synthetic-fixtures"`, and `X-Quill-Data: fixture`.

## Risks / Trade-offs

- [Risk] A later route wildcard swallows `/v1/fixtures`. → The patterns are specific and the list route is registered before `:id`. The test reads `index.ts` for the registration.
- [Risk] A record is edited into something that looks real. → The test rejects known parliamentary phrases and requires `Fixture`, `Example`, or `Sample` in the title or actor.

## Migration Plan

No data migration. Deploy the API server. Leave `QUILL_FIXTURES` unset in production. Set it only on a host that wants the sample payload.

Rollback: revert the commit. The routes disappear with the code.

## Open Questions

None. The owner asked for labelled fixtures and a production-off switch.
