import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/terms")({
  head: () => pageMeta("Terms", "How to use Quill, the code, and the public record."),
  component: TermsPage,
});

function TermsPage() {
  return (
    <Shell>
      <PageHeader
        kicker="Terms"
        title="Use the record. Cite the hash."
        lede="Plain terms for the portal. They are not a substitute for counsel."
      />
      <div className="mx-auto max-w-3xl space-y-6 px-5 py-12 text-muted sm:px-8">
        <p>
          Quill is a reader over Canadian public data. You are responsible for what you publish
          from it. A hash proves the payload did not change. It does not prove the underlying
          filing was wise, complete, or current.
        </p>
        <p>
          Open is free up to 1,000 MCP calls a month. Citation, discovery, and verification
          endpoints are not metered. Desk is billed in CAD and can be cancelled. Sovereign runs
          on infrastructure you control.
        </p>
        <p>
          Pipeline-core is AGPL-3.0. The MCP server, engine, SDKs, and portal are MIT. Do not strip
          either licence. Public-sector data remains under the licence it was published with.
        </p>
      </div>
    </Shell>
  );
}
