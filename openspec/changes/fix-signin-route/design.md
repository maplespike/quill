# Design: /signin → /signup alias

## Why a meta-refresh page (not `Astro.redirect`)
The portal builds with `output: 'static'`. `Astro.redirect()` is only available
during on-demand/SSR rendering and throws at static-build time ("`Astro.redirect`
is not available in static mode"). So the alias must be a static asset.

## Mechanism
1. `signin.astro` renders a minimal HTML document containing:
   - `<meta http-equiv="refresh" content="0; url=/signup">` — the primary redirect.
   - `<script>window.location.replace('/signup')</script>` — immediate JS redirect
     that also replaces the history entry so `/signin` doesn't stay in the back stack.
   - `<noscript><a href="/signup">sign in</a></noscript>` — graceful no-JS fallback.
   - `<link rel="canonical" href="/signup">` — SEO attribution to the canonical page.
2. Astro emits `dist/signin.html`.
3. nginx `try_files $uri $uri/ $uri.html =404` serves `/signin` → `signin.html`
   with **200**, and the client is redirected to `/signup`.

## Build/deploy path
- Serving path is the **k8s Deployment** `quill-portal` (namespace `maplespike`,
  2/2 pods, image `nexus:5000/quill-portal:latest`), NOT Cloudflare Pages.
- Rebuild via `podman build --format docker --no-cache -f Dockerfile.portal`.
- Push with `podman push --format docker --tls-verify=false` to
  `nexus:5000/quill-portal:<tag>` and pin the Deployment to the pushed digest.
- Roll out with `kubectl rollout restart deployment/quill-portal -n maplespike`.
