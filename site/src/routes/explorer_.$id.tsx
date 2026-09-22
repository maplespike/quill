import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Shell } from "@/components/site/shell";
import { MODULES } from "@/lib/catalog";
import { pageMeta } from "@/lib/page-meta";
import { SIGNAL_TYPES } from "@/lib/signals";

export const Route = createFileRoute("/explorer_/$id")({
  loader: ({ params }) => {
    const item = MODULES.find((module) => module.id === params.id);
    if (!item) throw notFound();
    return item;
  },
  head: ({ loaderData }) =>
    pageMeta(loaderData?.name ?? "Module", loaderData?.source ?? "Quill module"),
  component: ModulePage,
});

function ModulePage() {
  const item = Route.useLoaderData();
  const signals = SIGNAL_TYPES.filter((signal) =>
    (signal.moduleIds as readonly string[]).includes(item.id),
  );

  return (
    <Shell>
      <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">{item.group}</p>
        <h1 className="mt-3 font-display text-section text-ink">{item.name}</h1>
        <dl className="mt-8 divide-y divide-line border-y border-line">
          <div className="grid gap-1 py-4 sm:grid-cols-3">
            <dt className="text-sm text-muted">Jurisdiction</dt>
            <dd className="sm:col-span-2">{item.jurisdiction}</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-3">
            <dt className="text-sm text-muted">Source</dt>
            <dd className="sm:col-span-2">{item.source}</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-3">
            <dt className="text-sm text-muted">Id</dt>
            <dd className="font-mono text-sm sm:col-span-2">{item.id}</dd>
          </div>
        </dl>
        <h2 className="mt-10 font-display text-2xl tracking-tight">Detectors</h2>
        {signals.length === 0 ? (
          <p className="mt-3 text-muted">None of the named detectors read this module.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-muted">
            {signals.map((signal) => (
              <li key={signal.id}>
                {signal.name}. {signal.detail}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-8 text-sm">
          <Link to="/explorer" className="underline decoration-line-strong underline-offset-4">
            Back to the index
          </Link>
        </p>
      </article>
    </Shell>
  );
}
