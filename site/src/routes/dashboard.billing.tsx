import { createFileRoute, Link } from "@tanstack/react-router";
import { PLAN_COPY, PLANS } from "@/lib/plans";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/dashboard/billing")({
  head: () => pageMeta("Billing", "Open, Desk, and Sovereign. Checkout runs on the cluster."),
  component: BillingPage,
});

function BillingPage() {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Billing</p>
      <h1 className="mt-3 font-display text-section text-ink">The seat you are paying for.</h1>
      <p className="mt-4 max-w-xl text-muted">
        Stripe checkout is live on the cluster for Desk and above. This page does not start a charge.
      </p>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {PLANS.map((id) => (
          <li key={id} className="grid gap-2 py-5 sm:grid-cols-3">
            <p className="font-display text-xl">{PLAN_COPY[id].name}</p>
            <p className="text-sm text-muted sm:col-span-2">{PLAN_COPY[id].audience}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm">
        <Link to="/pricing" className="underline decoration-line-strong underline-offset-4">
          Compare tiers
        </Link>
      </p>
    </div>
  );
}
