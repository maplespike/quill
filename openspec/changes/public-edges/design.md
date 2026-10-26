# Design: public edges

## Documentation host

`docs.maplespike.ca` returns NXDOMAIN. The repo does not contain a DNS or tunnel rule for that name. `GET https://quill.maplespike.ca/docs` returns the documentation page. Links that used `https://maplespike.ca/docs` now use `https://quill.maplespike.ca/docs`. No DNS change is required. Creating `docs.maplespike.ca` would be a Cloudflare DNS and tunnel change outside this repo.

## API reference

`/api-reference` is an Astro page. It bundles `@scalar/api-reference` and reads `/v1/openapi.json` from the same origin. Telemetry and Scalar's hosted fonts stay off so the page does not need extra CSP hosts. The footer, docs page, API explorer, and `llms.txt` link to it.

## Analytics CSP

Plausible's script and event endpoint are both `https://plausible.io`. The Cloudflare beacon script is `https://static.cloudflareinsights.com/beacon.min.js`. The beacon posts to `https://cloudflareinsights.com/cdn-cgi/rum`. `connect-src` allows that host and no longer lists `static.cloudflareinsights.com`, which the beacon does not call. The same hosts are set in `server.py`, `nginx.conf`, and `public/_headers`.

## Sitemap

`packages/portal/public/sitemap.xml` and `packages/portal/public/robots.txt` are the files the site serves. Their absolute URLs use `https://quill.maplespike.ca`. A Vitest file reads those sources.

## Rollout

These files ship in the portal image. `charts/quill/values-prod.yaml` pins that image by digest. Argo CD will not serve this change until a new portal image is built and the pin is updated. The API `llms.txt` line ships in the API image the same way.
