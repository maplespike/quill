# Batch 3: Caddy Routing Fix

## The Problem

Caddy at `https://civint.lan/` currently routes to `127.0.0.1:3000` (Python http.server serving the portal landing page). It should route to `10.1.1.120:30964` (the K8s NodePort for the civint-web pod serving the Next.js CivicIntel dashboard).

This means `civint.lan` shows the wrong frontend — the marketing portal instead of the product dashboard.

## What to Do

1. Check current Caddy route: `curl -s http://127.0.0.1:2019/config/`
2. Update route from `127.0.0.1:3000` to `10.1.1.120:30964`
3. Verify the civint-web pod is running: `kubectl get pods -n ai-inference | grep civint-web`
4. Test: `curl -sk https://civint.lan/ | head -c 200`

## How to Fix

Option A: Update Caddy config via API (if available)
```
curl -X PATCH -d '10.1.1.120:30964' http://127.0.0.1:2019/config/apps/http/servers/srv0/routes/.../handle/0/upstreams/0/dial
```

Option B: Update the NixOS config and rebuild
- File: /etc/nixos/hosts/zephyr/caddy-routes.nix
- Find `mkRoute "civint.lan" "http://${nexus}:30964"` — it should already be correct
- Run: sudo nixos-rebuild switch

Option C: Direct Caddyfile edit and reload
- Check /etc/caddy/Caddyfile or /var/lib/caddy/configs/
- Change the backend address and reload: sudo systemctl reload caddy

## Verification

1. `curl -sk https://civint.lan/` returns the Next.js dashboard (title: "CivInt Canada — Civic Pulse Dashboard" or similar), not the portal landing page
2. The portal landing page is still accessible directly at `http://10.1.1.110:3000/`
3. No certificate errors
