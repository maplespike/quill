import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";

const CHAPTERS = [
  { href: "#start", label: "Start" },
  { href: "#verify", label: "Verify" },
  { href: "#sdk", label: "SDKs" },
] as const;

export const Route = createFileRoute("/docs")({
  head: () =>
    pageMeta("Docs", "Install Quill Lite, verify a claim, and use the TypeScript or Python SDK."),
  component: DocsPage,
});

function DocsPage() {
  return (
    <Shell>
      <PageHeader
        kicker="Docs"
        title="From a blank client to a hash you can recompute."
        lede="Three steps. The long reference lives in the repository. This is the path a desk actually takes."
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-12">
        <nav aria-label="On this page" className="lg:col-span-3">
          <ul className="flex gap-4 lg:sticky lg:top-24 lg:flex-col lg:gap-2">
            {CHAPTERS.map((chapter) => (
              <li key={chapter.href}>
                <a
                  href={chapter.href}
                  className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink"
                >
                  {chapter.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-16 lg:col-span-9">
          <section id="start" className="scroll-mt-24">
            <h2 className="font-display text-2xl tracking-tight">Start</h2>
            <p className="mt-3 text-muted">
              Quill Lite is an in-memory MCP server. No SQLite, no API key, enough to see the shape
              of a tool call.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-control bg-ink p-4 font-mono text-xs leading-relaxed text-on-ink">
              {`npx @maplespike/quill-mcp`}
            </pre>
            <p className="mt-4 text-muted">
              The full stack — API, portal, and MCP — is Docker Compose in the repo:{" "}
              <span className="font-mono text-xs text-ink">./scripts/dev-up.sh</span>.
            </p>
            <p className="mt-4 text-sm">
              <Link to="/mcp" className="underline decoration-line-strong underline-offset-4">
                Client config
              </Link>
            </p>
          </section>
          <section id="verify" className="scroll-mt-24">
            <h2 className="font-display text-2xl tracking-tight">Verify</h2>
            <p className="mt-3 text-muted">
              A claim bundle carries the SHA-256 of its canonical JSON, plus source, retrieval time,
              and licence. If Quill publishes the hash, you can reproduce it without trusting Quill.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted">
              <li>Take the canonical JSON exactly. Whitespace is part of the hash.</li>
              <li>Hash the UTF-8 bytes with SHA-256.</li>
              <li>Compare. Public verify endpoints stay free on every tier.</li>
            </ol>
            <p className="mt-4 text-sm">
              <Link to="/citation" className="underline decoration-line-strong underline-offset-4">
                Hash a payload in the browser
              </Link>
            </p>
          </section>
          <section id="sdk" className="scroll-mt-24">
            <h2 className="font-display text-2xl tracking-tight">SDKs</h2>
            <p className="mt-3 text-muted">Typed clients. Same citation model as MCP and REST.</p>
            <pre className="mt-4 overflow-x-auto rounded-control bg-ink p-4 font-mono text-xs leading-relaxed text-on-ink">
              {`npm i @maplespike/sdk\npip install quill-sdk`}
            </pre>
            <p className="mt-4 text-muted">
              Pipeline-core is AGPL-3.0. The MCP server, engine, SDKs, and this portal are MIT.
              Government records keep their own licence.
            </p>
          </section>
        </div>
      </div>
    </Shell>
  );
}
