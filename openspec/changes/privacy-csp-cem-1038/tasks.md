## 1. Privacy notice

- [x] 1.1 Describe the edge AI audit fields, retention, and processors in `privacy.astro` (EN/FR)
- [x] 1.2 Add a source test that the request hash is not called anonymous

## 2. Font CSP

- [x] 2.1 Remove Google Fonts origins from `nginx.conf` and `public/_headers`
- [x] 2.2 Assert those origins are absent from every portal CSP copy

## 3. Commercial alerts

- [x] 3.1 Read `NOTIFICATION_POSTAL_ADDRESS` in notification config
- [x] 3.2 Add MapleSpike identity, that address, and the unsubscribe link to the alert template
- [x] 3.3 Refuse to send when the address is empty
- [x] 3.4 Keep verification and welcome mail free of unsubscribe language

## 4. Renewal disclosure

- [x] 4.1 Render the CAD amount, monthly interval, auto-renewal, and cancellation timing before the pay action on pricing and checkout
- [x] 4.2 Use the same sentences in the terms
- [x] 4.3 Send the same facts on the Stripe Checkout submit control
