import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { GROUPS, MODULES } from "@/lib/catalog";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/coverage")({
  head: () =>
    pageMeta(
      "Coverage",
      "Federal, parliamentary, provincial, municipal, and court sources in the Quill index.",
    ),
  component: CoveragePage,
});

function CoveragePage() {
  return (
    <Shell>
      <PageHeader
        kicker="Coverage"
        title="Every source, with its licence still attached."
        lede="207 modules. This is the catalog the tools read from — not a scrape you have to re-check by hand."
      />
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-10">
          {GROUPS.map((group) => {
            const rows = MODULES.filter((item) => item.group === group);
            return (
              <section key={group} aria-labelledby={group}>
                <h2 id={group} className="font-display text-2xl tracking-tight text-ink">
                  {group}
                </h2>
                <ul className="mt-4 divide-y divide-line border-y border-line">
                  {rows.map((row) => (
                    <li key={row.id} className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-6">
                      <p className="text-ink">{row.name}</p>
                      <p className="text-sm text-muted">{row.jurisdiction}</p>
                      <p className="text-sm text-muted">{row.source}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <p className="mt-12 text-sm text-muted">
          Search the same list in the{" "}
          <Link to="/explorer" className="underline decoration-line-strong underline-offset-4">
            explorer
          </Link>
          . Hashes for a single record are explained on{" "}
          <Link to="/citation" className="underline decoration-line-strong underline-offset-4">
            verify
          </Link>
          .
        </p>
      </div>
    </Shell>
  );
}
