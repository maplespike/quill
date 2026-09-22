import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/auth/callback")({
  head: () => pageMeta("Sign-in", "The identity provider returned you to Quill."),
  component: CallbackPage,
});

function CallbackPage() {
  return (
    <Shell>
      <PageHeader
        kicker="Sign-in"
        title="The provider sent you back."
        lede="Passkey, OAuth, and GitHub login finish on the cluster. This preview does not complete a session."
      />
      <p className="mx-auto max-w-6xl px-5 py-12 text-sm sm:px-8">
        <Link to="/signup" className="underline decoration-line-strong underline-offset-4">
          Request a seat instead
        </Link>
      </p>
    </Shell>
  );
}
