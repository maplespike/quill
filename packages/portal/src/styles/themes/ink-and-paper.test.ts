/**
 * Regression test for the ink-and-paper product-surface default theme
 * (GH#918). Parses the theme stylesheet and asserts:
 *
 *   1. The 12 colour roles resolve under `.theme-ink-and-paper` at the
 *      exact spec hexes.
 *   2. The six semantic role vars (--background/--foreground/--card/
 *      --primary/--border/--ring) resolve under the class.
 *   3. Every declared text pair holds >= 4.5:1 (WCAG AA) and every focus
 *      pair >= 3:1 (WCAG 2.2 focus appearance) through a real WCAG
 *      contrast function.
 *
 * Incident rule: no theme change ships without this test. It MUST fail if
 * a token drops below the floor.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const cssPath = fileURLToPath(new URL("./ink-and-paper.css", import.meta.url));
const css = readFileSync(cssPath, "utf8");

// ── helpers ─────────────────────────────────────────────────────────────

/** Extract a custom-property value from the `.theme-ink-and-paper` block. */
function token(name: string): string | undefined {
  const m = css.match(new RegExp(`--${name}:\\s*([^;}]+)`, "m"));
  return m?.[1]?.trim();
}

/** hsl triplet "H S% L%" -> [h, s, l] numbers (hue 0-360, s/l 0-100). */
function parseTriplet(v: string): [number, number, number] {
  const m = v.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) throw new Error(`not an hsl triplet: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** hsl -> srgb 0..1 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const S = s / 100;
  const L = l / 100;
  const C = (1 - Math.abs(2 * L - 1)) * S;
  const Hp = h / 60;
  const X = C * (1 - Math.abs((Hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (Hp < 1) [r, g, b] = [C, X, 0];
  else if (Hp < 2) [r, g, b] = [X, C, 0];
  else if (Hp < 3) [r, g, b] = [0, C, X];
  else if (Hp < 4) [r, g, b] = [0, X, C];
  else if (Hp < 5) [r, g, b] = [X, 0, C];
  else [r, g, b] = [C, 0, X];
  const m = L - C / 2;
  return [r + m, g + m, b + m];
}

function hx2rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/** WCAG 2.x relative luminance + contrast ratio. */
function contrastRatio(
  fg: [number, number, number],
  bg: [number, number, number],
): number {
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lum = (rgb: [number, number, number]) =>
    0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const L1 = lum(fg);
  const L2 = lum(bg);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite an alpha colour over a background and return srgb 0..1. */
function composite(
  fg: [number, number, number],
  bg: [number, number, number],
  alpha: number,
): [number, number, number] {
  return [
    alpha * fg[0] + (1 - alpha) * bg[0],
    alpha * fg[1] + (1 - alpha) * bg[1],
    alpha * fg[2] + (1 - alpha) * bg[2],
  ];
}

function tripletToRgb(v: string): [number, number, number] {
  return hslToRgb(...parseTriplet(v));
}

// ── 1. colour roles at the spec hexes ───────────────────────────────────

const ROLE_HEXES: Record<string, string> = {
  "iap-paper": "#f4f2ec",
  "iap-paper-deep": "#e7e3d8",
  "iap-surface": "#fbfaf6",
  "iap-ink": "#161614",
  "iap-ink-soft": "#2c2c28",
  "iap-muted": "#534f46",
  "iap-line": "#ddd8cc",
  "iap-line-strong": "#cfc8b8",
  "iap-chip": "#ece8de",
  "iap-on-ink": "#f6f4ef",
  "iap-on-ink-muted": "#b9b5aa",
  "iap-on-ink-line": "#3a3a34",
};

describe("ink-and-paper roles", () => {
  test("theme file declares the scoped class", () => {
    expect(css).toMatch(/\.theme-ink-and-paper\b/);
  });

  test.each(Object.entries(ROLE_HEXES))<string, string>(
    "%s resolves to its spec hex",
    (name: string, hex: string) => {
    const v = token(name);
    expect(v, `--${name} missing from ink-and-paper.css`).toBeDefined();
    // The roles are declared as hsl triplets (consumed as hsl(var(--x)) by
    // the Tailwind @theme bridge). Verify the triplet round-trips to the
    // exact spec hex.
    const [r, g, b] = tripletToRgb(v!);
    const got = [r, g, b].map((c) =>
      Math.round(c * 255).toString(16).padStart(2, "0"),
    );
    expect(`#${got.join("")}`).toBe(hex.toLowerCase());
    },
  );

  test("radii, shadow and motion tokens are present", () => {
    expect(token("iap-radius-control")).toBe("0.5rem");
    expect(token("iap-radius-panel")).toBe("2rem");
    expect(token("iap-radius-console")).toBe("1.75rem");
    expect(token("iap-shadow-panel")).toBe(
      "0 24px 60px -36px rgb(22 22 20 / 0.4)",
    );
    expect(token("iap-ease")).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
    expect(token("iap-duration")).toBe("150ms");
    expect(token("iap-text-hero")).toMatch(/^clamp\(/);
    expect(token("iap-text-section")).toMatch(/^clamp\(/);
  });

  test("focus ring alpha is /60, not the failing /40", () => {
    const ring = token("iap-focus-ring");
    expect(ring).toBeDefined();
    expect(ring).not.toMatch(/0\.4\b/);
    expect(ring).toMatch(/0\.6\b/);
  });
});

