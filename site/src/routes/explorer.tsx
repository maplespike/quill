import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { GROUPS, MODULES } from "@/lib/catalog";
import { pageMeta } from "@/lib/page-meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/explorer")({
  head: () =>
    pageMeta("Explorer", "Browse the Quill module catalog by name, source, or jurisdiction."),
  component: ExplorerPage,
});

function ExplorerPage() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MODULES.filter((item) => {
      if (group !== "All" && item.group !== group) return false;
      if (!needle) return true;
      return [item.name, item.group, item.jurisdiction, item.source, item.id]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [query, group]);

  return (
    <Shell>
      <PageHeader
        kicker="Explorer"
        title="Find the module before you spend a call."
        lede="This index is the catalog, not a live filing. Record search runs against your key once Quill is connected."
      />
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <label className="block text-sm font-medium" htmlFor="module-query">
          Search
        </label>
        <input
          id="module-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Lobbying, Hansard, CanLII"
          className="mt-2 h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ink/30"
        />
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Group">
          {["All", ...GROUPS].map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={group === name}
              onClick={() => setGroup(name)}
              className={cn(
                "min-h-11 shrink-0 rounded-control px-3 text-sm",
                group === name ? "bg-ink text-paper" : "bg-chip text-ink hover:bg-paper-deep",
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="mt-6 font-mono text-xs tabular-nums text-muted">
          {results.length} {results.length === 1 ? "module" : "modules"}
        </p>
        {results.length === 0 ? (
          <p className="mt-6 text-ink" role="status">
            Nothing in the catalog matches that.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {results.map((item) => (
              <li key={item.id} className="grid gap-1 py-4 sm:grid-cols-4 sm:items-baseline sm:gap-6">
                <p className="text-ink sm:col-span-2">
                  <Link
                    to="/explorer/$id"
                    params={{ id: item.id }}
                    className="underline decoration-line-strong underline-offset-4"
                  >
                    {item.name}
                  </Link>
                </p>
                <p className="text-sm text-muted">{item.group}</p>
                <p className="text-sm text-muted">{item.source}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
