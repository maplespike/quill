import { createFileRoute, Link } from "@tanstack/react-router";
import { pageMeta } from "@/lib/page-meta";
import { useDesk } from "@/lib/use-desk";

export const Route = createFileRoute("/dashboard/")({
  head: () => pageMeta("Dashboard", "Your Quill seat, preview keys, and watches on this browser."),
  component: DashboardHome,
});

function DashboardHome() {
  const { desk, ready } = useDesk();

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Overview</p>
      <h1 className="mt-3 font-display text-section text-ink">This browser's desk.</h1>
      <p className="mt-4 max-w-xl text-muted">
        The cluster dashboard needs a key. Until you have one, the seat, keys, and watches below
        stay on this device. Nothing here is a live usage total.
      </p>
      <dl className="mt-8 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3">
        <div className="bg-paper p-5">
          <dt className="font-mono text-xs uppercase tracking-widest text-muted">Seat</dt>
          <dd className="mt-2 text-ink">
            {ready && desk.seat ? desk.seat.tier : "None yet"}
          </dd>
        </div>
        <div className="bg-paper p-5">
          <dt className="font-mono text-xs uppercase tracking-widest text-muted">Preview keys</dt>
          <dd className="mt-2 font-mono tabular-nums text-ink">{ready ? desk.keys.length : "—"}</dd>
        </div>
        <div className="bg-paper p-5">
          <dt className="font-mono text-xs uppercase tracking-widest text-muted">Watches</dt>
          <dd className="mt-2 font-mono tabular-nums text-ink">{ready ? desk.watches.length : "—"}</dd>
        </div>
      </dl>
      <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link to="/signup" className="underline decoration-line-strong underline-offset-4">
          Request a seat
        </Link>
        <Link to="/dashboard/billing" className="underline decoration-line-strong underline-offset-4">
          Billing
        </Link>
        <Link to="/api-explorer" className="underline decoration-line-strong underline-offset-4">
          API explorer
        </Link>
      </p>
    </div>
  );
}
