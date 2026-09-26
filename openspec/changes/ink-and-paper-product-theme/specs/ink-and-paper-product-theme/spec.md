## ADDED Requirements

### Requirement: Scoped ink-and-paper theme tokens

The portal SHALL ship the ink-and-paper design system as one scoped theme class carrying all colour roles, radii, shadow, motion, type tokens and self-hosted fonts, such that adding the class to any page restyles it without touching page markup.

#### Scenario: Theme class carries the full token set

- **WHEN** the class `.theme-ink-and-paper` is present on the document root
- **THEN** the 12 colour roles SHALL resolve to the spec hexes (paper `#f4f2ec`, paper-deep `#e7e3d8`, surface `#fbfaf6`, ink `#161614`, ink-soft `#2c2c28`, muted `#534f46`, line `#ddd8cc`, line-strong `#cfc8b8`, chip `#ece8de`, on-ink `#f6f4ef`, on-ink-muted `#b9b5aa`, on-ink-line `#3a3a34`)
- **AND** the control radius SHALL be 0.5rem, the panel radius 2rem, the console radius 1.75rem
- **AND** the panel shadow SHALL be `0 24px 60px -36px rgb(22 22 20 / 0.4)`
- **AND** the motion ease SHALL be `cubic-bezier(0.22, 1, 0.36, 1)` with a 150ms default duration, animating opacity and colour only
- **AND** `--iap-text-hero` and `--iap-text-section` SHALL be fluid clamp() scales

#### Scenario: Fonts are self-hosted

- **WHEN** a product page renders under the theme
- **THEN** Newsreader, Source Sans 3 and IBM Plex Mono SHALL load from `/fonts/*.woff2` served by the portal itself
- **AND** the document SHALL NOT request fonts from `fonts.googleapis.com` or `fonts.gstatic.com`

### Requirement: Semantic role variables resolve under the theme

The theme class SHALL map the ink values onto the existing semantic role variables (`--background`, `--foreground`, `--card`, `--primary`, `--border`, `--ring`, and the secondary/accent/muted/sidebar family) so components restyle from one place, and a regression test SHALL fail if any of these variables stops resolving or a token pair drops below the WCAG contrast floor.

#### Scenario: Role vars resolve and hold the contrast floor

- **WHEN** the theme class is applied and the test parses the theme stylesheet
- **THEN** `--background` SHALL resolve to paper, `--foreground` and `--primary` SHALL resolve to ink, `--card` SHALL resolve to surface, `--border` to line, `--ring` to ink at /60 alpha
- **AND** every normal-text token pair SHALL measure at least 4.5:1
- **AND** every focus-indicator pair SHALL measure at least 3:1
- **AND** the regression test SHALL fail if a token drops below the floor

#### Scenario: Focus ring meets WCAG 2.2 focus appearance

- **WHEN** a control receives keyboard focus on a product surface
- **THEN** the focus ring colour SHALL be ink at /60 alpha on paper (4.56:1), not ink at /40 (2.52:1)
- **AND** the brand maple red SHALL NOT be used for body text or focus on paper

### Requirement: Product surfaces default to the theme

BaseLayout SHALL apply the theme class at build time to the 14 product surfaces (`/docs /explorer /agents /ask /api-explorer /citation /verify /status /watcher /signal /dashboard /workspace /signup /checkout`, with `/fr` mirrors), and SHALL NOT change the brand family (`/ /pricing /blog /contact /privacy /terms /changelog`).

#### Scenario: A product route renders ink by default

- **WHEN** a visitor requests any of the 14 product routes (or its `/fr` mirror)
- **THEN** the rendered HTML root element SHALL carry the theme class
- **AND** the dark-mode class SHALL NOT be applied on product surfaces
- **AND** the Google Fonts stylesheet links SHALL NOT appear in the document head
- **AND** the theme-color meta SHALL be paper `#f4f2ec`

#### Scenario: Brand routes are unchanged

- **WHEN** a visitor requests `/`, `/pricing`, `/blog`, `/contact`, `/privacy`, `/terms` or `/changelog`
- **THEN** the document SHALL NOT carry the theme class and the existing maple-red brand theme SHALL apply

### Requirement: Design demo shows the sixth skin

`design-demo.astro` SHALL include ink-and-paper as a sixth skin rendered over the same component skeleton as the existing five candidates, without the reference's tools-grid empty-cell bug.

#### Scenario: Judged like-for-like

- **WHEN** the design demo page renders
- **THEN** an ink-and-paper section SHALL appear using the same hero, stats, cards, buttons, code block and badges skeleton
- **AND** its card grid SHALL NOT render an empty trailing cell for an odd item count
