# 0006 — Quill hostname alias migration (Phase D)

**Status:** ACCEPTED (2026-07-02)
**Date:** 2026-07-02
**Owner:** j_kro
**Driver:** ADR 0005 (Quill product name) Phase D row marked "Highest — Cloudflare token policy blocks." The legacy `mcp.maplespike.{ca,lan}` and `data.maplespike.ca` hostnames still resolve to the data-layer MCP server, but they're now misnamed ("mcp" reads as Model Context Protocol, not as the canonical product surface; "data" reads as the old "data-fabric" framing that Quill replaces). This ADR records the migration to canonical `quill.maplespike.{ca,lan}` with backward-compat redirects so existing bookmarks and integrations don't break.

## Decision

Make `quill.maplespike.ca` and `quill.maplespike.lan` the **canonical** hostnames for the data-layer MCP server (Quill). Treat the legacy `mcp.maplespike.{ca,lan}` and `data.maplespike.ca` as **301-redirect aliases** to the canonical hostnames.

## Naming criteria

1. **Single canonical surface** — bookmarks, MCP client configs, API documentation, and CI must agree on one hostname per network.
2. **Backward compatibility** — anything that already bookmarks or hardcodes the old hostnames continues to work (with one redirect).
3. **Self-hostable** — the LAN family (`*.lan`) validates against the local step-ca as before; the public family (`*.ca`) via Cloudflare Universal SSL.
4. **Reversible** — every DNS / tunnel rule can be reverted in one step if a regression hits.

## Hostname plan

| Hostname | Role | Action |
|---|---|---|
| `quill.maplespike.ca` | canonical public | add DNS + Tunnel ingress rule |
| `quill.maplespike.lan` | canonical LAN | add LAN A record + Traefik rule |
| `mcp.maplespike.ca` | public alias | 301 → `quill.maplespike.ca` |
| `mcp.maplespike.lan` | LAN alias | 301 → `quill.maplespike.lan` |
| `data.maplespike.ca` | public alias (was portal surface) | 301 → `quill.maplespike.ca` |

## Architecture

Two layers of redirect, by design — defense in depth:

1. **DNS-layer (CNAME):** `mcp.maplespike.ca` already resolves into the same Cloudflare zone as `quill.maplespike.ca`; same Tunnel UUID. Reuse the existing route.
2. **Tunnel-layer (cloudflared ingress):** rewrite `mcp.maplespike.{ca,lan}` to `quill.maplespike.{ca,lan}` with a 301. Cloudflare Tunnel v2 supports per-hostname rewrites.
3. **Edge-Worker fallback (optional):** for `data.maplespike.ca` which previously routed to the portal surface (`maplespike-portal:8080`), keep a Cloudflare Worker that 301s to `quill.maplespike.ca` — the Worker is the only layer that knows the cross-Service history. (See `maplespike-brand/public/_redirects` for the brand SPA's local comment block.)
4. **LAN-side (k3s Traefik):** wildcard `*.maplespike.lan` Ingress handles both `mcp` (legacy) and `quill` (canonical) hostnames; the legacy one uses `permanent-redirect` annotation.

## Drop-in configurations

### 1. Cloudflare DNS (`homelab-ops/terraform/cloudflare.tf`)

```hcl
# CNAME for the canonical Quill hostname (subdomain-proxy enabled
# so Tunnel handles it):
resource "cloudflare_record" "quill_maplespike_ca" {
  zone_id = var.maplespike_zone_id
  name    = "quill"
  type    = "CNAME"
  content = "${var.tunnel_id}.cfargotunnel.com"   # the existing cloudflared tunnel
  proxied = true
  ttl     = 1                                    # auto when proxied
  comment = "Quill · data-layer MCP product (Phase D canonical)"
}

# Alias records — same target, marker-only; the actual redirect is
# enforced at the Tunnel ingress below.
resource "cloudflare_record" "mcp_maplespike_ca_alias" {
  zone_id = var.maplespike_zone_id
  name    = "mcp"
  type    = "CNAME"
  content = "${var.tunnel_id}.cfargotunnel.com"
  proxied = true
  ttl     = 1
  comment = "Quill · legacy alias for mcp.maplespike.ca (Phase D, 301→quill.maplespike.ca)"
}

resource "cloudflare_record" "data_maplespike_ca_alias" {
  zone_id = var.maplespike_zone_id
  name    = "data"
  type    = "CNAME"
  content = "${var.tunnel_id}.cfargotunnel.com"
  proxied = true
  ttl     = 1
  comment = "Quill · legacy alias for data.maplespike.ca (Phase D, 301→quill.maplespike.ca)"
}
```

### 2. Cloudflare Tunnel config (`config/cloudflared/config.yml`)

```yaml
tunnel: maplespike
credentials-file: /etc/cloudflared/certs/maplespike.json

ingress:
  # --- Canonical: Quill (data-layer MCP) --------------------
  - hostname: quill.maplespike.ca
    service: http_status:301
    originRequest:
      httpHostHeader: maplespike-quill.maplespike.svc.cluster.local
    # Tags the request so the cluster-side Ingress (Traefik)
    # recognizes the rewritten Host header.
  - hostname: quill.maplespike.lan
    service: http_status:301
    originRequest:
      httpHostHeader: maplespike-quill.maplespike.svc.cluster.local

  # --- Legacy aliases: 301 → canonical ----------------------
  - hostname: mcp.maplespike.ca
    service: http_status:301
  - hostname: mcp.maplespike.lan
    service: http_status:301
  - hostname: data.maplespike.ca
    service: http_status:301

  # (the rest of the maplespike ingress rules continue unchanged)
```

> **Note:** Cloudflare Tunnel's `ingress.rules[*].service` does not
> directly support 301 with custom Location; the canonical pattern is
> to use the `cloudflared` `--destination` flag with `--header
> "Location: https://quill.maplespike.ca"` OR (preferred) put a small
> Cloudflare Worker in front of the legacy hostnames (see §3).
>
> In **k3s + Traefik**, the legacy LAN aliases are best handled by
> Ingress annotations (see §4).

### 3. Cloudflare Worker — fallback for legacy aliases (`homelab-ops/workers/quill-alias.js`)

```js
// Edge Worker: 301 redirect legacy hostnames to canonical quill.
// Deploy via `wrangler deploy` from homelab-ops/workers/.
//
// Routes (set in Cloudflare Dashboard → Workers → Routes):
//   mcp.maplespike.ca/*   → quill-alias
//   mcp.maplespike.lan/*  → quill-alias
//   data.maplespike.ca/*  → quill-alias
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = url.hostname;
    let target = null;
    if (host === "mcp.maplespike.ca" || host === "mcp.maplespike.lan") {
      target = `https://quill.maplespike.lan/`;   // LAN target — same backend either way
    } else if (host === "data.maplespike.ca") {
      target = `https://quill.maplespike.ca/`;
    }
    if (!target) return fetch(request);
    return Response.redirect(target + url.pathname + url.search, 301);
  },
};
```

### 4. k3s Traefik Ingress (`config/k8s/base/15-ingress-lan.yaml`)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: quill-maplespike-lan
  namespace: maplespike
  annotations:
    cert-manager.io/issuer: "step-issuer-lan"
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
spec:
  ingressClassName: traefik
  rules:
    - host: quill.maplespike.lan
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: maplespike-quill
                port:
                  number: 3001
  tls:
    - hosts:
        - quill.maplespike.lan
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-maplespike-lan-alias
  namespace: maplespike
  annotations:
    # Phase D: 301 redirect to canonical quill.maplespike.lan
    traefik.ingress.kubernetes.io/router.redirections.permanent: "true"
    traefik.ingress.kubernetes.io/router.redirections.redirect.regex: "^https?://mcp\\.maplespike\\.lan/(.*)"
    traefik.ingress.kubernetes.io/router.redirections.redirect.replacement: "https://quill.maplespike.lan/$1"
    traefik.ingress.kubernetes.io/router.redirections.redirect.statusCode: "301"
spec:
  ingressClassName: traefik
  rules:
    - host: mcp.maplespike.lan
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: maplespike-quill
                port:
                  number: 3001
  tls:
    - hosts:
        - mcp.maplespike.lan
```

