# Municipal Portal Deployment — Production Runbook

**Why this exists** — Quill's municipal data router hits each registered city's
own open-data portal (CKAN, Socrata, ArcGIS Hub). Many of these portals are
hosted behind Cloudflare with default bot-detection rules that block our
production egress IP. Without allowlisting, ~70% of cities return
`provenance.status: "unavailable"` even though the route layer is correct.

**Goal** — Achieve `province.status: "live"` for every registered Canadian
city with at least one reachable upstream portal.

---

## Production egress IPs to allowlist

Quill production runs on a K3s cluster behind Cloudflare Tunnel. The egress
IPs that hit municipal portals are the **node-pod egress IPs** on the
cluster, not the Cloudflare Tunnel ingress IPs. Add these to each portal's
Cloudflare allowlist rule:

| Cluster | Egress IP (update per env) | Notes |
|---------|---------------------------|-------|
| prod    | TBD by `kubectl get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="InternalIP")].address}'` | principal node pool |
| prod-backup | same as prod | shared IP pool |
| dev     | same — dev uses separate cluster | tag with `quill-dev` |

Update this table when the node pool is re-provisioned.

---

## Per-portal unblock steps

### Toronto (CKAN) — `https://open.toronto.ca`
1. Email `opendata@toronto.ca` and request a bot-detection bypass for
   your production egress IP. Cite the User-Agent string
   `Mozilla/5.0 (compatible; Quill/0.2; +https://quill.maplespike.ca)`.
2. Confirm Cloudflare rule on their side:
   ```
   (ip.src in {<your-ip>}) and (http.user_agent contains "Quill")
   ```
3. Verify with:
   ```bash
   curl -sS -A "Mozilla/5.0 (compatible; Quill/0.2; +https://quill.maplespike.ca)" \
     -w '\n%{http_code}\n' --max-time 10 \
     https://open.toronto.ca/api/3/action/package_search?q=budget&rows=1
   ```
   Expect HTTP 200 + JSON body, not 403/HTML.

### Vancouver (Socrata) — `https://opendata.vancouver.ca`
1. Socrata sites tolerate the same User-Agent if rate-limited at 5 req/s.
2. Production rate-limit defaults are 5/s unauthenticated. Set
   `QUILL_MUNICIPAL_MAX_JOBS=15` so production never bursts 4 concurrent
   per second.
3. No explicit allowlist request is needed for Vancouver, but the friendly-
   name slugs (`budget`, `permits`) need to resolve to real 4×4 IDs via
   `/api/views.json?search=<slug>&limit=1`. This runs in our
   `resolveSocrataDatasetId` discovery and is auto-cached per process.

### Calgary (Socrata) — `https://data.calgary.ca`
1. Same as Vancouver. Test with:
   ```bash
   curl -sS -A "Mozilla/5.0 (compatible; Quill/0.2)" \
     https://data.calgary.ca/api/views.json?search=budget | head -c 200
   ```

### Edmonton (Socrata) — `https://data.edmonton.ca`
1. Friendly-name `311-calls` is a known issue — actual 4×4 ID needed.
   Run discovery script once warm:
   ```bash
   DEBUG=discover tsx scripts/discover-municipal-ids.ts edmonton
   ```

### Hamilton (CKAN) — `https://open.hamilton.ca`
1. CKAN behind Cloudflare — same Email + allowlist path as Toronto.
2. Friendly-name slugs (`budget`, `permits`) need discovery.

### Mississauga (CKAN) — `https://data.mississauga.ca`
1. CKAN behind Cloudflare. Same Email + allowlist path.

### Kitchener, Brampton, Richmond, Regina, Halifax, Victoria, Montreal
All CKAN — same email/allowlist pattern. CKAN marketplaces generally
respond well to polite User-Agent strings.

### Surrey, Burnaby (ArcGIS Hub)
1. ArcGIS Hub uses OGC API Records. Rate limit is higher (30 req/s) but
   payload sizes are large. Set `QUILL_HTTP_TIMEOUT_MS=30000` for first
   call.
2. No bot-detection typically. Smoke:
   ```bash
   curl -sS https://data.surrey.ca/api/search/v1/collections/all/items?limit=1 | head -c 200
   ```

---

## Rollout strategy

1. **Day 0** — Deploy this commit (`0963946` + later) without changing
   feature flags. Expect ~3 cities live, 8 unavailable.
2. **Day 1-7** — Submit email allowlist requests for Toronto + Vancouver
   + Calgary + Hamilton + Mississauga (top 5 by usage). Bright-data
   scrapers can be detected, so use a polite prose-heavy email mentioning
   Canadian civic data mission.
3. **Day 8** — Once allowlist confirmed, set
   `QUILL_MUNICIPAL_MAX_JOBS=20` in prod. Smoke test from production
   ingress:
   ```bash
   curl -sS https://api.maplespike.ca/v1/municipal/toronto \
     -H 'X-API-Key: <prod-test-key>' | jq '.data.provenance.status'
   ```
   Expect `"live"` or `"partial"`.
4. **Day 9** — Once 5+ cities serve live, bump
   `QUILL_MUNICIPAL_MAX_JOBS=30` and re-test. Continue rollout.

---

## Roll-back strategy

If `provenance.status: "partial"` starts appearing on previously `live`
cities:

1. **Unset** `QUILL_MUNICIPAL_MAX_JOBS` (back to default 12).
2. **Drop** the in-process cache by restarting the worker pods:
   ```bash
   kubectl rollout restart deployment/quill-api -n maplespike
   ```
3. **Investigate** the upstream failure rate via:
   ```bash
   kubectl logs -n maplespike -l app=quill-api --tail=200 \
     | grep -E 'Municipal|Cloudflare|429'
   ```
4. **If upstream is throttling**, set
   `QUILL_HTTP_TIMEOUT_MS=15000` (slow down) and lower
   `QUILL_MUNICIPAL_MAX_JOBS=8`.
5. **If upstream outright blocks** (Cloudflare 403), temporarily disable
   that portal's entries by setting `enabled: false` in
   `MUNICIPAL_PORTALS` for that city. Runbook for that city gets a
   `blocked-known-issue: true` annotation in the change-management log.

---

## Monitoring

Add to the existing Grafana dashboard
`config/grafana/dashboards/quill-municipal.json`:

- **Panel: Per-city live rate** —
  `count_over_time(quill_provenance_status_total{status="live"}[1h]) / count_over_time(quill_provenance_status_total[1h])`
  grouped by `city`.
- **Panel: Discovery cache hit rate** —
  `sum(rate(quill_id_cache_hits[5m])) / (sum(rate(quill_id_cache_hits[5m])) + sum(rate(quill_id_cache_misses[5m])))`
- **Alert** if any city's live rate drops below 0.7 for 30 minutes.
  Use `config/grafana/provisioning/contact-points.yaml` to route.

---

## Open follow-ups

1. Build an automated Cloudflare rule maintainer that updates
   `QUILL_HEALTH_BADGE` based on per-city live-rate metric.
2. Consider reaching out to OpenDataSoft (Socrata's parent) for a paid
   enterprise key — 5× higher rate limit + commit bypass for known
   partnership-tier users.
3. Explore CKAN-harvester endpoint inheritance from open.canada.ca —
   many provincial portals already publish via the federal CKAN instance.
