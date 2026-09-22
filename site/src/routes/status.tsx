import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";

const SURFACES = [
  {
    name: "Portal",
    href: "https://quill.maplespike.ca",
    note: "Product home. Static, served from the Canadian cluster.",
  },
  {
    name: "API",
    href: "https://api.maplespike.ca",
    note: "REST gateway. Discovery, metadata, citation, and verification are the public tier.",
  },
  {
    name: "MCP",
    href: "https://mcp.maplespike.ca/sse",
    note: "Remote MCP over server-sent events. Stdio remains npx @maplespike/quill-mcp.",
  },
] as const;

export const Route = createFileRoute("/status")({
  head: () => pageMeta("Status", "Published Quill surfaces: portal, API, and MCP."),
  component: StatusPage,
});

function StatusPage() {
  return (
    <Shell>
      <PageHeader
        kicker="Status"
        title="Three published surfaces."
        lede="Portal, API, and MCP are on the MapleSpike tunnel. This page names them. It does not invent an uptime percentage."
      />
      <ul className="mx-auto grid max-w-6xl gap-4 px-5 py-12 sm:px-8">
        {SURFACES.map((surface) => (
          <li key={surface.name} className="rounded-panel border border-line bg-surface p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl tracking-tight">{surface.name}</h2>
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Published</p>
            </div>
            <p className="mt-3 text-muted">{surface.note}</p>
            <a
              href={surface.href}
              className="mt-4 inline-flex min-h-11 items-center font-mono text-xs text-ink underline decoration-line-strong underline-offset-4"
            >
              {surface.href}
            </a>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
