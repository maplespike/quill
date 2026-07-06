import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  Database,
  GitBranch,
  Hash,
  ShieldCheck,
} from "lucide-react";
import logo from "@/assets/logo.svg";

/**
 * MapleSpike Fabric — the MCP server + REST API, the first sub-product
 * shipped under the MapleSpike brand. Swap this single constant if the
 * product is renamed; it flows into the first-ship callout, the closing
 * CTA, the meta/manifest description and the footer.
 */
const PRODUCT_NAME = "Quill";

const ease = [0.22, 1, 0.36, 1] as const;

/* Static lookup maps for brand-semantic tokens.
   Tailwind v4 doesn't safelist dynamic class strings, so we map
   semantic keys to literal utility classes at the source. */
const accentDot: Record<string, string> = {
  maple: "bg-[var(--maple)]",
  parliament: "bg-[var(--parliament)]",
  moss: "bg-[var(--moss)]",
  flame: "bg-[var(--flame)]",
  ink: "bg-[var(--ink)]",
};

const accentText: Record<string, string> = {
  maple: "text-maple",
  parliament: "text-parliament",
  moss: "text-moss",
  flame: "text-flame",
  ink: "text-ink",
};

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-foreground selection:text-background">
      <TopBar />

      <main className="flex-1">
        <Hero />
        <NumbersStrip />
        <FirstShipCallout />
        <Coverage />
        <Verification />
        <Sovereignty />
        <ClosingCta />
      </main>

      <SiteFooter />
    </div>
  );
}

/* ───────── Top bar ───────── */

function TopBar() {
  return (
    <header className="sticky top-0 inset-x-0 z-40 bg-background/80 backdrop-blur border-b hairline">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <img
            src={logo}
            alt="MapleSpike"
            width={24}
            height={24}
            className="rounded-[3px]"
          />
          <span className="text-sm font-medium tracking-tight">
            MapleSpike
          </span>
          <span className="flex gap-1 ml-1" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--maple)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--parliament)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--moss)]" />
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a
            href="#coverage"
            className="hover:text-foreground transition-colors"
          >
            Coverage
          </a>
          <a
            href="#verify"
            className="hover:text-foreground transition-colors"
          >
            Verification
          </a>
          <a
            href="#stack"
            className="hover:text-foreground transition-colors"
          >
            Stack
          </a>
          <a
            href="https://maplespike.ca/pricing"
            className="hover:text-foreground transition-colors"
          >
            Pricing
          </a>
          <a
            href="https://github.com/reverb256/quill"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            Docs <ArrowUpRight className="h-3 w-3" />
          </a>
        </nav>

        <a
          href="https://maplespike.ca/auth"
          className="text-sm font-medium text-foreground hover:text-[var(--maple)] transition-colors inline-flex items-center gap-1"
        >
          Sign in <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </header>
  );
}

/* ───────── Hero (brand-first · open source + self-sovereign) ───────── */

function Hero() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-28 md:pt-36 md:pb-44">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="max-w-3xl"
        >
          <div className="flex items-center gap-3 mb-10">
            <span className="flex gap-1" aria-hidden>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--maple)]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--parliament)]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--moss)]" />
            </span>
            <span className="label-cap">MapleSpike</span>
            <span className="h-px w-8 bg-foreground/15" aria-hidden />
            <span className="label-cap text-muted-foreground">
              Open source &middot; Self-sovereign
            </span>
          </div>

          <h1 className="font-display text-[clamp(2.75rem,7vw,5.25rem)] font-medium leading-[1.02] tracking-[-0.025em] text-foreground">
            Open by default.
            <br />
            <span className="text-muted-foreground">Sovereign</span>
            <br />
            <span className="text-muted-foreground">by design.</span>
          </h1>

          <p className="mt-8 max-w-xl text-base md:text-lg text-muted-foreground leading-[1.65]">              <span className="text-foreground font-medium">MapleSpike</span>{" "}
            is an open&shy;-source brand. We build the data stack so the records,
            the audit trail and the compute stay with you &mdash; on your
            hardware, forked from public sources, free of managed&shy;-service
            lock&shy;-in.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-3">
            <a
              href="https://maplespike.ca/auth"
              className="inline-flex items-center gap-2 h-11 px-5 bg-foreground text-background text-sm font-medium rounded-md hover:bg-[var(--maple)] transition-colors"
            >
              Open console <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="https://github.com/reverb256/quill"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-11 px-5 border hairline text-sm font-medium rounded-md hover:border-[var(--maple)] hover:text-[var(--maple)] transition-colors"
            >
              Fork on GitHub <ArrowUpRight className="h-4 w-4" />
            </a>
            <span className="text-xs text-muted-foreground ml-1">
              AGPL-3.0 &middot; MIT &middot; free while in beta
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────── Numbers ───────── */

