## Why

Issue #1038 found four engineering gaps: the privacy notice omits the edge AI audit fields, spare CSP copies still allow Google Fonts, commercial alert email lacks a sender postal address, and the renewal terms sit away from the purchase action. Maple's decision on 2026-11-09 is to fix those four items. Counsel review and a formal Law 25 assessment stay out of scope.

## What Changes

- State the edge AI audit fields, the 30-day retention, and the processors in the English and French privacy notice. State that the request hash is not anonymous.
- Remove `fonts.googleapis.com` and `fonts.gstatic.com` from `nginx.conf` and `public/_headers`.
- Add the MapleSpike name, the configured postal address, and the existing unsubscribe link to commercial alert email only. Read the address from `NOTIFICATION_POSTAL_ADDRESS`. Refuse to send when it is empty. Leave verification and welcome mail transactional.
- Show the CAD amount, the monthly interval, automatic renewal, and cancellation timing beside the purchase action on `/pricing` and `/checkout`, in English and French. Use the same sentences in the terms.

## Capabilities

### New Capabilities

- `privacy-csp-cem`: Privacy-notice accuracy, font CSP, commercial-alert identification, and renewal disclosure beside purchase.

### Modified Capabilities

- None.

## Impact

- `packages/portal` privacy, pricing, checkout, and terms pages; portal CSP copies.
- `packages/notification-service` alert template and config.
- `packages/api-server` Stripe Checkout submit text, and a classification check for transactional mail.
- No new dependency. No API response shape change except an optional `locale` field on checkout creation.
