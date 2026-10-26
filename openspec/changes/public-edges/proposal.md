# Proposal: public edges

## Why

The live Quill site advertises hosts and policies that do not work. `docs.maplespike.ca` does not resolve. `https://maplespike.ca/docs` returns 404. The portal Content-Security-Policy blocks Plausible and the Cloudflare Web Analytics beacon. `robots.txt` and `sitemap.xml` name `https://maplespike.ca`, which does not serve those files. The OpenAPI document is JSON only.

## What Changes

- Point documentation URLs at `https://quill.maplespike.ca/docs`, which already serves the docs page.
- Serve a human-readable API reference at `/api-reference` and link it from the portal.
- Allow the exact Plausible and Cloudflare Web Analytics script and connect hosts.
- Publish the sitemap and robots file on `https://quill.maplespike.ca`, and test that host.

## Capabilities

### New Capabilities

- `public-edges`: public documentation URL, HTML API reference, analytics CSP, and sitemap host.

### Modified Capabilities

## Impact

- Portal static files, `server.py`, nginx template, and `_headers`.
- Docs canonical URLs in `scripts/build-docs.mjs`.
- SDK and Python package documentation URLs.
- New dependency: `@scalar/api-reference` in the portal.
- No DNS record is added. Production still needs a portal image rebuild before the origin serves the new files. The Helm pin in `charts/quill/values-prod.yaml` is unchanged.
