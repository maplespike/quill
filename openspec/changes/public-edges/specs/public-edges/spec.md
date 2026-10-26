## ADDED Requirements

### Requirement: Documentation links use a host that serves docs

The repository MUST NOT link documentation to `docs.maplespike.ca` or `https://maplespike.ca/docs`. Documentation URLs MUST use `https://quill.maplespike.ca/docs`.

#### Scenario: A reader follows a docs link

- **GIVEN** a documentation link in the portal, the docs builder, or the Python package
- **WHEN** a client requests that URL
- **THEN** the host is `quill.maplespike.ca` and the path begins with `/docs`

### Requirement: The portal serves an HTML API reference

The portal MUST serve a human-readable HTML page at `/api-reference` that renders `/v1/openapi.json`. The portal MUST link to that page.

#### Scenario: A reader opens the API reference

- **GIVEN** the built portal
- **WHEN** a client requests `/api-reference`
- **THEN** the response is HTML that loads the OpenAPI document from `/v1/openapi.json`

### Requirement: Analytics hosts are explicit

The portal Content-Security-Policy MUST allow `https://plausible.io` and `https://static.cloudflareinsights.com` in `script-src`. It MUST allow `https://plausible.io` and `https://cloudflareinsights.com` in `connect-src`. It MUST NOT use a wildcard for those registrable domains.

#### Scenario: The beacon and the analytics script load

- **GIVEN** the CSP on the portal response
- **WHEN** the browser loads `https://plausible.io/js/script.js` and posts to `https://cloudflareinsights.com/cdn-cgi/rum`
- **THEN** both hosts are present as exact host sources

### Requirement: Sitemap and robots use the Quill host

`robots.txt` MUST name `https://quill.maplespike.ca/sitemap.xml`. Every URL in `sitemap.xml` MUST use `https://quill.maplespike.ca`.

#### Scenario: A crawler reads the sitemap

- **GIVEN** the published `robots.txt` and `sitemap.xml`
- **WHEN** a crawler follows the sitemap directive
- **THEN** the sitemap host is `https://quill.maplespike.ca` and no URL uses `https://maplespike.ca`
