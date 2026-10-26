# Review

Checked live on 2026-10-26 before editing:

- `docs.maplespike.ca` is NXDOMAIN. The live HTML pages that were fetched do not contain that hostname. The broken docs URLs in the repo are `https://maplespike.ca/docs`, and `https://maplespike.ca/docs` returns 404. `GET https://quill.maplespike.ca/docs` returns 200.
- `https://quill.maplespike.ca/v1/openapi.json` returns the OpenAPI document. `/api-reference` returned 404.
- The portal CSP allows `https://static.cloudflareinsights.com` for scripts and connect, and does not allow `https://plausible.io` or `https://cloudflareinsights.com`. The beacon posts to `https://cloudflareinsights.com/cdn-cgi/rum`.
- `robots.txt` and `sitemap.xml` use `https://maplespike.ca`. `https://maplespike.ca/sitemap.xml` returns 404.

The change follows that evidence. No secrets are included.
