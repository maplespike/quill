# Design — Public Record

## Context
Astro static pages share BaseLayout and React UI primitives. The existing ink-and-paper theme already ships local Newsreader, Source Sans 3, and IBM Plex Mono fonts. Marketing pages still use external fonts and unrelated dark styling. public/script.js overrides page language and theme after load. Root redirects discard query/hash state.

## Goals / Non-Goals
Create one editorial research product. Make discovery, research, verification, and developer setup legible. Preserve existing data/auth/billing behavior. Do not redesign APIs, add providers, or change prices. The user subsequently authorised a verified portal-only production release.

## Decisions
- Extend the existing theme to all routes rather than add a competing palette. Keep its tested contrast roles unchanged. Use red sparingly as a nonessential editorial accent.
- Retain BaseLayout metadata/footer attribution and auth container. Rebuild header and add a product tool rail within this layout. Replace the shrinking/disappearing nav with a stable header.
- Use semantic CSS classes for shared layout and landing sections; keep Tailwind and React primitives for functional islands. Add data-slot markers to shared panel primitives for consistent refinement without brittle class matching.
- Landing: split editorial hero plus decorative source atlas, real search form, generated coverage band, numbered research pathways, source directory, provenance explainer, dark integration console, restrained final CTA.
- Generated art is decorative with empty alt text. Record model/prompt/seed. Optimise locally to WebP. Avoid text, fabricated charts, and invented data claims.
- Use existing explorer form query/category interfaces. Data flow is browser -> existing page -> existing API; no new endpoint.
- Rebind copy and menu controls idempotently on astro:page-load. Preserve language set by the route; never overwrite it from a different stored browser preference.
- Static content is visible by default. Motion is optional, never a visibility gate.

## Risks / Trade-offs
- Broad theme scope can expose hardcoded colours in pages -> inspect built routes at desktop and mobile sizes and repair real issues.
- Wide tables/code can overflow -> constrain grid children and scroll at the content boundary, not hide document overflow.
- Auth JS relies on header selectors -> preserve signup href, nav-auth-container, and functional hooks; test transitions.
- Local image generation can be slow or poor -> use one restrained illustration and keep all meaning in HTML.
- Existing typecheck errors can predate the work -> record baseline before edits and distinguish new errors.

## Security
No credentials, API keys, live purchases, or authenticated mutations are used. Clipboard failures are surfaced. Existing legal disclosures remain. Local browser tests use controlled API fixtures only when needed and label them as fixtures.

## Migration Plan
Build and preview in isolated issue worktree. Repository policy requested /data/projects/own but that path is not writable; use /home/j_kro/Work/quill-1090 instead. Review verified diff before any separately authorised commit/push/deploy. Rollback is reverting portal and spec changes; no data migration.

## Open Questions
None blocking. User delegated design direction and approved use of local ComfyUI.
