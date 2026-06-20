"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ReleaseStat {
  label: string;
  value: string;
  up?: boolean;
  down?: boolean;
}

interface HistogramItem {
  label: string;
  color: string;
}

interface Release {
  id: string;
  date: string;
  version: string;
  tags: { label: string; variant: string }[];
  stats: ReleaseStat[];
  items: string[];
  breaking?: string;
  modules?: string[];
  histograms?: HistogramItem[];
  topFiles?: string[];
}

const TAG_VARIANTS: Record<string, string> = {
  new: "default",
  fix: "destructive",
  api: "secondary",
  breaking: "destructive",
  docs: "secondary",
  infra: "secondary",
  module: "secondary",
};

const TAG_CLASSES: Record<string, string> = {
  new: "border-green-500/30 text-green-500 bg-green-500/10",
  fix: "border-red-500/30 text-red-400 bg-red-500/10",
  api: "border-cyan-500/30 text-cyan-400 bg-cyan-500/10",
  breaking: "border-red-500/30 text-red-500 bg-red-500/10",
  docs: "border-purple-500/30 text-purple-400 bg-purple-500/10",
  infra: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
  module: "border-blue-500/30 text-blue-400 bg-blue-500/10",
};

const FILTERS = [
  "all",
  "new",
  "api",
  "fix",
  "breaking",
  "docs",
  "infra",
  "module",
] as const;

