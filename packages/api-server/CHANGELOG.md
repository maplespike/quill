# @maplespike/api-server

## 0.3.0

### Minor Changes

- [#1148](https://github.com/maplespike/quill/pull/1148) [`dd3c713`](https://github.com/maplespike/quill/commit/dd3c7138fa7e0976f0c9d68f41f1e748f1f73284) Thanks [@reverb256](https://github.com/reverb256)! - Add `GET /v1/upstream/status` and an upstream outage notice.

  A declarative `upstream-maintenance` config (10 government hosts, EN+FR copy) drives an
  in-process prober with N-of-M hysteresis: DOWN needs 3 failures in a 5-minute window, leaving
  DOWN needs 5 consecutive successes. The route reports `up`, `degraded`, `down`, `scheduled`,
  `partial` (StatCan's nightly data lock), `announced` (NL's portal shutdown) or
  `blocked_permanent` (lobbycanada 403 — logged, never a banner). An expected-back time appears
  only inside a declared window; observed downtime reports `null` and may say "usually".

  The portal renders one line when a host affecting a feature is not up, with a link to the
  publisher's own status page and no personal data. No database migration: state is in memory and
  rebuilt within one probe interval after a restart. Set `QUILL_UPSTREAM_PROBE=0` to disable
  probing.

### Patch Changes

- [`590cfbf`](https://github.com/maplespike/quill/commit/590cfbf5e951b9209f48ffdc14a183353c143244) Thanks [@reverb256](https://github.com/reverb256)! - Nix-first deployment: all images, SaaS K8s manifests, self-host units, and NixOS module are now generated from the flake. The old easykubenix-based `k8s/*.nix` modules, hand-maintained `k8s/base/*.yaml` Kustomize path, and `Dockerfile`/`docker-compose.yml` have been removed.

  **Changes:**
  - Fixed the portal OCI image derivation to actually build Astro `dist/` (was copying raw source).
  - Added `nix/saas-manifests.nix` — Nix generator for cloudflared-shaped K8s manifests matching the live SaaS (namespace, cloudflared tunnel, api/mcp/portal Deployments+Services, LAN Traefik Ingress). `nix build .#saas-manifests` → `result/manifests.yaml`.
  - Added `nix/selfhost.nix` — Podman Quadlet `.container`/`.volume`/`.network` units for one-touch self-hosting. `nix run .#selfhost up` or `./selfhost.sh up`.
  - Implemented `services.maplespike` NixOS module (was options-only stub).
  - Added `vite ^7.3.6` and `tailwindcss 4.1.7` pins to portal (prevents clean-Nix resolution to Vite 8 which breaks `@tailwindcss/vite`).
  - Added `@types/node` to `packages/i18n` (prevents TS2688 in clean builds).
  - Switched flake to `--frozen-lockfile` for deterministic builds.
  - Removed easykubenix modules (`k8s/*.nix`), root-level `Dockerfile` and `docker-compose.yml`.
  - Removed hand-maintained `k8s/base/`, `k8s/overlays/`, `k8s/manual/` (superseded by Nix generator).
  - Updated `docs/NIX-FIRST-WORKFLOW.md` and `docs/K8S-NIX-MANIFESTS.md`.
