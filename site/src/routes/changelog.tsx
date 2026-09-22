import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";

const ENTRIES = [
  {
    when: "September 2026",
    title: "Editorial portal",
    body: "The public site moves to the ink-and-paper system: Newsreader for titles, Source Sans 3 for text, IBM Plex Mono for hashes and labels. The dark maple-red guide is retired. See the style guide.",
  },
  {
    when: "July 2026",
    title: "Repository is quill",
    body: "The working tree renamed from maplespike to quill. The GitHub remote, @maplespike npm scope, and maplespike.ca stay. Product images and charts are quill-*.",
  },
  {
    when: "July 2026",
    title: "Tools on real rows",
    body: "184 MCP tools read the shared database. The engine resolves entities across lobbying, committees, GIC appointments, contracts, and elections. Stripe checkout is live for Pro+.",
  },
  {
    when: "May 2026",
    title: "Quill opens",
    body: "Pipeline, local database, and the MCP server ship as one product. The free tier is 1,000 calls a month. Citation checks are not metered.",
  },
] as const;

export const Route = createFileRoute("/changelog")({
  head: () => pageMeta("Changelog", "What changed in Quill, in plain language."),
  component: ChangelogPage,
});

function ChangelogPage() {
  return (
    <Shell>
      <PageHeader
        kicker="Changelog"
        title="What actually shipped."
        lede="Dates match the repository record. No patch-note theatre."
      />
      <ol className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        {ENTRIES.map((entry) => (
          <li key={entry.title} className="grid gap-2 border-t border-line py-8 sm:grid-cols-4 sm:gap-8">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">{entry.when}</p>
            <div className="sm:col-span-3">
              <h2 className="font-display text-2xl tracking-tight">{entry.title}</h2>
              <p className="mt-3 max-w-2xl text-muted">{entry.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Shell>
  );
}
