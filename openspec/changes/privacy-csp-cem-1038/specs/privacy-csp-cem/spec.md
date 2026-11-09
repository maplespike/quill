## ADDED Requirements

### Requirement: Privacy notice matches the edge AI audit

The English and French privacy notice SHALL list the fields stored on an edge AI audit row: tenant ID, client IP address, user agent, SHA-256 hash of the API key, and request hash. The notice SHALL state that the request hash is SHA-256 of the tenant ID joined to the question text, and SHALL state that the request hash is not anonymous. The notice SHALL state the default 30-day raw-row retention and the processors that receive the question.

#### Scenario: Request hash is not described as anonymous

- **WHEN** a reader opens the privacy notice in English or French
- **THEN** the notice names the tenant ID, client IP address, user agent, API-key hash, and request hash
- **AND** the notice states that the request hash is not anonymous
- **AND** the notice names the 30-day retention and the inference processors

### Requirement: Portal CSP does not allow Google Fonts

Every portal Content-Security-Policy copy (`server.py`, `nginx.conf`, and `public/_headers`) SHALL omit `fonts.googleapis.com` and `fonts.gstatic.com`.

#### Scenario: Spare CSP copies stay closed

- **WHEN** the CSP regression test reads `nginx.conf` and `public/_headers`
- **THEN** neither policy contains `fonts.googleapis.com` or `fonts.gstatic.com`
- **AND** `font-src` is `'self'`

### Requirement: Commercial alerts carry sender identification

A commercial alert email SHALL include the name MapleSpike, the sender email, the postal address from `NOTIFICATION_POSTAL_ADDRESS`, and a working unsubscribe link. The service SHALL refuse to send the alert when the postal address is empty. Verification mail and welcome mail SHALL remain free of unsubscribe language.

#### Scenario: Alert footer uses config

- **WHEN** a commercial alert is built with a postal address from config
- **THEN** the plain-text body and the HTML body contain MapleSpike, that postal address, the sender email, and the unsubscribe URL

#### Scenario: Missing address blocks the send

- **WHEN** `NOTIFICATION_POSTAL_ADDRESS` is empty
- **THEN** the mailer does not send the commercial alert

#### Scenario: Account mail stays transactional

- **WHEN** verification mail or welcome mail is rendered
- **THEN** the body does not contain an unsubscribe link

### Requirement: Renewal terms sit beside the purchase action

The pricing page and the checkout page SHALL show, in English and French, the CAD amount, the monthly interval, automatic renewal, and the cancellation timing immediately before the purchase control. The terms page SHALL use the same sentences.

#### Scenario: Checkout shows the summary before the form

- **WHEN** the checkout page is rendered
- **THEN** the renewal summary appears before the embedded checkout control
- **AND** the summary states the plan price in CAD, monthly renewal, and that cancellation takes effect at the end of the current billing period