### 5. Caddyfile legacy aliases (`config/Caddyfile.deprecated` — historical reference)

See the live file: `config/Caddyfile.deprecated` now carries both the
legacy `mcp.maplespike.lan` block (with a `redir` directive) and the
canonical `quill.maplespike.lan` block (with the `reverse_proxy`).
Once you've migrated fully to Traefik, you can delete this file.

## Consequences

- ✅ **Single canonical surface.** All bookmarks, MCP client configs, and new docs reference `quill.maplespike.{ca,lan}`.
- ✅ **No regression for existing users.** Every legacy hostname 301s to the canonical one.
- ✅ **Reversible.** Removing the redirect annotations / Worker routes / DNS CNAMEs reverts to the legacy state.
- ⚠️ **Need step-ca renewal cycle re-pin.** The wildcard `*.maplespike.lan` cert already covers `quill.maplespike.lan`; no renewal action needed.
- ⚠️ **SEO.** If external pages link to `mcp.maplespike.ca` or `data.maplespike.ca`, they'll see a 301 chain. Audit with `curl -I https://mcp.maplespike.ca/` after rollout.
- ⚠️ **Worker cost.** Cloudflare Workers (free tier) are fine; the redirect Worker fits in the free 100k req/day budget.

## Rollback

If the rollout produces unexpected 5xx errors:

1. **DNS:** `terraform apply -target cloudflare_record.quill_maplespike_ca` → comment out the destroy, or revert the CNAME by hand in the Dashboard.
2. **Tunnel:** revert the new `ingress` rules by restoring the prior `config/cloudflared/config.yml` and re-running cloudflared.
3. **Traefik:** `kubectl apply` the prior `k8s/base/15-ingress-lan.yaml` from git history.
4. **Worker:** `wrangler rollback quill-alias` to roll the Worker to the previous version.

Total rollback time: <5 minutes if Terraform state is current.

## Verification (post-rollout)

```bash
# Canonical
curl -I https://quill.maplespike.ca/      # expect 200 (or 401 if path needs auth)
curl -I https://quill.maplespike.lan/      # expect 200

# Legacy aliases
curl -I https://mcp.maplespike.ca/         # expect 301 → quill.maplespike.ca
curl -I https://mcp.maplespike.lan/        # expect 301 → quill.maplespike.lan
curl -I https://data.maplespike.ca/        # expect 301 → quill.maplespike.ca

# DNS
dig quill.maplespike.ca +short             # expect CNAME → <tunnel-id>.cfargotunnel.com
```

## References

- ADR 0005 — Quill product name (source: rename commitment, Phase D row)
- `docs/ROUTING.md` — operative routing matrix with Phase D status markers
- `docs/products/quill.md` — Quill product brief
- `config/Caddyfile.deprecated` — historical host-side proxy, updated for Phase D
