import { Link } from "@tanstack/react-router";
import { Braces, GitFork, Languages, Plug, Server, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/plans";

const STEPS = [
  {
    n: "01",
    title: "Connect",
    body: "One MCP block, or a REST key. Quill Lite starts with npx and no database. Production sits on your cluster.",
  },
  {
    n: "02",
    title: "Ask",
    body: "Committees, the Gazette, lobbying filings, courts, procurement, StatCan. Plain language in. A cited record out.",
  },
  {
    n: "03",
    title: "Verify",
    body: "SHA-256 over canonical JSON, plus source URL, retrieval time, and licence. Recompute the hash. Disagree in public.",
  },
] as const;

const COVERAGE: { title: string; items: string[] }[] = [
  {
    title: "Federal core",
    items: [
      "IRCC, StatCan, Health Canada",
      "CRA charities, federal budget",
      "Proactive disclosure, ATI",
      "CIPO, CMHC, NPRI",
    ],
  },
  {
    title: "Parliament",
    items: [
      "House and Senate committees",
      "Hansard",
      "Canada Gazette I, II, III",
      "LEGISinfo, GIC appointments",
    ],
  },
  {
    title: "Oversight",
    items: [
      "Auditor General, PBO",
      "Ethics and lobbying commissioners",
      "Competition Bureau, CRTC",
      "OSFI, FCAC, FINTRAC",
    ],
  },
  {
    title: "Corporate and influence",
    items: [
      "Lobbying registry since 1996",
      "CanadaBuys procurement",
      "SEDI trades, SEDAR+ filings",
      "Corporations Canada, think-tank feeds",
    ],
  },
  {
    title: "Provinces and cities",
    items: [
      "All 13 legislatures",
      "13 CKAN portals",
      "273 regulators",
      "Cities direct, thousands via federation",
    ],
  },
  {
    title: "Justice and live feeds",
    items: [
      "CanLII and A2AJ decisions",
      "Justice Canada legislation",
      "Weather alerts, border waits",
      "English and French",
    ],
  },
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Plug,
    title: "One line of config",
    body: "Paste it into the client you already use. Claude, ChatGPT, Cursor, Gemini, Grok, or LM Studio.",
  },
  {
    icon: ShieldCheck,
    title: "Verify without trusting us",
    body: "If Quill publishes a hash, you can reproduce it. Public verify endpoints stay free on every tier.",
  },
  {
    icon: GitFork,
    title: "Influence, already joined",
    body: "Lobbying, committees, GIC appointments, contracts, and elections resolve to one entity graph.",
  },
  {
    icon: Server,
    title: "Sovereign by default",
    body: "Laptop, Docker, or a Canadian K3s cluster. Nix-reproducible. Zero external cloud spend.",
  },
  {
    icon: Braces,
    title: "REST and two SDKs",
    body: "@maplespike/sdk on npm. quill-sdk on PyPI. The same citation model on every surface.",
  },
  {
    icon: Languages,
    title: "Built for both official languages",
    body: "Bilingual tools and prompts. Federal through municipal sources in one index, not thirteen portals.",
  },
];

export function Story() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28" aria-labelledby="value-title">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">Why Quill</p>
        <h2 id="value-title" className="mt-3 max-w-3xl font-display text-section text-ink">
          The model gets context. You keep the citation.
        </h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n}>
              <p className="font-mono text-xs tabular-nums text-muted">{step.n}</p>
              <h3 className="mt-3 font-display text-2xl tracking-tight text-ink">{step.title}</h3>
              <p className="mt-2 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="coverage" className="scroll-mt-24 border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">Coverage</p>
          <h2 className="mt-3 max-w-3xl font-display text-section text-ink">
            Every source, openly aggregated.
          </h2>
          <p className="mt-4 max-w-2xl text-muted">
            Two hundred and seven modules across federal, provincial, territorial, and municipal
            records. Each fetch keeps its origin, licence, and pipeline version.
          </p>
          <div className="mt-12 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {COVERAGE.map((group) => (
              <article key={group.title} className="bg-surface p-6">
                <h3 className="font-display text-xl tracking-tight text-ink">{group.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-muted">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="mt-8 text-sm">
            <Link to="/coverage" className="underline decoration-line-strong underline-offset-4">
              Open the full catalog
            </Link>
          </p>
        </div>
      </section>

      <section id="product" className="scroll-mt-24 mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">Product</p>
        <h2 className="mt-3 max-w-3xl font-display text-section text-ink">
          A memory layer other tools can trust.
        </h2>
        <p className="mt-4 max-w-2xl text-muted">
          Connect a client, cite a record, or run the whole stack on hardware you own.
        </p>
        <div className="mt-12 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="bg-paper p-6">
              <feature.icon className="size-5 text-ink" strokeWidth={1.75} aria-hidden="true" />
              <h3 className="mt-4 font-display text-xl tracking-tight text-ink">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted">{feature.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link to="/mcp" className="underline decoration-line-strong underline-offset-4">
            MCP setup
          </Link>
          <Link to="/docs" className="underline decoration-line-strong underline-offset-4">
            Docs
          </Link>
          <Link to="/style" className="underline decoration-line-strong underline-offset-4">
            Style guide
          </Link>
        </p>
      </section>

      <section className="bg-ink text-on-ink">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-section">Stop briefing a model from a browser tab.</h2>
            <p className="mt-3 text-on-ink-muted">
              Connect Quill. Ask in the client you already pay for. Keep the hash next to the answer.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="inverse" size="lg">
              <a href="#access">Request access</a>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <a href={SITE.github}>View source</a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
