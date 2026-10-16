# Verification — 2026-10-16

## Passed
- `pnpm build`: 13 workspace build tasks passed. One existing Turbo output warning for the docs package.
- `pnpm --filter @maplespike/portal exec astro check`: zero errors and warnings; 21 existing informational hints.
- `pnpm --filter @maplespike/portal test`: 87 tests passed across ten files, including six new design contract tests, a French checkout-label/redirect regression, and two payment SDK startup regressions.
- `pnpm --filter @maplespike/portal smoke:dist`: all assertions passed. The menu binding check covers Astro's inline and external module forms.
- `node packages/portal/scripts/check-design-browser.mjs`: 153 route/viewport checks passed through the actual Python production server. Includes 390px, 768px, and 1440px; English and French routes; one main and h1; no external font requests; no document overflow; no browser exceptions.
- Repeated the complete browser suite with the production publishable-key build: 153 checks passed. No live payment session was created.
- Interaction checks passed: menu and Escape focus return, route active state, SPA return, French auth display, clipboard success and denial, search handoff with API fixture, persistent header after scroll, skip link, account display fixture, no-JavaScript navigation, and reduced motion.
- Count consistency and nine generated-artifact comparisons passed.
- `git diff --check` passed.
- Decorative local ComfyUI artwork: 41,958-byte WebP. Prompt/model/seed/workflow retained in the source tree.
- DESIGN.md references checked against real implementation paths. Obsolete dark-dashboard guidance and stale numeric claims removed.

Browser evidence: `/tmp/quill-design-review/results.json` and 18 desktop/mobile screenshots. These are local review artifacts, not committed production files.

## Workspace test limitation
The first full test run failed MCP startup and pipeline tests. The documented `scripts/build-packages.sh` injected-copy repair resolved MCP startup: all 256 active MCP tests passed; 10 existing tests skipped. API tests also passed.

After the repair, `NODE_ENV=test pnpm test` completed with 20/21 Turbo tasks successful. The unchanged pipeline-core suite failed. Its Qdrant embedder tests import `src/utils/logger.ts`, which configures `pino-pretty` outside production, but pipeline-core does not declare or resolve that package. A direct isolated embedder test reproduces `unable to determine transport target for "pino-pretty"`. This change does not alter that logger, dependency manifest, or test suite. The full workspace suite is not reported as passing.

No live purchases, account creation, credential rotation, or user-data mutation were performed. Browser auth/search fixtures prove presentation and request handoff, not live payment processing.

## Runtime repairs found during design checks
- Route language was overwritten by the legacy global script.
- French pricing islands selected a different language during hydration. Locale is now an explicit prop.
- Status polling retained route listeners after navigation, and React badge classes passed as `class` were dropped. Component calls now use `className`; status polling cleans up on route exit.
- The production-key checkout build loaded Stripe before authentication and did not handle SDK-load rejection. Startup now checks auth first and displays SDK errors; two regression tests cover it. The existing runtime CSP still needs a separate authenticated embedded-payment audit; this release does not claim live payment verification.
- Documentation had a nested main landmark and narrow-screen code overflow. Both were repaired.

## Release state
User authorised testing and deployment. Release must use a reviewed PR and a portal-only image digest in Helm values, with imports on both eligible nodes (nexus and forge). Production portal had two available replicas before release; ArgoCD's pre-existing degraded state involved ingestion jobs. Do not claim a rollout until the image digest and public page content are verified.

Candidate portal image `2026-10-16-c857c656` was built on nexus, scanned with syft (1,554 SPDX entries), and imported with its digest name on nexus and forge. Digest: `sha256:632fc8ed5935f7376284daf624a1b7984ccaa4e0c8e565c1131b72d2f12b2d60`. Only the portal pin changes. Source PR: #1092. Deployment remains pending PR review/checks and ArgoCD sync.
