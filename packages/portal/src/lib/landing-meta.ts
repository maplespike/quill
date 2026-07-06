/**
 * Landing-page metadata shared by the bare-root `/` (`pages/index.astro`)
 * and the locale-prefixed routes (`pages/[locale].astro` → `/en`, `/fr`).
 *
 * Single source of truth so the title + description cannot drift between
 * the three URLs that mount the same brand-shell.
 *
 * 2026-07-06: extracted to fix a reviewer-flagged duplication.
 */
export const LANDING_TITLE = "Quill · Canada's open data, on tap for any AI";

export const LANDING_DESCRIPTION =
  "Quill — MapleSpike's MCP server + REST API for Canada's public record. 165 live tools, every record cited and verifiable. Open source under MIT. Free while in beta.";