const releases: Release[] = [
  {
    id: "pre-alpha",
    date: "2026-04-08 — 2026-04-10",
    version: "Pre-Alpha — CivInt Foundation",
    tags: [{ label: "New", variant: "new" }],
    stats: [
      { label: "Commits", value: "33" },
      { label: "Files changed", value: "143" },
      { label: "Lines", value: "+31,303 / -111", up: true },
      { label: "Packages seeded", value: "6" },
    ],
    items: [
      "Data pipeline core: Ingestion framework with parsers, entity resolution, graph construction, signal detection, and brief generation",
      "Next.js web app: Full-featured dashboard with timeline view, entity graph (D3.js), signal cards, source linking, ⌘K command palette, boot animation, ticker with signal headlines",
      "Real Canadian government data: Initial sourcing from official government APIs — committees, lobbyists, Gazette, procurement, GIC appointments",
      "K3s deployment: Containerized deployment with Podman to K3s cluster on nexus, Nginx reverse proxy, README documentation",
      "pretext-civic: React component library with chart components, geospatial map, and a 24-feature social & monitoring app specification",
      "Nix development environment: devenv configuration with flakes for reproducible builds across teams",
    ],
    histograms: [
      { label: "feat 23", color: "#10B981" },
      { label: "chore 3", color: "#8B5CF6" },
      { label: "fix 2", color: "#EF4444" },
    ],
  },
  {
    id: "v0-1-0",
    date: "2026-05-12",
    version: "v0.1.0 — CivInt Canada Data Pipeline",
    tags: [
      { label: "New", variant: "new" },
      { label: "API", variant: "api" },
      { label: "Infra", variant: "infra" },
      { label: "Docs", variant: "docs" },
    ],
    stats: [
      { label: "Commits", value: "20" },
      { label: "Files changed", value: "727" },
      { label: "Lines", value: "+126,500 / -7,486", up: true },
      { label: "Modules added", value: "11" },
      { label: "Portal pages", value: "9" },
    ],
    items: [
      "REST API (38 routes): Response envelope, bearer auth, rate limiting, usage tracking, 402 quota enforcement with Retry-After headers, token optimization (_fields, _format, _limit, _summary), mock-data module with 7 categories of test data",
      "14 MCP data tools: Bilingual EN/FR descriptions with locale-aware resolution via Accept-Language headers — query_gov_data, fact_check, get_citation, latest_releases, search_committees, search_corporate, search_influence, search_gazette, search_gic, search_elections, search_provincial_lobbying, search_oversight, search_canlii, search_lmia",
      "28 ingestion modules: Committees (HoC + Senate), lobbying registry, procurement, executive statements, influence actors, Gazette, GIC appointments, provincial lobbying (ON), third-party advertising, oversight bodies (OAG/PBO/Ethics/CRTC/CB/CIEC), CanLII court decisions, LMIA data, and 16 more modules across all sectors",
      "Portal (9 pages): Full terminal/cyber aesthetic redesign — hero code demo, source grid, data explorer, pricing, docs, SDK tabstrip (curl/TypeScript/Python), dark/light theme toggle with localStorage persistence",
      "TypeScript + Python SDKs: Zero-dependency typed client libraries — @maplespike/sdk with domain methods, @maplespike/sdk-python for PyPI distribution",
      "Infrastructure: K3s deployment manifests, Docker images (api, mcp, portal, ingest, engine), Nix flake build, CronJob ingestion scheduler, container build scripts for Podman",
      "Internationalization: en-CA/fr-CA translation files with 178 strings each, bilingual documentation (README.fr, ROADMAP.fr, portal README.fr)",
      "SEO & PWA: Open Graph tags, canonical URLs, Twitter cards, JSON-LD schema, sitemap.xml, robots.txt, manifest.json, browserconfig.xml, 404 page with navigation",
      "CSS system: Base16 token system, custom scrollbar, branded selection, reduced-motion support, glass card effects, CTA glow, gradient mesh, ARIA labels, micro-animations",
      "CI/CD: GitHub Actions with CI (build + test), deploy to K3s, GitHub Pages for portal, pnpm cache optimization",
      "Refactored 141 inline styles → 14 CSS classes across all documentation pages",
      "Removed ticker (scrolling text bar) from all pages, cleaned up dead ticker CSS",
    ],
    topFiles: [
      "portal/index.html 37 edits",
      "portal/dashboard.html 36 edits",
      "ingestion/index.ts 35 edits",
    ],
  },
  {
    id: "v0-2-0",
    date: "2026-05-13 — morning sprint",
    version: "v0.2.0 — Auth & Docs Overhaul",
    tags: [
      { label: "New", variant: "new" },
      { label: "API", variant: "api" },
      { label: "Breaking", variant: "breaking" },
      { label: "Docs", variant: "docs" },
    ],
    stats: [
      { label: "Commits", value: "~50" },
      { label: "Files changed", value: "~300" },
      { label: "Lines", value: "+~30,000 / -~5,000", up: true },
      { label: "Modules added", value: "17" },
      { label: "Portal pages", value: "10" },
    ],
    breaking:
      "Ticker (scrolling text bar) removed from all pages. Navigation and layout adjusted to compensate. Dead ticker CSS purged.",
    items: [
      "Web3 wallet authentication: SIWE/EIP-4361 implementation with /v1/auth/web3/challenge and /v1/auth/web3/login endpoints, viem integration",
      "Passkey/FIDO2 (WebAuthn): Cross-platform passkey support with residentKey=required and userVerification=required — works with Bitwarden, Android, iOS iCloud Keychain, Windows Hello. @simplewebauthn/server integration",
      "Generic OAuth 2.0 framework: Configurable via MAPLESPIKE_OAUTH_{NAME}_CLIENT_ID env vars — GitHub built-in, any OIDC provider via env overrides for authorize/token/user-info URLs and scopes",
      "JIT zero-knowledge key rotation: Auto-rotation within 7 days of expiry, response header delivery (X-Key-Rotated, X-New-Key, X-New-Key-Id, X-New-Key-Expires), storage-backed auth with SQLite fallback chain",
      "Real citation verification: SHA-256 hash lookup against pipeline data — returns verified citation with source URL, license, and shell verify command. Replaced hardcoded SAMPLE_CITATIONS",
      "Workspace page: Auth panel with OAuth login buttons, session info display, passkey/web3 placeholders, auto-login detection via session cookie, API key management wired to live endpoints (/v1/keys, /v1/usage)",
      "Docs rewrite (10 sections): Comprehensive reference — Quickstart, Auth (3 methods), Request/Response format, Endpoints catalog, Token Optimization (_fields, _summary, _mock), Citation Contract, MCP Tool Catalog, Rate Limits, Error Codes, FAQ — with proper CSS layout system",
      "OG image redesign: Terminal aesthetic SVG with curl example, live stats, source badges, MapleSpike branding",
      "Analytics-ready: DNS-prefetch, email waitlist capture, comprehensive SEO on all pages",
      "MCP ↔ API server alignment via shared api-client, pipeline-data.json as primary data source",
      "18 MCP tools documented, all returning real pipeline data",
      "Module count updated to 28 across all docs and portal",
      "AGENTS.md compact instruction file for OpenCode agent sessions",
    ],
    modules: [
      "crown-corporations",
      "federal-budget",
      "proactive-disclosure",
      "provincial-legislatures",
      "ati",
      "bank-of-canada",
      "crtc",
      "sedi",
      "cipo",
      "cmhc",
      "cra-charity",
      "global-canada",
      "health-canada",
      "impact-assessment",
      "municipal",
      "npri",
      "species-at-risk",
    ],
  },
  {
    id: "v0-2-1",
    date: "2026-05-13 — afternoon sprint",
    version: "v0.2.1 — Infrastructure & Hardening",
    tags: [
      { label: "New", variant: "new" },
      { label: "API", variant: "api" },
      { label: "Fix", variant: "fix" },
      { label: "Infra", variant: "infra" },
      { label: "Module", variant: "module" },
      { label: "Breaking", variant: "breaking" },
    ],
    stats: [
      { label: "Commits", value: "~60" },
      { label: "Files changed", value: "~400" },
      { label: "Lines", value: "+~40,000 / -~8,000", up: true },
      { label: "Modules added", value: "24" },
      { label: "New packages", value: "2" },
    ],
    breaking:
      "e2e test renamed to .skip.ts (requires live API). provincial-orgs type renamed ProvincialRecord → ProvincialOrgRecord. MCP tool index rebuilt — stale imports removed.",
    items: [
      "Dual Docker + Nix flake build system: All images building and pushing to registry with pnpm deploy + injectWorkspacePackages",
      "Distribution: Helm chart (maplespike), Homebrew formula, AUR PKGBUILD, PyPI publish workflow, Python SDK v0.2.0, Podman-compatible build script, GHCR Docker push integrated into deploy",
      "K8s rename: civint → maplespike across all deployment manifests, namespaces, and service configs",
      "Auto-merge CI/CD: main → prod auto-merge after tests pass, pnpm cache upgraded, deploy workflow consolidated",
      "Prometheus monitoring: Alerting rules (CronJob failures, stale ingestion, no pipeline data), Pushgateway heartbeat script, Grafana dashboard wiring",
      "Observability: Uptime Kuma deployed (status.maplespike.lan), Prometheus Pushgateway for CronJob heartbeat alerts",
      "Tests added: Pipeline-core test suite (46 tests — registry, constants, RSS, CKAN, citations), MCP tool tests, API server tests, SDK tests. Fixed pre-existing bugs found during testing",
      "CI harmonization: 3 workflows (ci, deploy, publish), all 5 testable packages (pipeline-core, sdk, mcp-server, engine, api-server) with type-checking before build, pnpm lock sync",
      "OpenAPI spec: 79 endpoints, 27 agents — full auto-generated specification",
      "Engine rebuild with better-sqlite3: 133/133 tests passing",
      "Python SDK PyPI package with README",
      "llms.txt + llms-full.txt updated with MapleSpike branding and current endpoints",
      "Grafana dashboard deployed, Prometheus server configured",
      "Cleanup: stale e2e tests removed, old MCP tool files purged, outdated stub comments removed",
    ],
    modules: [
      "immigration",
      "indigenous-relations",
      "criminal-justice",
      "science-research",
      "defence",
      "education-research",
      "federal-tribunals",
      "health-data",
      "social-programs",
      "agriculture",
      "culture",
      "fisheries",
      "veterans",
      "ngo-influence-rss",
      "transport-infrastructure",
      "regional-authorities",
      "provincial-orgs",
      "statcan",
      "unions",
      "media-broadcasting",
      "real-time-feeds",
      "corporate-filings",
      "municipal-long-tail",
      "provincial-regulators",
    ],
    histograms: [
      { label: "feat 8", color: "#10B981" },
      { label: "docs 5", color: "#8B5CF6" },
      { label: "fix 4", color: "#EF4444" },
      { label: "chore 3", color: "#D4A017" },
      { label: "refactor 2", color: "#3B82F6" },
    ],
  },
  {
    id: "v0-3-0",
    date: "2026-05-14",
    version: "v0.3.0 — Library of Alexandria",
    tags: [
      { label: "New", variant: "new" },
      { label: "API", variant: "api" },
      { label: "Fix", variant: "fix" },
      { label: "Infra", variant: "infra" },
      { label: "Docs", variant: "docs" },
      { label: "Module", variant: "module" },
      { label: "Breaking", variant: "breaking" },
    ],
    stats: [
      { label: "Commits", value: "72" },
      { label: "Files changed", value: "781" },
      { label: "Lines", value: "+41,030 / -24,004", up: true },
      { label: "Modules added", value: "9" },
      { label: "New packages", value: "3" },
    ],
    breaking:
      "All -deep and -long-tail suffixes dropped from module directories (e.g. municipal-long-tail/ → municipal/). All civint references purged from code, docs, DNS, and K8s — pure MapleSpike branding. Server-side mock-data.ts (422 lines) and pipeline-data.json (37KB) deleted — all data now live. 15 generated .d.ts files removed from engine/src. 6 stale docs files (MRD, MVP-SCOPE, PRD, Katzilla GAPs, etc.) deleted.",
    items: [
      "65 ingestion modules (was 28) — all 13 provinces/territories, 8 cities, 1,141+ unique endpoints, ~113K lines TypeScript",
      "22 live MCP tools — immigration, science, tribunals, LODE geospatial, AI analysis, semantic search, system health all returning real data. SSE transport built into cli.ts (PORT=3001). Deployed on K3s at port 32537",
      "A2AJ legal corpus — 116K+ decisions, 5K+ statutes via api.a2aj.ca (no auth)",
      "Legislation module — Justice Canada XML, Ontario e-Laws, BC Laws, provincial CKAN",
      "GoC Spending — GitHub-sourced federal contracts module + SDK agents",
      "GC Standards — canonical department mapping (83 codes), A2AJ dataset codes, CanLII court IDs",
      "Cross-reference engine — entity search across 7 data sources with unified timeline",
      "Federal deep — ESDC, CIHI, PHAC aggregated ingestion",
      "Provincial deep — CKAN federation for 9 smaller provinces (SK, MB, NS, NB, NL, PE, YT, NT, NU)",
      "Universities deep — CUDO enrolment data, Tri-Council grants, per-institution CKAN",
      "Attestation — unified Citation envelope, Merkle tree root hashing, Ed25519 signatures",
      "Attestation system: Unified Citation envelope, Merkle tree root hashing, Ed25519 signatures, content-addressable store, update frequency map (60 modules). Rich citation envelope with citation_text, citation_footnote, original_format fields matching Katzilla parity",
      "Live AI: /v1/ai_ask endpoint routing through AI Inference Gateway with CKAN fallback chain — 3 AI tools registered: ai_analyze, ai_ask, ai_search_semantic",
      "Module registry (registry.ts): 1707→91 lines refactor, getModule() / getModulesByCategory() / runModule() API, dynamic import dispatch, 63 modules in 20 categories",
      "MCP data unification: All 22 tools proxy through api-client.ts → API server → pipeline-data.json, pipeline-data.ts reduced 340→60 lines as thin re-export",
      "Cross-reference engine: Entity search across lobbying registry, GIC appointments, committees, elections, contracts, and CKAN datasets with unified timeline",
      "Portal (13 pages): Blog with RSS feed, Contact with FAQ, changelog, agents.json (27 agents, 79 actions), live data generator script. Bracket-style nav standardized across ALL pages",
      "Anti-grid brutalism landing page: Terminal-style API code demo replaces bento-card grid — the code IS the illustration. SDK tabstrip (curl/TypeScript/Python/JSON), MCP config showcase with copy-to-clipboard",
      "Dashboard glass sidebar: Quick-glance metrics with backdrop-filter blur, frosted glass effect, scroll-reveal animations on 8 sections (29 data-reveal attributes)",
      "Pricing page: Annual/monthly billing toggle (Save 17%), Pro BEST VALUE card with scale(1.02) glow, gold gradient border, FAQ",
      "VitePress documentation: 23 pages covering all MCP tools, APIs, and modules with 141→14 CSS class refactor",
      "Test coverage: 179/179 passing across 4 packages (engine 133, pipeline-core 46, SDK 7, MCP server 38). Test:coverage scripts for all 5 testable packages",
      "SDK v0.2.0: tsup dual CJS/ESM build, 20+ domain method groups, 7 tests, changesets for GitHub Releases, LangChain adapter (get_maplespike_tools())",
      "Gitea + Casdoor SSO: Self-hosted Git with OAuth SSO, Actions CI runner, NFS-backed repositories (30954)",
      "Full K3s production deployment: 8 services (API:30882, MCP:32537, Portal:30964, PostgreSQL, Gitea:30954, Uptime Kuma:32007, Casdoor:32556, NFS share), dev/prod namespaces with isolated ingress",
      "Katzilla competitive parity: Deep-dive research complete. Feature gaps identified for future build (Anthropic tool adapter, per-action Zod validation)",
      "32 CSV parsers deduplicated into shared utils/csv.ts",
      "26 build errors fixed across 6 modules (education-research, health-data, social-programs, federal-tribunals, criminal-justice, indigenous-relations)",
      "Docker images updated to pnpm v10, CMD fixed for clean stdio/SSE modes",
    ],
    topFiles: [
      "ROADMAP.md 19 edits",
      "api-server/index.ts 18 edits",
      "ci.yml 18 edits",
      "styles.css 14 edits",
      "mcp/tools/index.ts 14 edits",
    ],
    histograms: [
      { label: "docs 14", color: "#8B5CF6" },
      { label: "feat 12", color: "#10B981" },
      { label: "fix 6", color: "#EF4444" },
      { label: "chore 6", color: "#D4A017" },
      { label: "refactor 4", color: "#3B82F6" },
      { label: "portal 4", color: "#C23030" },
      { label: "rename 4", color: "#0891B2" },
    ],
  },
];

