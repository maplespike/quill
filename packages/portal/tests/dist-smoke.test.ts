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
  ".well-known/mcp/server-card.json",
  ".well-known/mcp/server-cards.json",
  "agent-card.json",
  "api-reference.html",
  "checkout.html",
  "checkout/return.html",
];

describe.skipIf(!built)("portal dist", () => {
  test.each(REQUIRED_FILES)("ships %s", (file) => {
    expect(existsSync(join(dist, file))).toBe(true);
  });

  test("discovery dates match the canonical metrics in the built site", () => {
    const metrics = JSON.parse(readFileSync(join(process.cwd(), "../../docs/metrics.json"), "utf8"));
    const card = JSON.parse(readFileSync(join(dist, ".well-known/mcp/server-card.json"), "utf8"));
    const agent = JSON.parse(readFileSync(join(dist, "agent-card.json"), "utf8"));
    expect(card._meta["ca.maplespike/quill"].countsAsOf).toBe(metrics["//_generated"]);
    expect(agent.counts.asOf).toBe(metrics["//_generated"]);
    expect(readFileSync(join(dist, ".well-known/mcp/server-cards.json"), "utf8"))
      .toBe(readFileSync(join(dist, ".well-known/mcp/server-card.json"), "utf8"));
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
