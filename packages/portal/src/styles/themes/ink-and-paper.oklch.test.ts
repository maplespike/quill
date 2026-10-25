/**
 * Regression test for the OKLCH colour layer (ink-and-paper.oklch.css).
 *
 *   1. Every --q-* OKLCH twin round-trips to the exact spec hex in sRGB, so
 *      adopting OKLCH changes no pixel on sRGB screens.
 *   2. The hex fallback block declares the same hexes.
 *   3. The P3 editorial red keeps lightness and hue, adds chroma, and stays
 *      inside the Display-P3 gamut.
 *   4. APCA (WCAG 3 draft, 0.0.98G-4g) floors hold for the core text pairs,
 *      alongside the WCAG 2.2 floors in ink-and-paper.test.ts.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("./ink-and-paper.oklch.css", import.meta.url)),
  "utf8",
);

type Vec3 = [number, number, number];

const SPEC: Record<string, string> = {
  "q-paper": "#f4f2ec",
  "q-paper-deep": "#e7e3d8",
  "q-surface": "#fbfaf6",
  "q-ink": "#161614",
  "q-ink-soft": "#2c2c28",
  "q-muted": "#534f46",
  "q-line": "#ddd8cc",
  "q-line-strong": "#cfc8b8",
  "q-chip": "#ece8de",
  "q-on-ink": "#f6f4ef",
  "q-on-ink-muted": "#b9b5aa",
  "q-on-ink-line": "#3a3a34",
  "q-console": "#1d1d1a",
  "q-red": "#a63029",
};

// ── colour maths ────────────────────────────────────────────────────────
function parseOklch(v: string): Vec3 {
  const m = v.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!m) throw new Error(`not an oklch() value: ${v}`);
  return [Number(m[1]) / 100, Number(m[2]), Number(m[3])];
}
function oklchToLinearSrgb([L, C, H]: Vec3): Vec3 {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const gamma = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
function toHex(lin: Vec3): string {
  return `#${lin
    .map((c) => Math.round(gamma(Math.min(1, Math.max(0, c))) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}
function linearSrgbToLinearP3([r, g, b]: Vec3): Vec3 {
  const x = 0.4123907993 * r + 0.3575843394 * g + 0.1804807884 * b;
  const y = 0.2126390059 * r + 0.7151686788 * g + 0.0721923154 * b;
  const z = 0.0193308187 * r + 0.1191947798 * g + 0.9505321522 * b;
  return [
    2.4934969119 * x - 0.9313836179 * y - 0.4027107845 * z,
    -0.8294889696 * x + 1.7626640603 * y + 0.0236246858 * z,
    0.0358458302 * x - 0.0761723893 * y + 0.956884524 * z,
  ];
}
function hexToRgb(hex: string): Vec3 {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Vec3;
}
/** APCA 0.0.98G-4g lightness contrast (Lc). Positive = dark text on light. */
function apca(text: string, bg: string): number {
  const Y = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
  };
  const clamp = (y: number) => (y > 0.022 ? y : y + (0.022 - y) ** 1.414);
  const t = clamp(Y(text));
  const b = clamp(Y(bg));
  if (b > t) {
    const s = (b ** 0.56 - t ** 0.57) * 1.14;
    return s < 0.1 ? 0 : (s - 0.027) * 100;
  }
  const s = (b ** 0.65 - t ** 0.62) * 1.14;
  return s > -0.1 ? 0 : (s + 0.027) * 100;
}

/** All declarations of --name, in source order. */
function decls(name: string): string[] {
  return [...css.matchAll(new RegExp(`--${name}:\\s*([^;]+);`, "g"))].map((m) => m[1].trim());
}

// ── 1 + 2. round-trip and fallback ──────────────────────────────────────
describe("OKLCH twins are sRGB-exact", () => {
  test.each(Object.entries(SPEC))("%s → %s", (name: string, hex: string) => {
    const values = decls(name);
    const fallback = values.find((v) => v.startsWith("#"));
    expect(fallback, `--${name} needs a hex fallback`).toBe(hex);
    const ok = values.find((v) => v.startsWith("oklch("));
    expect(ok, `--${name} needs an oklch() value`).toBeDefined();
    expect(toHex(oklchToLinearSrgb(parseOklch(ok!)))).toBe(hex);
  });
});

// ── 3. wide gamut ───────────────────────────────────────────────────────
describe("P3 editorial red", () => {
  const all = decls("q-red").filter((v) => v.startsWith("oklch("));
  const base = parseOklch(all[0]);
  const p3 = parseOklch(all[all.length - 1]);

  test("is declared under @media (color-gamut: p3)", () => {
    expect(css).toMatch(/@media \(color-gamut: p3\)/);
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
  test("keeps lightness and hue, adds chroma", () => {
    expect(p3[0]).toBeCloseTo(base[0], 4);
    expect(p3[2]).toBeCloseTo(base[2], 2);
    expect(p3[1]).toBeGreaterThan(base[1]);
  });
  test("is inside the Display-P3 gamut", () => {
    for (const c of linearSrgbToLinearP3(oklchToLinearSrgb(p3))) {
      expect(c).toBeGreaterThanOrEqual(-1e-4);
      expect(c).toBeLessThanOrEqual(1 + 1e-4);
    }
  });
});

// ── 4. APCA floors (WCAG 3 draft) ───────────────────────────────────────
describe("APCA floors", () => {
  const pairs: Array<[string, string, string, number]> = [
    // label, text, background, minimum |Lc|
    ["ink on paper (body)", "#161614", "#f4f2ec", 90],
    ["muted on paper (secondary body)", "#534f46", "#f4f2ec", 75],
    ["muted on paper-deep", "#534f46", "#e7e3d8", 70],
    ["editorial red on paper (markers, display)", "#a63029", "#f4f2ec", 60],
    ["on-ink on ink (console)", "#f6f4ef", "#161614", 90],
    ["on-ink-muted on console", "#b9b5aa", "#1d1d1a", 60],
  ];
  test.each(pairs)("%s ≥ Lc %d", (_l: string, fg: string, bg: string, min: number) => {
    expect(Math.abs(apca(fg, bg))).toBeGreaterThanOrEqual(min);
  });
});

// ── media-query layers exist ────────────────────────────────────────────
test("declares prefers-contrast and forced-colors layers", () => {
  expect(css).toMatch(/@media \(prefers-contrast: more\)/);
  expect(css).toMatch(/@media \(forced-colors: active\)/);
});
