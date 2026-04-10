/**
 * CivicIntel dark theme configuration.
 *
 * Five named variants:
 * - nightwatch: brass/gold on deep navy
 * - phosphor: CRT green on black
 * - arctic: cool blue on slate
 * - parchment: light cream (accessibility variant)
 * - solarized: warm amber/brown
 */

export interface CivicThemeColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderFocus: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  cyan: string;
  gold: string;
  red: string;
  amber: string;
  green: string;
  purple: string;
  blue: string;
  glow: string;
  glowStrong: string;
}

export interface CivicTheme {
  name: string;
  colors: CivicThemeColors;
  fonts: {
    serif: string;
    sans: string;
    mono: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  borderRadius: number;
  chartColors: string[];
}

const nightwatch: CivicTheme = {
  name: "nightwatch",
  colors: {
    background: "#0a0e1a",
    backgroundSecondary: "#111827",
    backgroundTertiary: "#1a2332",
    surface: "#1e293b",
    surfaceHover: "#263348",
    border: "#334155",
    borderFocus: "#d4a853",
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    cyan: "#22d3ee",
    gold: "#d4a853",
    red: "#ef4444",
    amber: "#f59e0b",
    green: "#22c55e",
    purple: "#a78bfa",
    blue: "#3b82f6",
    glow: "rgba(34, 211, 238, 0.15)",
    glowStrong: "rgba(34, 211, 238, 0.3)",
  },
  fonts: {
    serif: "'Georgia', 'Times New Roman', serif",
    sans: "'Inter', 'Segoe UI', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 6,
  chartColors: [
    "#22d3ee", // cyan
    "#d4a853", // gold
    "#ef4444", // red
    "#f59e0b", // amber
    "#22c55e", // green
    "#a78bfa", // purple
    "#3b82f6", // blue
    "#ec4899", // pink
    "#14b8a6", // teal
    "#f97316", // orange
  ],
};

const phosphor: CivicTheme = {
  name: "phosphor",
  colors: {
    background: "#000000",
    backgroundSecondary: "#0a0a0a",
    backgroundTertiary: "#141414",
    surface: "#1a1a1a",
    surfaceHover: "#222222",
    border: "#333333",
    borderFocus: "#33ff33",
    text: "#33ff33",
    textSecondary: "#22cc22",
    textMuted: "#1a8c1a",
    cyan: "#33ff99",
    gold: "#99ff33",
    red: "#ff3333",
    amber: "#ccff33",
    green: "#33ff33",
    purple: "#99cc33",
    blue: "#33cc99",
    glow: "rgba(51, 255, 51, 0.1)",
    glowStrong: "rgba(51, 255, 51, 0.25)",
  },
  fonts: {
    serif: "'Courier New', monospace",
    sans: "'Courier New', monospace",
    mono: "'Courier New', monospace",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 2,
  chartColors: [
    "#33ff33",
    "#33ff99",
    "#99ff33",
    "#ccff33",
    "#33cc99",
    "#22cc22",
    "#66ff66",
    "#33ccff",
    "#99cc33",
    "#33ffcc",
  ],
};

const arctic: CivicTheme = {
  name: "arctic",
  colors: {
    background: "#0f172a",
    backgroundSecondary: "#1e293b",
    backgroundTertiary: "#273548",
    surface: "#334155",
    surfaceHover: "#3d4f65",
    border: "#475569",
    borderFocus: "#38bdf8",
    text: "#e2e8f0",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    cyan: "#38bdf8",
    gold: "#fbbf24",
    red: "#f87171",
    amber: "#fbbf24",
    green: "#4ade80",
    purple: "#c084fc",
    blue: "#60a5fa",
    glow: "rgba(56, 189, 248, 0.12)",
    glowStrong: "rgba(56, 189, 248, 0.25)",
  },
  fonts: {
    serif: "'Georgia', serif",
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 8,
  chartColors: [
    "#38bdf8",
    "#fbbf24",
    "#f87171",
    "#4ade80",
    "#c084fc",
    "#60a5fa",
    "#fb923c",
    "#2dd4bf",
    "#e879f9",
    "#a3e635",
  ],
};

const parchment: CivicTheme = {
  name: "parchment",
  colors: {
    background: "#faf8f0",
    backgroundSecondary: "#f5f0e1",
    backgroundTertiary: "#ebe5d3",
    surface: "#ffffff",
    surfaceHover: "#f8f6ee",
    border: "#d4c9a8",
    borderFocus: "#8b6914",
    text: "#2c2416",
    textSecondary: "#5c4f3a",
    textMuted: "#8b7d65",
    cyan: "#0891b2",
    gold: "#92400e",
    red: "#b91c1c",
    amber: "#b45309",
    green: "#15803d",
    purple: "#7c3aed",
    blue: "#1d4ed8",
    glow: "rgba(139, 105, 20, 0.08)",
    glowStrong: "rgba(139, 105, 20, 0.18)",
  },
  fonts: {
    serif: "'Georgia', 'Times New Roman', serif",
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 4,
  chartColors: [
    "#0891b2",
    "#92400e",
    "#b91c1c",
    "#b45309",
    "#15803d",
    "#7c3aed",
    "#1d4ed8",
    "#be185d",
    "#0d9488",
    "#c2410c",
  ],
};

const solarized: CivicTheme = {
  name: "solarized",
  colors: {
    background: "#002b36",
    backgroundSecondary: "#073642",
    backgroundTertiary: "#0a4050",
    surface: "#073642",
    surfaceHover: "#0d4f5f",
    border: "#586e75",
    borderFocus: "#b58900",
    text: "#fdf6e3",
    textSecondary: "#eee8d5",
    textMuted: "#839496",
    cyan: "#2aa198",
    gold: "#b58900",
    red: "#dc322f",
    amber: "#cb4b16",
    green: "#859900",
    purple: "#6c71c4",
    blue: "#268bd2",
    glow: "rgba(181, 137, 0, 0.1)",
    glowStrong: "rgba(181, 137, 0, 0.22)",
  },
  fonts: {
    serif: "'Georgia', serif",
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 4,
  chartColors: [
    "#2aa198",
    "#b58900",
    "#dc322f",
    "#cb4b16",
    "#859900",
    "#6c71c4",
    "#268bd2",
    "#d33682",
    "#2aa198",
    "#93a1a1",
  ],
};

export const themes: Record<string, CivicTheme> = {
  nightwatch,
  phosphor,
  arctic,
  parchment,
  solarized,
};

export const defaultTheme = nightwatch;

/** Get a theme by name, falling back to the default nightwatch theme. */
export function getTheme(name?: string): CivicTheme {
  if (name && themes[name]) return themes[name];
  return defaultTheme;
}

/** Convert theme to CSS custom properties string for use in style attributes. */
export function themeToCSSVars(theme: CivicTheme): Record<string, string> {
  const c = theme.colors;
  const map: Record<string, string> = {
    "--civic-bg": c.background,
    "--civic-bg-secondary": c.backgroundSecondary,
    "--civic-bg-tertiary": c.backgroundTertiary,
    "--civic-surface": c.surface,
    "--civic-surface-hover": c.surfaceHover,
    "--civic-border": c.border,
    "--civic-border-focus": c.borderFocus,
    "--civic-text": c.text,
    "--civic-text-secondary": c.textSecondary,
    "--civic-text-muted": c.textMuted,
    "--civic-cyan": c.cyan,
    "--civic-gold": c.gold,
    "--civic-red": c.red,
    "--civic-amber": c.amber,
    "--civic-green": c.green,
    "--civic-purple": c.purple,
    "--civic-blue": c.blue,
    "--civic-glow": c.glow,
    "--civic-glow-strong": c.glowStrong,
    "--civic-font-serif": theme.fonts.serif,
    "--civic-font-sans": theme.fonts.sans,
    "--civic-font-mono": theme.fonts.mono,
    "--civic-radius": `${theme.borderRadius}px`,
  };
  return map;
}

export type { CivicTheme as Theme };
