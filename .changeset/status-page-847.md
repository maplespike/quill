---
"@maplespike/api-server": minor
"@maplespike/portal": minor
---

Show municipal health, coverage, and freshness on the public status page.

`/status` renders aggregate totals and timestamps from `GET /v1/status`, `GET /v1/municipal/health`, and `GET /v1/municipal/coverage`. Record search stays authenticated. `status.maplespike.ca` serves that page at `/`. DNS steps are in `docs/ops/STATUS-PAGE.md`. No new paid Cloudflare product.
