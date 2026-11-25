---
"@maplespike/api-server": patch
---

Send CORS and security headers on Redis cache hits.

A cached GET from the Node server used to answer with only Content-Type and X-Cache-Status. The portal status page fetches /v1/health, so a cache hit failed the browser CORS check. Cache hits, rate-limit responses, and server errors now share one header helper with the normal response path.
