# Vendored browser bundle

`pretext.js` is the browser build of [`@chenglou/pretext`](https://www.npmjs.com/package/@chenglou/pretext)
(MIT), bundled for the static demo pages in `assets/`.

## Why it is vendored

`assets/ascii-city.html` and `assets/canadian-sunset.html` are standalone demo
pages. They used to import the library straight from `https://esm.sh/...`,
which the portal's own Content-Security-Policy does not permit: `script-src` is
`'self'` plus an explicit list of analytics and payment origins. The CSP audit
(`packages/portal/e2e/csp-audit.mjs`) reported both pages as
`script-src-elem blocked https://esm.sh/@chenglou/pretext@0.0.6`.

The library is already an npm dependency of the portal, so it is bundled here
and imported from `./vendor/pretext.js` — same behaviour, no third-party
script origin, and the CSP audit passes without weakening the policy.

## How it was produced

From the repository root, with the pinned dependency in `node_modules`:

    node_modules/.pnpm/node_modules/.bin/esbuild \
      node_modules/@chenglou/pretext/dist/layout.js \
      --bundle --format=esm --minify --legal-comments=none \
      --outfile=packages/portal/assets/vendor/pretext.js

The same file is copied to `packages/portal/public/assets/vendor/pretext.js`
(the directory the site actually serves from). When the dependency is bumped,
regenerate the bundle the same way and update both copies in one commit.
