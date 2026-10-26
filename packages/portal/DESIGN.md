---
version: superseded
name: Quill Portal
superseded_by: ../../DESIGN.md
updated: 2026-10-26
description: >-
  Superseded. The portal ships the Public Record ink-and-paper identity
  specified in the repository-root DESIGN.md (version public-record-1).
---

# Quill Portal design: see the root DESIGN.md

This file used to hold a dark, Inter-based shadcn spec for the portal. That
spec no longer ships, and agents that read it first were steered toward the
wrong theme, fonts and colours.

The portal's design is specified in [`/DESIGN.md`](../../DESIGN.md)
("public-record-1"): paper `#f4f2ec`, ink `#161614`, editorial red `#a63029`,
Newsreader, Source Sans 3 and IBM Plex Mono (self-hosted), light only by
design.

Implementation authority, in order:

1. `packages/portal/src/styles/tokens/quill.tokens.json` (DTCG) and
   `packages/portal/src/styles/themes/ink-and-paper.css` (+ `.oklch.css`).
2. The design-contract and token tests next to them
   (`ink-and-paper.test.ts`, the WCAG/APCA/P3 token tests).
3. The root `DESIGN.md` prose.

The previous text is in git history (`git log -- packages/portal/DESIGN.md`).