function NumbersStrip() {
  const stats = [
    { value: "208", label: "Open modules", accent: "parliament" },
    { value: "165", label: "MCP tools", accent: "maple" },
    { value: "≈199K", label: "Lines of TS", accent: "moss" },
    { value: "14", label: "Packages", accent: "flame" },
  ];

  return (
    <section
      aria-label="Coverage at a glance"
      className="border-b hairline"
    >
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <ul className="grid grid-cols-2 md:grid-cols-4 divide-y divide-x hairline md:divide-y-0">
          {stats.map((s, i) => (
            <li
              key={s.label}
              className="px-2 md:px-6 py-6 md:py-2 flex flex-col gap-1"
            >
              <span className="label-cap text-muted-foreground flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${accentDot[s.accent]}`}
                  aria-hidden
                />
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-mono-num text-3xl md:text-4xl font-medium text-foreground">
                {s.value}
              </span>
              <span className="text-sm text-muted-foreground">
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ───────── First-ship callout ─────────
   Surfaces MapleSpike Fabric as the brand's first shipped sub-product,
   directly under the brand promise. */

function FirstShipCallout() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          viewport={{ once: true, margin: "-80px" }}
          className="relative bg-parchment border hairline rounded-md px-6 py-7 md:px-8 md:py-8 flex flex-col md:flex-row md:items-center gap-6"
        >
          <div
            className="absolute left-0 top-6 bottom-6 w-[3px] rounded-r bg-[var(--maple)]"
            aria-hidden
          />
          <div className="md:flex-1 md:max-w-md">
            <span className="label-cap flex items-center gap-2 text-maple">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--maple)]"
                aria-hidden
              />
              First ship &middot; Live now
            </span>
            <h3 className="mt-2 font-display text-2xl md:text-3xl font-medium tracking-tight text-parchment-foreground">
              {PRODUCT_NAME}
            </h3>
            <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">
              The MCP server + REST API we ship first. Open&shy;-source under
              MIT, forkable, runs in your cluster or on your laptop.{" "}
              <span className="text-foreground">165&nbsp;live&nbsp;tools</span>{" "}
              across federal, provincial, parliamentary, regulatory and
              corporate data.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:ml-auto">
            <a
              href="https://maplespike.ca/auth"
              className="inline-flex items-center gap-2 h-10 px-4 bg-foreground text-background text-sm font-medium rounded-md hover:bg-[var(--maple)] transition-colors"
            >
              Open Quill <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <a
              href="#coverage"
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-foreground hover:text-[var(--maple)] transition-colors"
            >
              See coverage <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────── Coverage ───────── */

function Coverage() {
  const cols: Array<{ title: string; accent: string; items: string[] }> = [
    {
      title: "Federal core",
      accent: "parliament",
      items: [
        "IRCC immigration",
        "StatCan WDS",
        "Health Canada",
        "CRA Charity registry",
        "Federal Budget",
        "Proactive Disclosure",
        "ATI",
        "NPRI + Species at Risk",
        "Impact Assessment",
        "CIPO + CMHC",
      ],
    },
    {
      title: "Parliament",
      accent: "parliament",
      items: [
        "House committees",
        "Senate committees",
        "Hansard transcripts",
        "Canada Gazette I / II / III",
        "LEGISinfo",
        "GIC appointments",
      ],
    },
    {
      title: "Oversight",
      accent: "maple",
      items: [
        "OAG · PBO",
        "Ethics Commissioner",
        "Lobbying Commissioner",
        "Competition Bureau",
        "CRTC",
        "Privacy Commissioner",
        "OSFI · FCAC · FINTRAC",
        "Ontario SIU (police)",
      ],
    },
    {
      title: "Corporate + influence",
      accent: "ink",
      items: [
        "Lobbying Registry (1996→)",
        "CanadaBuys procurement",
        "SEDI insider trades",
        "SEDAR+ filings",
        "Corporations Canada",
        "31 NGO / think tank RSS feeds",
      ],
    },
    {
      title: "Provincial + municipal",
      accent: "moss",
      items: [
        "All 13 legislatures",
        "13 CKAN portals",
        "273 regulators across 21 categories",
        "19 cities (direct)",
        "3,490+ via CKAN federation",
        "Regional authorities",
      ],
    },
    {
      title: "Justice + media + rest",
      accent: "flame",
      items: [
        "CanLII case law",
        "A2AJ (116K+ decisions)",
        "Justice Canada legislation",
        "CRTC market reports",
        "DND personnel + procurement",
        "ECCC alerts, CBSA wait times",
      ],
    },
  ];

  return (
    <section id="coverage" className="border-b hairline scroll-mt-24">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="grid md:grid-cols-12 gap-y-10 md:gap-x-12 mb-14">
          <div className="md:col-span-4">
            <span className="label-cap flex items-center gap-2 text-maple">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--maple)]"
                aria-hidden
              />
              02 &middot; Scope
            </span>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-medium tracking-tight">
              Open data, openly aggregated.
            </h2>
          </div>
          <p className="md:col-span-7 md:col-start-6 text-muted-foreground text-[15px] leading-[1.7] max-w-xl">
            Every source cites back to its public origin.{" "}
            <span className="text-foreground font-medium">208&nbsp;modules</span>{" "}
            of Canada&rsquo;s public record &mdash; federal, provincial,
            parliamentary, regulatory and corporate &mdash; searchable through
            one primitive, all open.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px hairline bg-foreground/10">
          {cols.map((c) => (
            <div key={c.title} className="bg-background p-6 md:p-7">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-medium tracking-tight flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${accentDot[c.accent]}`}
                    aria-hidden
                  />
                  {c.title}
                </h3>
                <span className="font-mono-num text-xs text-muted-foreground">
                  {c.items.length.toString().padStart(2, "0")}
                </span>
              </div>
              <ul className="mt-5 divide-y hairline">
                {c.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center justify-between py-2 text-[14px] text-muted-foreground"
                  >
                    <span>{item}</span>
                    <Check
                      className="h-3 w-3 text-foreground/30"
                      aria-hidden
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Verification ───────── */

function Verification() {
  const samples = [
    { k: "source", v: "open.canada.ca / lobbying_registry.csv" },
    { k: "fetched", v: "2026-06-29T14:02:11Z" },
    { k: "sha256", v: "9f2e3c…7b41a0" },
    { k: "audit", v: "pipeline-core · v0.4.1" },
  ];

  return (
    <section id="verify" className="border-b hairline scroll-mt-24">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="grid md:grid-cols-12 gap-y-10 md:gap-x-12">
          <div className="md:col-span-5">
            <span className="label-cap flex items-center gap-2 text-moss">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--moss)]"
                aria-hidden
              />
              03 &middot; Verification
            </span>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-medium tracking-tight">
              Run it yourself. Verify every record.
            </h2>
            <p className="mt-5 text-muted-foreground text-[15px] leading-[1.7] max-w-md">
              Every record carries a SHA&shy;-256 citation, the source URL it
              was fetched from, the timestamp, and the pipeline version that
              produced it. Fork the recipe, re&shy;-fetch the source,
              re&shy;-hash the result &mdash; and decide for yourself.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {[
                ["Provenance", "Source URL on every record"],
                ["Reproducibility", "Re-fetch and re-hash yourself"],
                ["Cross-reference", "Lobbying ↔ committees ↔ GIC ↔ contracts"],
                ["License-aware", "Source license preserved per record"],
              ].map(([k, v]) => (
                <div key={k} className="border-t hairline pt-3">
                  <div className="label-cap text-foreground flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[var(--moss)]"
                      aria-hidden
                    />
                    {k}
                  </div>
                  <p className="mt-1 text-muted-foreground">{v}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-6 md:col-start-7">
            <div className="border hairline rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b hairline">
                <span className="label-cap text-muted-foreground flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[var(--moss)]"
                    aria-hidden
                  />
                  Record header
                </span>
                <span className="font-mono-num text-xs text-muted-foreground">
                  sample &middot; 1 of 208
                </span>
              </div>
              <dl className="font-mono-num text-[13px]">
                {samples.map((row, i) => (
                  <div
                    key={row.k}
                    className={`flex items-baseline gap-4 px-4 py-3 ${
                      i !== samples.length - 1 ? "border-b hairline" : ""
                    }`}
                  >
                    <dt className="text-muted-foreground min-w-[5.5rem]">
                      {row.k}
                    </dt>
                    <dd className="text-foreground truncate">{row.v}</dd>
                  </div>
                ))}
              </dl>
              <div className="px-4 py-3 tape-moss border-t hairline flex items-center gap-2">
                <ShieldCheck
                  className="h-3.5 w-3.5 text-moss"
                  aria-hidden
                />
                <span className="text-xs text-foreground">
                  Citation verified &middot; pipeline is open&shy;-source
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Self-sovereign stack ───────── */

function Sovereignty() {
  const stack: Array<{
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    title: string;
    line: string;
    accent: string;
  }> = [
    {
      icon: Database,
      title: "Storage",
      line: "Open-source database · SQLite mirror · SHA-256 indexed",
      accent: "ink",
    },
    {
      icon: GitBranch,
      title: "Orchestration",
      line: "TypeScript pipeline · Nix-built · GitOps",
      accent: "parliament",
    },
    {
      icon: Boxes,
      title: "Delivery",
      line: "Open-source SDKs · MCP (165 tools) · REST API",
      accent: "maple",
    },
    {
      icon: Hash,
      title: "Sovereignty",
      line: "Your hardware · K3s · zero external cloud",
      accent: "moss",
    },
  ];

  return (
    <section id="stack" className="border-b hairline scroll-mt-24">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="grid md:grid-cols-12 gap-y-10 md:gap-x-12 mb-12">
          <div className="md:col-span-4">
            <span className="label-cap flex items-center gap-2 text-parliament">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--parliament)]"
                aria-hidden
              />
              04 &middot; Stack
            </span>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-medium tracking-tight">
              Self-sovereign by default.
            </h2>
          </div>
          <p className="md:col-span-7 md:col-start-6 text-muted-foreground text-[15px] leading-[1.7] max-w-xl">
            Open source from pipeline to dashboard. The whole stack &mdash;
            ingest, store, serve &mdash; runs on your infrastructure, forked
            from public sources, reproducible from a single command. No
            managed&shy;-service wall, no exit fee, no telemetry home.
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px hairline bg-foreground/10">
          {stack.map(({ icon: Icon, title, line, accent }) => (
            <li key={title} className="bg-background p-6">
              <Icon
                className={`h-4 w-4 ${accentText[accent]}`}
                strokeWidth={1.5}
                aria-hidden
              />
              <div className="mt-4 text-sm font-medium tracking-tight">
                {title}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{line}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ───────── Closing Cta ───────── */

function ClosingCta() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-3xl"
        >
          <span className="label-cap flex items-center gap-3">
            <span className="flex gap-1" aria-hidden>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--maple)]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--parliament)]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--moss)]" />
            </span>
            MapleSpike
          </span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl font-medium leading-[1.05] tracking-tight">
            Run your own stack.
          </h2>
          <p className="mt-6 max-w-xl text-muted-foreground text-[15px] leading-[1.7]">
            {PRODUCT_NAME} is live. Fork the pipeline, sign in with email,
            and query 208 modules through MCP or the REST API. No card,
            no managed&shy;-service wall &mdash; full access while MapleSpike is
            in beta.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <a
              href="https://maplespike.ca/auth"
              className="inline-flex items-center gap-2 h-11 px-5 bg-foreground text-background text-sm font-medium rounded-md hover:bg-[var(--maple)] transition-colors"
            >
              Try {PRODUCT_NAME} <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="https://github.com/reverb256/quill"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-11 px-5 text-sm font-medium text-foreground hover:text-[var(--maple)] transition-colors"
            >
              Fork on GitHub <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────── Footer ───────── */

function SiteFooter() {
  return (
    <footer className="border-t hairline">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid md:grid-cols-12 gap-y-8 md:gap-x-12">
          <div className="md:col-span-6 flex items-center gap-3">
            <img
              src={logo}
              alt=""
              width={20}
              height={20}
              className="rounded-[3px]"
              aria-hidden
            />
            <div>
              <span className="text-sm font-medium">MapleSpike</span>
              <p className="text-xs text-muted-foreground">
                Open&shy;-source self&shy;-sovereign infrastructure &middot; for
                Canada&rsquo;s public record
              </p>
            </div>
          </div>

          <nav className="md:col-span-6 grid grid-cols-2 sm:grid-cols-3 gap-y-2 text-sm text-muted-foreground">
            <a
              href="#coverage"
              className="hover:text-foreground transition-colors"
            >
              Coverage
            </a>
            <a
              href="#verify"
              className="hover:text-foreground transition-colors"
            >
              Verification
            </a>
            <a
              href="https://github.com/reverb256/quill"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              Source <ArrowUpRight className="h-3 w-3" />
            </a>
            <a
              href="https://maplespike.ca/auth"
              className="hover:text-foreground transition-colors"
            >
              Console
            </a>
            <a
              href="#stack"
              className="hover:text-foreground transition-colors"
            >
              Stack
            </a>
            <span className="font-mono-num">AGPL-3.0 &middot; MIT</span>
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t hairline">
          {/* 4-bar brand rule */}
          <div className="flex h-[2px] w-44 gap-1 mb-6" aria-hidden>
            <span className="flex-1 rounded-sm bg-[var(--maple)]" />
            <span className="flex-1 rounded-sm bg-[var(--parliament)]" />
            <span className="flex-1 rounded-sm bg-[var(--moss)]" />
            <span className="flex-1 rounded-sm bg-[var(--flame)]" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>
              Open source. Fork it. Run it. Verify it. Canada's public record,
              on tap.
            </p>
            <p className="font-mono-num">
              © 2026 MapleSpike &middot; {PRODUCT_NAME}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
