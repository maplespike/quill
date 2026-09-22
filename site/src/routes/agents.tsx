import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";

const CLIENTS = [
  { name: "Claude", note: "Desktop and Claude Code. Native MCP." },
  { name: "ChatGPT", note: "Desktop app. Add the server under MCP." },
  { name: "Cursor", note: "Drop the JSON into the MCP config." },
  { name: "Gemini", note: "AI Studio or the API, as a tool." },
  { name: "Grok", note: "Function calling against the same citation shape." },
  { name: "LM Studio", note: "Local models. Stdio, no hosted key required for Lite." },
] as const;

const SNIPPET = `{
  "mcpServers": {
    "quill": {
      "command": "npx",
      "args": ["-y", "@maplespike/quill-mcp"]
    }
  }
}`;

export const Route = createFileRoute("/agents")({
  head: () =>
    pageMeta("Agents", "Connect Quill to Claude, ChatGPT, Cursor, Gemini, Grok, or LM Studio."),
  component: AgentsPage,
});

function AgentsPage() {
  return (
    <Shell>
      <PageHeader
        kicker="Agents"
        title="The client changes. The citation does not."
        lede="184 tools. One stdio config for the apps that already speak MCP, or SSE if the host is remote."
      />
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2">
        <ul className="divide-y divide-line border-y border-line">
          {CLIENTS.map((client) => (
            <li key={client.name} className="grid gap-1 py-4 sm:grid-cols-3">
              <p className="text-ink">{client.name}</p>
              <p className="text-sm text-muted sm:col-span-2">{client.note}</p>
            </li>
          ))}
        </ul>
        <div>
          <pre className="overflow-x-auto rounded-control bg-ink p-4 font-mono text-xs leading-relaxed text-on-ink">
            {SNIPPET}
          </pre>
          <p className="mt-4 font-mono text-xs text-muted">https://mcp.maplespike.ca/sse</p>
          <p className="mt-4 text-sm">
            <Link to="/mcp" className="underline decoration-line-strong underline-offset-4">
              Tool families
            </Link>
          </p>
        </div>
      </div>
    </Shell>
  );
}
