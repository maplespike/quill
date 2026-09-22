import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/privacy")({
  head: () => pageMeta("Privacy", "What this Quill site stores, and what it does not."),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <Shell>
      <PageHeader
        kicker="Privacy"
        title="The access form stays in this browser."
        lede="Read this before you leave an email. It is short on purpose."
      />
      <div className="mx-auto max-w-3xl space-y-6 px-5 py-12 text-muted sm:px-8">
        <p>
          The request-access form saves your email, optional name, desk, and chosen tier in local
          storage on this device. This page does not transmit that form to MapleSpike.
        </p>
        <p>
          Quill's product, once you hold a key, is different. API calls, MCP sessions, and
          billing are handled by the services at quill.maplespike.ca, api.maplespike.ca, and
          mcp.maplespike.ca, on Canadian infrastructure.
        </p>
        <p>
          Government records Quill indexes keep their own licence, mostly the Open Government
          Licence – Canada. Quill does not take ownership of that data.
        </p>
      </div>
    </Shell>
  );
}
