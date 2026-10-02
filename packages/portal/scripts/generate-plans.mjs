#!/usr/bin/env node
/**
 * Generate src/data/plans.json + src/data/stats.json — the single source of
 * truth for pricing/limits and the portal's headline stats.
 *
 * Sources, in order of authority:
 *   plans    — GET https://api.maplespike.ca/v1/billing/plans (public)
 *   tools    — the built quill-mcp getAllTools() registry (runtime authority)
 *   modules  — pipeline-core's ingestion registry (built getAllModules();
 *              else regex count of src/ingestion/registry.ts; else existing)
 *   static   — jurisdictions / lines-of-TS (manual; review at commit time)
 *
 * Pricing may be refreshed from the public API, or held at committed values
 * with QUILL_GENERATOR_OFFLINE=1. Tool membership always comes from the built
 * quill-mcp registry; a missing or invalid build fails instead of creating a
 * plausible but stale union from sidecar indexes.
 *
 * Pages consuming these files (keep in lockstep):
 *   src/pages/pricing.astro, src/pages/signup.astro,
 *   src/components/LandingBody.astro, src/layouts/BaseLayout.astro,
 *   src/pages/index.astro, src/pages/[locale].astro
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildTimestamp } from "./lib/build-timestamp.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORTAL_DIR = resolve(__dirname, "..");
const DATA_DIR = resolve(PORTAL_DIR, "src/data");
const REGISTRY = resolve(__dirname, "../../pipeline-core/src/ingestion/registry.ts");
const API_PLANS = process.env.QUILL_PLANS_URL ?? "https://api.maplespike.ca/v1/billing/plans";
const MCP_HEALTH = process.env.QUILL_MCP_HEALTH_URL ?? "https://mcp.maplespike.ca/health";

// Resolved once per run and shared by every artifact written below
// (tools.json, plans.json, stats.json), so a single run cannot leave two
// files stamped a few milliseconds apart.
const generatedAt = buildTimestamp();

// ── Tools catalog sources (see generateTools below) ────────────────
const TOOLS_BASE = resolve(DATA_DIR, "tools-base.json"); // curated categories for known tools
const FR_TOOLS = resolve(__dirname, "../../quill-mcp/i18n/fr-tools.json");
// Category fallback for tools that exist in quill-mcp but not in the curated base.
const CAT_BY_NAME = {
  parliament_debates: "Parliament",
  search_nutrient_file: "Health",
  search_valet_api: "Economic",
  search_weather: "Environment",
  get_donations_by_jurisdiction: "Elections",
  get_voting_record: "Parliament",
  get_public_accounts: "Economic",
  list_gtfs_agencies: "Transport",
  get_fire_by_city: "Public Safety",
  get_police_by_city: "Public Safety",
  search_oecd: "International",
  search_undp_hdr: "International",
};

const read = (p, fallback = null) => {
  try {
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback;
  } catch {
    return fallback;
  }
};

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function countModules(previous) {
  // 1) Built pipeline-core registry (authoritative getAllModules()).
  try {
    const dist = resolve(__dirname, "../../pipeline-core/dist/index.js");
    if (existsSync(dist)) {
      const core = await import(dist);
      if (typeof core.getAllModules === "function") {
        const all = core.getAllModules();
        if (Array.isArray(all) && all.length > 0) return all.length;
      }
    }
  } catch {
    /* fall through */
  }
  // 2) Regex count of the registry source (hermetic, no build needed).
  try {
    if (existsSync(REGISTRY)) {
      const src = readFileSync(REGISTRY, "utf8");
      const n = (src.match(/^\s*\{\s*name:/gm) ?? []).length;
      if (n > 0) return n;
    }
  } catch {
    /* fall through */
  }
  // 3) Previous value.
  return previous?.modules ?? null;
}

