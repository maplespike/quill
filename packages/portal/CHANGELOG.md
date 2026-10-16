# @maplespike/portal

## 0.3.1

### Patch Changes

- [`8394df0`](https://github.com/maplespike/quill/commit/8394df047355f423d061681479d6c3c356c56139) Thanks [@reverb256](https://github.com/reverb256)! - Nix-first deployment: all images, SaaS K8s manifests, self-host units, and NixOS module are now generated from the flake. The old easykubenix-based `k8s/*.nix` modules, hand-maintained `k8s/base/*.yaml` Kustomize path, and `Dockerfile`/`docker-compose.yml` have been removed.

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
