## Context

The edge worker writes tenant ID, client IP, user agent, API-key hash, and `SHA-256(tenantId:question)` to D1. Raw rows roll up after `AUDIT_RETENTION_DAYS` (default 30). The portal self-hosts fonts, but `nginx.conf` and `public/_headers` still allow Google Fonts. Alert email already has an unsubscribe link and does not have a postal address. The repo does not contain a street address.

## Goals / Non-Goals

**Goals:**

- Make the privacy notice match the audit row, the retention job, and the processors.
- Drop the Google Fonts origins from every portal CSP copy.
- Identify MapleSpike on commercial alert email, with a postal address from config and a working unsubscribe link.
- Show the renewal summary before the pay action, in both languages, and use the same sentences in the terms.

**Non-Goals:**

- Paid counsel, a Law 25 privacy impact assessment, an age gate, session replay, or a DMCA agent.
- A hardcoded street address or any personal detail in the repo.

## Decisions

1. The postal address is `NOTIFICATION_POSTAL_ADDRESS`. An empty value makes the mailer refuse the commercial alert. The operator sets the real address on the host.
2. Verification and welcome mail stay free of unsubscribe language. Only `buildNotificationEmail` carries the commercial footer.
3. The purchase summary is one function, `renewalDisclosure`, fed by `plans.json`. Pricing and checkout render it in the initial HTML, immediately before the pay control. Stripe Checkout receives the same facts in `custom_text[submit][message]`, using the catalog price rather than a tax-inclusive total.
4. The request hash is described as not anonymous, because the same tenant and question always yield the same hash.

## Risks / Trade-offs

- Commercial alerts stop until the operator sets `NOTIFICATION_POSTAL_ADDRESS`. That is the safe failure. Sending without an address leaves the CASL identification gap in place.
- Stripe `custom_text[submit][message]` is an extra field on session create. The portal text does not depend on it. If Stripe rejects the field, checkout creation fails and the field must be removed.

## Migration Plan

Set `NOTIFICATION_POSTAL_ADDRESS` in the operator environment before the alert sender rolls out. No data migration.

## Open Questions

- The operator mailing address is not in this repo. The operator must supply it.