export default function ChangelogAccordion() {
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filtered = releases.filter((r) => {
    if (activeFilter === "all") return true;
    return r.tags.some((t) => t.variant === activeFilter);
  });

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20">
      {/* Tag filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors",
              activeFilter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="py-12 text-center">
          <p className="text-muted-foreground">No releases match the selected filter.</p>
        </Card>
      )}

      <Accordion
        type="multiple"
        defaultValue={["v0-3-0"]}
        className="space-y-4"
      >
        {filtered.map((release) => (
          <AccordionItem
            key={release.id}
            value={release.id}
            className="rounded-lg border bg-card px-6"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex flex-col items-start gap-1 text-left">
                <span className="text-xs font-mono text-muted-foreground">
                  {release.date}
                </span>
                <span className="text-base font-bold text-foreground">
                  {release.version}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {release.tags.map((tag) => (
                    <span
                      key={tag.label}
                      className={cn(
                        "inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                        TAG_CLASSES[tag.variant] || "border-border text-muted-foreground"
                      )}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {/* Stats */}
              <div className="mb-4 flex flex-wrap gap-2">
                {release.stats.map((stat) => (
                  <span
                    key={stat.label}
                    className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2.5 py-1 font-mono text-xs text-muted-foreground"
                  >
                    <strong className="text-foreground">{stat.value}</strong>{" "}
                    {stat.label}
                  </span>
                ))}
              </div>

              <Separator className="mb-4" />

              {/* Breaking change */}
              {release.breaking && (
                <div className="mb-4 rounded border-l-4 border-red-500 bg-red-500/5 px-4 py-3 text-sm text-muted-foreground">
                  <strong className="text-red-500">⚠️ Breaking change:</strong>{" "}
                  {release.breaking}
                </div>
              )}

              {/* Body items */}
              <ul className="mb-4 space-y-2 text-sm text-muted-foreground">
                {release.items.map((item, i) => (
                  <li key={i} className="leading-relaxed">
                    {item.startsWith("•") ? (
                      <span className="ml-4 text-xs text-muted-foreground">{item}</span>
                    ) : (
                      item
                    )}
                  </li>
                ))}
              </ul>

              {/* Module grid */}
              {release.modules && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Modules added this sprint
                  </p>
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {release.modules.map((m) => (
                      <span
                        key={m}
                        className="rounded border-l-2 border-primary bg-muted/30 px-2 py-1 font-mono text-xs text-muted-foreground"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Histogram */}
              {release.histograms && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {release.histograms.map((h) => (
                    <span
                      key={h.label}
                      className="inline-flex items-center gap-1 rounded bg-muted/50 px-2 py-0.5 font-mono text-xs text-muted-foreground"
                      style={{ color: h.color }}
                    >
                      <span
                        className="inline-block h-1 w-2 rounded"
                        style={{ backgroundColor: h.color }}
                      />
                      {h.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Top files */}
              {release.topFiles && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Most-changed files
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {release.topFiles.map((f) => (
                      <span
                        key={f}
                        className="rounded bg-muted/30 px-2 py-0.5 font-mono text-xs text-muted-foreground"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
