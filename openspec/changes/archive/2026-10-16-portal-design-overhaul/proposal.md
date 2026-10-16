# Quill portal design overhaul — #1090

## Why
Quill has two visual identities and a flat menu that hides useful research tools. The portal needs a coherent identity and clear paths from discovery to research to integration.

## What Changes
- Apply the existing self-hosted ink-and-paper palette and fonts to every portal route.
- Replace the disappearing pill menu with persistent, task-oriented navigation and a product tool rail.
- Rebuild the bilingual landing page as an editorial introduction with source discovery, research paths, provenance, and a usable integration console.
- Refine shared controls, panels, tables, responsive spacing, and product page hierarchy.
- Use local ComfyUI artwork only as a decorative, optimised asset, never as evidence or a data visualisation.

## Capabilities
### New Capabilities
- `portal-design-system`: unified, accessible, bilingual portal presentation.
### Modified Capabilities
None. Existing API, MCP, auth, billing, and data contracts remain unchanged.

## Impact
Affected package: `packages/portal`. No service boundary or new runtime dependency. Preserve legal notices, generated counts, canonical/hreflang links, auth hooks, and checkout controls. The user subsequently authorised testing and deployment. Release is portal-only through the PR and GitOps process; API/MCP images and user data remain untouched.

## Acceptance Criteria
- Existing extensionless EN/FR routes remain available in the static build.
- Every BaseLayout route uses self-hosted fonts and the same paper theme.
- Desktop navigation remains usable after scroll; mobile menu supports Escape, accurate expanded state, and route changes.
- Product tools are reachable from a labelled, active-state navigation rail.
- Landing search navigates to the existing explorer query interface; source links use existing query search.
- MCP and REST examples use the real hosts, support copy success/failure feedback, and work after ClientRouter transitions.
- No document overflow at 390, 768, or 1440 pixels on audited routes. Code and tables can scroll inside their containers.
- Keyboard focus, skip link, reduced motion, and no-JavaScript content remain usable.
- Portal tests, Astro check, production build, and browser regression checks run; baseline failures are recorded rather than hidden.
