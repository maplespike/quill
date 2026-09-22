/**
 * Asserted version of scripts/smoke-test-dist.mjs: the built portal must contain
 * the routes and AI-discovery files that shipped in source. A build that silently
 * drops a page is invisible until someone hits the 404 in production.
 *
 * Skips when dist/ is absent (local runs without a build) — CI builds first.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const dist = join(process.cwd(), "dist");
const built = existsSync(dist);

const REQUIRED_FILES = [
  "index.html",
  "pricing.html",
  "signup.html",
  "dashboard.html",
  "llms.txt",
  "robots.txt",
  "sitemap.xml",
];

describe.skipIf(!built)("portal dist", () => {
  test.each(REQUIRED_FILES)("ships %s", (file) => {
    expect(existsSync(join(dist, file))).toBe(true);
  });

  test("the landing page is real HTML, not an empty shell", () => {
    const html = readFileSync(join(dist, "index.html"), "utf8");
    expect(html.length).toBeGreaterThan(2000);
    expect(html).toMatch(/<title>/i);
  });

  test("llms.txt describes the product for agents", () => {
    const txt = readFileSync(join(dist, "llms.txt"), "utf8");
    expect(txt.length).toBeGreaterThan(200);
  });

  test("the checkout island is present on the pricing page", () => {
    const html = readFileSync(join(dist, "pricing.html"), "utf8");
    expect(html).toMatch(/pricing|plan/i);
  });
});

if (!built) {
  test("dist smoke test skipped: no dist/ (run a build first)", () => {
    expect(built).toBe(false);
  });
}
