import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";

const FAMILIES = [
  {
    name: "Entities",
    tools: "resolve_entity, get_entity_profile, linked_entities",
    body: "One id across lobbying, committees, appointments, corporations, and elections.",
  },
  {
    name: "Citations",
    tools: "get_citation, verify_claim",
    body: "Fetch a stored hash, or recompute one. Verification does not require a paid seat.",
  },
  {
    name: "Parliament",
    tools: "Committee evidence, Hansard, track_bill",
    body: "House, Senate, Gazette, and LEGISinfo, with in-camera flags where the source publishes them.",
  },
  {
    name: "Influence",
    tools: "Lobbying search, find_connections, signal_check",
    body: "Registry filings joined to the rooms and the contracts, not left as a CSV.",
  },
  {
    name: "Briefs",
    tools: "Provenance brief, fact_check, ai_ask",
    body: "A short, hashed briefing. The model can read it. You can recompute it.",
  },
] as const;

const STDIO = `{
  "mcpServers": {
    "quill": {
      "command": "npx",
      "args": ["-y", "@maplespike/quill-mcp"]
    }
  }
}`;

export const Route = createFileRoute("/mcp")({
  head: () =>
    pageMeta(
      "MCP",
      "Connect Quill to Claude, ChatGPT, Cursor, Gemini, Grok, or LM Studio. 184 tools.",
    ),
  component: McpPage,
});

function McpPage() {
  return (
    <Shell>
      <PageHeader
        kicker="MCP"
        title="One config. A hundred and eighty-four tools."
        lede="Quill Lite needs no database. The hosted server speaks SSE. Both return the same citation shape."
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl tracking-tight">Stdio</h2>
          <p className="mt-3 text-muted">Paste this into the client you already use.</p>
          <pre className="mt-4 overflow-x-auto rounded-control bg-ink p-4 font-mono text-xs leading-relaxed text-on-ink">
            {STDIO}
          </pre>
          <p className="mt-3 text-sm text-muted">Claude, ChatGPT, Cursor, Gemini, Grok, LM Studio.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl tracking-tight">SSE</h2>
          <p className="mt-3 text-muted">For hosts that attach a remote MCP server.</p>
          <p className="mt-4 overflow-x-auto rounded-control border border-line bg-surface px-4 py-3 font-mono text-xs text-ink">
            https://mcp.maplespike.ca/sse
          </p>
          <p className="mt-6 text-sm text-muted">
            REST lives beside it. A search looks like a bearer token against{" "}
            <span className="font-mono text-xs text-ink">quill.maplespike.ca/v1/search</span>.
          </p>
          <p className="mt-4 text-sm">
            <Link to="/docs" className="underline decoration-line-strong underline-offset-4">
              Read the setup notes
            </Link>
          </p>
        </section>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 className="font-display text-2xl tracking-tight">Tool families</h2>
          <p className="mt-3 max-w-2xl text-muted">
            184 tools are live. These are the families a desk actually calls. The full index ships
            with the server.
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2">
            {FAMILIES.map((family, i) => (
              <article
                key={family.name}
                className={`bg-paper p-6${FAMILIES.length % 2 === 1 && i === FAMILIES.length - 1 ? " sm:col-span-2" : ""}`}
              >
                <h3 className="font-display text-xl tracking-tight">{family.name}</h3>
                <p className="mt-2 font-mono text-xs text-muted">{family.tools}</p>
                <p className="mt-3 text-sm text-muted">{family.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