// ── 2. semantic role vars resolve under the theme ────────────────────────

const SEMANTIC = ["background", "foreground", "card", "primary", "border", "ring"];

describe("semantic role vars under .theme-ink-and-paper", () => {
  test.each(SEMANTIC)<string>("--%s resolves to an hsl triplet", (name: string) => {
    const v = token(name);
    expect(v, `--${name} missing`).toBeDefined();
    expect(() => parseTriplet(v!)).not.toThrow();
  });

  test("background/foreground/card/border/primary map to the ink palette", () => {
    const bg = tripletToRgb(token("background")!);
    const fg = tripletToRgb(token("foreground")!);
    const card = tripletToRgb(token("card")!);
    const primary = tripletToRgb(token("primary")!);
    const border = tripletToRgb(token("border")!);
    // background -> paper, card -> surface, fg/primary -> ink, border -> line
    expect(rgbHex(bg)).toBe("#f4f2ec");
    expect(rgbHex(card)).toBe("#fbfaf6");
    expect(rgbHex(fg)).toBe("#161614");
    expect(rgbHex(primary)).toBe("#161614");
    expect(rgbHex(border)).toBe("#ddd8cc");
  });

  test("focus ring is ink and composites to >= 3:1 on paper", () => {
    const ring = token("iap-focus-ring")!;
    // format: hsl(60 4.8% 8.2% / 0.6)
    const m = ring.match(/^hsl\(([\d.]+\s+[\d.]+%\s+[\d.]+%)\s*\/\s*([\d.]+)\)$/);
    expect(m, `--iap-focus-ring malformed: ${ring}`).not.toBeNull();
    const ringRgb = tripletToRgb(m![1]);
    const alpha = Number(m![2]);
    expect(alpha).toBeGreaterThanOrEqual(0.5); // /40 fails WCAG focus (2.52:1)
    const paper = hx2rgb("#f4f2ec");
    const ratio = contrastRatio(composite(ringRgb, paper, alpha), paper);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});

function rgbHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((c) => Math.round(c * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

// ── 3. contrast floor across every declared pair ─────────────────────────

describe("WCAG contrast floor", () => {
  const ink = hx2rgb("#161614");
  const paper = hx2rgb("#f4f2ec");
  const surface = hx2rgb("#fbfaf6");
  const chip = hx2rgb("#ece8de");

  const textPairs: Array<[string, [number, number, number], [number, number, number]]> = [
    ["ink on paper", ink, paper],
    ["ink on surface", ink, surface],
    ["ink on chip", ink, chip],
    ["muted on paper", hx2rgb("#534f46"), paper],
    ["muted on surface", hx2rgb("#534f46"), surface],
    ["on-ink on ink", hx2rgb("#f6f4ef"), ink],
    ["on-ink-muted on ink", hx2rgb("#b9b5aa"), ink],
  ];

  test.each(textPairs)<
    string,
    [number, number, number],
    [number, number, number]
  >("%s >= 4.5:1", (_label: string, fg: [number, number, number], bg: [number, number, number]) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  test("focus ring ink/60 on paper >= 3:1", () => {
    const ratio = contrastRatio(composite(ink, paper, 0.6), paper);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  test("the failing pair from the reference is excluded", () => {
    // ink/40 on paper measured 2.52:1 — the theme must not use it.
    expect(contrastRatio(composite(ink, paper, 0.4), paper)).toBeLessThan(3);
  });

  test("maple red is not body text on paper", () => {
    expect(contrastRatio(hx2rgb("#e84545"), paper)).toBeLessThan(4.5);
    // and the theme file must not paint body text with the brand red
    expect(css).not.toMatch(/color:\s*var\(--maple\)/);
  });
});
