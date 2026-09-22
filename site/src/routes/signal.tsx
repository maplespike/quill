import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { MODULES } from "@/lib/catalog";
import { pageMeta } from "@/lib/page-meta";
import { SIGNAL_TYPES } from "@/lib/signals";

export const Route = createFileRoute("/signal")({
  head: () =>
    pageMeta("Signal", "Which Quill detectors a source can feed. Not a live alert feed."),
  component: SignalPage,
});

function SignalPage() {
  const [moduleId, setModuleId] = useState(MODULES[0].id);
  const selected = MODULES.find((item) => item.id === moduleId) ?? MODULES[0];
  const hits = SIGNAL_TYPES.filter((signal) =>
    (signal.moduleIds as readonly string[]).includes(selected.id),
  );

  return (
    <Shell>
      <PageHeader
        kicker="Signal"
        title="Detectors, tied to the source that can feed them."
        lede="In-camera, revolving door, sole-source, lobbying overlap, ethics. Pick a module. This page shows which detectors read it. It does not invent an alert."
      />
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-2">
        <div>
          <label htmlFor="signal-module" className="text-sm font-medium">
            Module
          </label>
          <select
            id="signal-module"
            value={moduleId}
            onChange={(event) => setModuleId(event.target.value)}
            className="mt-2 h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            {MODULES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <p className="mt-4 text-sm text-muted">{selected.source}</p>
        </div>
        <div>
          {hits.length === 0 ? (
            <p className="text-ink" role="status">
              This source is in the catalog. It does not feed a named detector.
            </p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {hits.map((signal) => (
                <li key={signal.id} className="py-4">
                  <p className="text-ink">{signal.name}</p>
                  <p className="mt-1 text-sm text-muted">{signal.detail}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-sm">
            <Link to="/watcher" className="underline decoration-line-strong underline-offset-4">
              Watch a module
            </Link>
          </p>
        </div>
      </div>
    </Shell>
  );
}
