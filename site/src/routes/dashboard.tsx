import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Shell } from "@/components/site/shell";

const LINKS = [
  { to: "/dashboard", label: "Overview", exact: true },
  { to: "/dashboard/billing", label: "Billing", exact: false },
  { to: "/dashboard/extraction", label: "Extraction", exact: false },
  { to: "/dashboard/owasp", label: "OWASP", exact: false },
  { to: "/watcher", label: "Watcher", exact: false },
  { to: "/workspace", label: "Workspace", exact: false },
] as const;

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <Shell>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Desk</p>
          <nav aria-label="Dashboard" className="mt-3 flex flex-col">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeOptions={{ exact: link.exact }}
                className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink"
                activeProps={{
                  className: "inline-flex min-h-11 items-center text-sm text-ink",
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="lg:col-span-9">
          <Outlet />
        </div>
      </div>
    </Shell>
  );
}
