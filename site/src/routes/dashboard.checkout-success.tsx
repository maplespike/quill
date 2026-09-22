import { createFileRoute, Link } from "@tanstack/react-router";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/dashboard/checkout-success")({
  head: () => pageMeta("Checkout", "Stripe sent you back. The seat provisions on the cluster."),
  component: CheckoutPage,
});

function CheckoutPage() {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Checkout</p>
      <h1 className="mt-3 font-display text-section text-ink">If Stripe sent you here, the seat is provisioning.</h1>
      <p className="mt-4 max-w-xl text-muted">
        This preview did not take a payment. A live checkout returns to this path after the cluster
        confirms the session.
      </p>
      <p className="mt-8 text-sm">
        <Link to="/dashboard/billing" className="underline decoration-line-strong underline-offset-4">
          Back to billing
        </Link>
      </p>
    </div>
  );
}
