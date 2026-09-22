import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { MODULES } from "@/lib/catalog";
import { newId } from "@/lib/desk";
import { pageMeta } from "@/lib/page-meta";
import { useDesk } from "@/lib/use-desk";

export const Route = createFileRoute("/watcher")({
  head: () => pageMeta("Watcher", "Watch a Quill module. The list stays on this browser."),
  component: WatcherPage,
});

function WatcherPage() {
  const { desk, ready, update } = useDesk();
  const [moduleId, setModuleId] = useState(MODULES[0].id);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (desk.watches.some((watch) => watch.moduleId === moduleId)) return;
    update({
      ...desk,
      watches: [{ id: newId(), moduleId, created: new Date().toISOString() }, ...desk.watches],
    });
  }

  function remove(id: string) {
    update({ ...desk, watches: desk.watches.filter((watch) => watch.id !== id) });
  }

  return (
    <Shell>
      <PageHeader
        kicker="Watcher"
        title="Tell Quill which source to keep an eye on."
        lede="A cluster watch fires when that module publishes. Here, the list is saved in this browser so you can set it up before you have a key."
      />
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="watch-module" className="text-sm font-medium">
              Module
            </label>
            <select
              id="watch-module"
              value={moduleId}
              onChange={(event) => setModuleId(event.target.value)}
              className="mt-2 h-11 w-full rounded-control border border-line bg-surface px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
            >
              {MODULES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="lg">
            Watch
          </Button>
        </form>
        {!ready || desk.watches.length === 0 ? (
          <p className="mt-8 text-muted" role="status">
            No watches on this browser.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {desk.watches.map((watch) => {
              const item = MODULES.find((module) => module.id === watch.moduleId);
              return (
                <li key={watch.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-ink">{item?.name ?? watch.moduleId}</p>
                    <p className="font-mono text-xs text-muted">{watch.created.slice(0, 10)}</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => remove(watch.id)}>
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Shell>
  );
}
