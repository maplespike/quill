# Security

Report a vulnerability by email to security@maplespike.ca. Do not open a public issue for a vulnerability that is still exploitable.

We aim to acknowledge a report within 48 hours.

This tree does not contain production secrets. Billing stays off when the Stripe variables are empty. AI stays off when the AI variables are empty. Crypto payments stay off when the x402 variables are empty.

Set `JWT_SECRET` before you expose a server. Do not use the sample value from `.env.example` on a public host.
