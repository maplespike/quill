---
"@maplespike/api-server": patch
---

Cloudflare D1, KV, and R2 writes read Infra's `quota:<service>` flag and stay on the in-cluster store unless the flag is `ok`.
