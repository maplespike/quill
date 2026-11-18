---
last-reviewed: 2026-11-09
status: active
---

# Status page host

The public status page is `packages/portal/src/pages/status.astro`. It is served today at `/status` on the portal host.

`status.maplespike.ca` is prepared. It is not a new Cloudflare product. Do not buy a certificate, a load balancer, a Worker, or a second tunnel.

## What already runs

The page reads three public, auth-exempt endpoints. The responses are totals, timestamps, and source hosts. They do not include record bodies or personal data.

| Endpoint | What the page shows |
| --- | --- |
| `GET /v1/status` | Check timestamp, freshness windows, claim count, public endpoint map |
| `GET /v1/municipal/health` | Per-city cache state, last success, last check |
| `GET /v1/municipal/coverage` | Cached datasets, record counts, success timestamps |

The portal process maps `Host: status.maplespike.ca` and `Host: status.quill.lan` so `GET /` returns the status page. `GET /status` still works on every portal host.

Chart values already list the hostname:

- `charts/quill/values.yaml`
- `charts/quill/values-prod.yaml`

Both rules use the existing portal Service:

```text
hostname: status.maplespike.ca
service: http://quill-portal.maplespike.svc.cluster.local:8080
```

`cloudflared.enabled` is false in `values-prod.yaml`. A chart sync does not start a tunnel and does not publish the name.

## Operator steps

Do these on the existing zone and the existing tunnel. Stop if a step asks for a paid add-on.

1. Read the live tunnel rule for `quill.maplespike.ca` in the cloudflared ConfigMap. Copy that service address. Do not create a tunnel.
2. Add one ingress rule in front of the final `http_status:404` rule:

```yaml
- hostname: status.maplespike.ca
  service: <same portal address as quill.maplespike.ca>
```

The live manifest pins a ClusterIP because the tunnel image does not resolve cluster DNS. Use that address when the live file uses a pinned IP. Use the chart Service name only when the live file already uses Service DNS.

3. In the existing Cloudflare zone `maplespike.ca`, add one DNS record. Match the record type and target already used by `api.maplespike.ca` (a proxied CNAME to `<tunnel-id>.cfargotunnel.com`). Name: `status`. Leave the proxy on. Universal SSL on the existing zone covers the name. Do not upload a certificate.
4. Roll the portal only if the running image does not yet include this host map. Then check:

```bash
curl -sI -H 'Host: status.maplespike.ca' http://127.0.0.1:8080/
curl -sI https://status.maplespike.ca/
curl -s https://status.maplespike.ca/ | head
```

Expect HTTP 200 and the status page. `https://quill.maplespike.ca/status` stays valid.

## Do not

- Do not create a Cloudflare Load Balancer, Spectrum app, or paid Worker.
- Do not add a new tunnel or a new zone.
- Do not put this hostname on a path that returns record bodies.
