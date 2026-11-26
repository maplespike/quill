/**
 * Billing copy (audit item 6): portal pages and llms.txt must state what the
 * backend sells — Pro $50 CAD/mo for 50,000 credits, Business $200 CAD/mo for
 * 250,000 — with no free trial and no unrouted checkout endpoint.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const portal = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(portal, p), "utf8");
const plans = JSON.parse(read("src/data/plans.json")).plans as Array<{ plan_id: string; price_cents: number; credits_per_month: number }>;
const plan = (id: string) => plans.find((p) => p.plan_id === id)!;

describe("billing copy drift", () => {
  test("plans.json carries the backend catalog", () => {
    expect([plan("pro").price_cents, plan("pro").credits_per_month]).toEqual([5000, 50000]);
    expect([plan("business").price_cents, plan("business").credits_per_month]).toEqual([20000, 250000]);
  });

  test("dashboard/billing.astro derives plan copy from plans.json (no 100k / unlimited)", () => {
    const src = read("src/pages/dashboard/billing.astro");
    expect(src).toContain('from "@/data/plans.json"');
    expect(src).not.toMatch(/100[,  ]000|unlimited|illimit/i);
    expect(src).toContain('planLine("pro")');
    expect(src).toContain('planLine("business")');
  });

  test("pricing.astro makes no free-trial claim and Free isn't sold as the full catalog", () => {
    const src = read("src/pages/pricing.astro");
    expect(src).not.toMatch(/14-day|14 jours|free trial with/i);
    const freeCard = src.slice(src.indexOf('name: { en: "Free"'), src.indexOf('name: { en: "Pro"'));
    expect(freeCard).not.toContain("modulesToolsBi()");
    expect(freeCard).toContain("Public data modules");
  });

  for (const file of ["public/llms.txt", "public/llms-full.txt"]) {
    test(`${file}: real checkout route and backend plan figures`, () => {
      const txt = read(file);
      expect(txt).toContain("POST /v1/billing/stripe/checkout");
      expect(txt).not.toMatch(/\/v1\/billing\/checkout\b/);
      expect(txt).toContain("- Pro — $50 CAD/month — 50,000 API credits/month");
      expect(txt).toContain("- Business — $200 CAD/month — 250,000 API credits/month");
      expect(txt).toContain("There is no free trial on paid plans.");
    });
  }

  test("docs page lists the real checkout route", () => {
    const src = read("src/pages/docs.astro");
    expect(src).toContain('path: "/v1/billing/stripe/checkout"');
    expect(src).not.toContain('path: "/v1/billing/checkout"');
  });
});