// ── Tools catalog (docs.astro table) ──────────────────────────────
// Authoritative source: quill-mcp's built tool registry (getAllTools()), the
// exact set the MCP server registers. Categories come from the curated base
// (tools-base.json) or a name map; French descriptions come from fr-tools.json.
// If the registry is absent or fails to load, fail
// rather than publish a stale superset from sidecar indexes.
async function generateTools() {
  const base = read(TOOLS_BASE, []);
  const fr = read(FR_TOOLS, {});
  if (!Array.isArray(base)) throw new Error('tools-base.json must contain an array');
  const baseCat = new Map(base.map((t) => [t.name, t.cat]));
  const describe = (name, en, frText) => ({
    cat: CAT_BY_NAME[name] ?? baseCat.get(name) ?? "General",
    name,
    desc: { en, fr: frText ?? en },
  });

  let byName = null;
  try {
    const dist = resolve(__dirname, "../../quill-mcp/dist/tools/index.js");
    if (existsSync(dist)) {
      const m = await import(dist);
      if (typeof m.getAllTools === "function") {
        const all = m.getAllTools();
        if (Array.isArray(all) && all.length > 0) {
          const fresh = new Map();
          for (const e of all) {
            const d = e?.definition;
            if (!d?.name) continue;
            const runtimeDescription = typeof d.description === "string" ? d.description : d.name;
            const entry = describe(d.name, runtimeDescription, fr[d.name]);
            fresh.set(d.name, entry);
          }
          if (fresh.size === 0) throw new Error('quill-mcp registry returned no tool definitions');
          byName = fresh;
        } else {
          throw new Error('quill-mcp getAllTools() returned no tools');
        }
      } else {
        throw new Error('quill-mcp registry does not export getAllTools()');
      }
    } else {
      throw new Error(`built quill-mcp registry not found at ${dist}; build @maplespike/quill-mcp before regenerating portal artifacts`);
    }
  } catch (e) {
    throw new Error(`authoritative quill-mcp registry could not be loaded: ${e.message}`, { cause: e });
  }

  const tools = [...byName.values()];
  writeFileSync(
    resolve(DATA_DIR, "tools.json"),
    JSON.stringify(
      {
        _meta: {
          generatedAt,
          sources: ["quill-mcp getAllTools() (authoritative)", "tools-base.json (categories)", "quill-mcp fr-tools.json"],
        },
        tools,
      },
      null,
      2,
    ) + "\n",
  );
  return tools.length;
}

async function main() {
  const prevPlans = read(resolve(DATA_DIR, "plans.json"), { plans: [] });
  const prevStats = read(resolve(DATA_DIR, "stats.json"), null);

  // ── Plans ────────────────────────────────────────────────────────
  let plans = prevPlans.plans;
  if (process.env.QUILL_GENERATOR_OFFLINE === '1') {
    console.log('[gen:plans] offline mode — keeping committed plans');
  } else {
    try {
      const d = await fetchJson(API_PLANS);
      const list = d?.data?.plans;
      if (Array.isArray(list) && list.length > 0) {
        plans = list.map((p) => ({
          plan_id: p.plan_id,
          name: p.name,
          price_cents: p.price_cents ?? 0,
          credits_per_month: p.credits_per_month ?? null,
          rate_limit_per_min: p.rate_limit_per_min ?? null,
        }));
      }
    } catch (e) {
      console.warn(`[gen:plans] ⚠ plans fetch failed (${e.message}) — keeping checked-in plans.json`);
    }
  }

  // Membership and count come from the same built registry. Do not use a live
  // service count for one artifact and a source checkout count for another.
  const toolsCount = await generateTools();
  const modules = await countModules(prevStats);

  const plansOut = { _meta: { generatedAt, source: API_PLANS }, plans };
  const statsOut = {
    _meta: { generatedAt, sources: [MCP_HEALTH, "pipeline-core registry"] },
    tools: toolsCount,
    modules,
    // Manual (review at commit time — see DESIGN.md stats section):
    jurisdictions: prevStats?.jurisdictions ?? 13,
    linesOfTs: prevStats?.linesOfTs ?? "~220K",
  };

  writeFileSync(resolve(DATA_DIR, "plans.json"), JSON.stringify(plansOut, null, 2) + "\n");
  writeFileSync(resolve(DATA_DIR, "stats.json"), JSON.stringify(statsOut, null, 2) + "\n");

  const pro = plans.find((p) => p.plan_id === "pro");
  console.log(
    `[gen:plans] ✓ plans=${plans.length} (pro: ${pro ? `$${(pro.price_cents / 100).toFixed(0)} / ${pro.credits_per_month} cr / ${pro.rate_limit_per_min} rpm` : "n/a"}) · tools=${toolsCount} · modules=${modules} · catalog=${toolsCount}`,
  );
}

main().catch((e) => {
  console.error("[gen:plans] fatal:", e);
  process.exit(1);
});
