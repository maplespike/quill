## ADDED Requirements

### Requirement: Unified portal identity
The portal SHALL use the ink-and-paper colour roles and self-hosted fonts on all BaseLayout routes. It MUST preserve translated routes, metadata, source notices, and generated counts.

#### Scenario: Bilingual route render
- **GIVEN** an English or French portal route
- **WHEN** the static page is loaded
- **THEN** the page has the paper theme, correct language, canonical metadata, and shared Quill identity without third-party font requests.

### Requirement: Persistent task navigation
The portal SHALL provide persistent primary navigation and a labelled tool rail on product routes. The mobile menu MUST expose its state and close on Escape.

#### Scenario: Desktop scroll
- **GIVEN** a desktop product route
- **WHEN** the user scrolls the page
- **THEN** primary navigation remains visible and the current route is marked.

#### Scenario: Mobile keyboard dismissal
- **GIVEN** an open mobile menu
- **WHEN** the user presses Escape
- **THEN** the menu closes, expanded state becomes false, and focus returns to the menu button.

### Requirement: Useful bilingual landing
The landing SHALL provide real links to research tools, source categories, and integration docs. Search MUST use the existing explorer query parameter. Code examples MUST use the actual API/MCP hosts and provide translated copy/error feedback.

#### Scenario: Search handoff
- **GIVEN** a query entered on the landing page
- **WHEN** the user submits search
- **THEN** the locale-aware explorer receives the query.

#### Scenario: Copy after navigation
- **GIVEN** the user returns to the landing page through ClientRouter
- **WHEN** the user copies either example
- **THEN** the correct text reaches the clipboard, or a clear error is shown if clipboard access fails.

### Requirement: Responsive and accessible layout
The portal MUST support 390px, 768px, and 1440px viewports without document-level horizontal overflow on audited routes. Content MUST remain visible with JavaScript disabled and reduced motion enabled. Focus MUST remain visible.

#### Scenario: Narrow viewport
- **GIVEN** a 390px viewport
- **WHEN** a main research, pricing, docs, or signup page loads
- **THEN** controls and content fit the page and wide code or tables scroll within their own containers.

#### Scenario: No JavaScript
- **GIVEN** JavaScript is disabled
- **WHEN** a page loads
- **THEN** static content and navigation remain readable and available.
