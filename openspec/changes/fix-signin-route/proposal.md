# Proposal: Fix /signin 404 by aliasing to /signup (issue #782)

## Problem
The portal login link points to `/signin`, but that route returns **404** in
production (`https://quill.maplespike.ca/signin` → 404). The canonical auth page
is `/signup`, which returns 200. Users following the login link land on a 404.

## Root cause
The portal is an Astro **static** site (`output: 'static'`, `build.format: 'file'`)
served by nginx whose `location /` uses `try_files $uri $uri/ $uri.html =404`.
There is no `signin.html` artifact, so `/signin` falls through to `=404`.

## Proposed fix
Add `packages/portal/src/pages/signin.astro` — a real, self-contained redirect
page that aliases `/signin` → `/signup`:
- Uses an HTTP-equivalent `<meta http-equiv="refresh" content="0; url=/signup">`
  (correct for static output, where the SSR-only `Astro.redirect()` is unavailable).
- Includes a `window.location.replace('/signup')` JS fallback and a `<noscript>`
  anchor link so redirection works with scripting disabled.
- Sets a `<link rel="canonical" href="/signup">` so crawlers attribute the page
  to the canonical auth route.

nginx serves it at `/signin` (resolving `/signin` → `/signin.html`), returning
**200**, and the browser is redirected to `/signup`.

## Affected packages
- `packages/portal` (new source file; no dependency or API changes)

## Verification gate
- `GET https://quill.maplespike.ca/signin` must return **200** (not 404); the
  served body must contain a redirect to `/signup`.
- `GET https://quill.maplespike.ca/signup` must remain **200**.
- The running `quill-portal` Deployment image digest must change after rollout.
