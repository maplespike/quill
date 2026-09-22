import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { pageMeta } from "@/lib/page-meta";
import { useDesk } from "@/lib/use-desk";

const field =
  "mt-2 h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/30";

export const Route = createFileRoute("/dashboard/extraction")({
  head: () =>
    pageMeta("Extraction", "Point Quill at a government portal. The worker runs on the cluster."),
  component: ExtractionPage,
});

function ExtractionPage() {
  const { desk, ready, update } = useDesk();
  const [url, setUrl] = useState("");
  const [jurisdiction, setJurisdiction] = useState("Federal");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [saved, setSaved] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ ...desk, extraction: { url: url.trim(), cadence, jurisdiction } });
    setSaved(true);
  }

  const current = ready ? desk.extraction : null;

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Extraction</p>
      <h1 className="mt-3 font-display text-section text-ink">A portal the pipeline should read.</h1>
      <p className="mt-4 max-w-xl text-muted">
        Browser extraction is how Quill reaches pages that are not a clean API. Saving here keeps
        the target on this browser. It does not start a crawl.
      </p>
      <form onSubmit={onSubmit} className="mt-8 grid max-w-lg gap-4">
        <div>
          <label htmlFor="extract-url" className="text-sm font-medium">
            Start URL
          </label>
          <input
            id="extract-url"
            required
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://open.canada.ca"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="extract-jurisdiction" className="text-sm font-medium">
            Jurisdiction
          </label>
          <input
            id="extract-jurisdiction"
            required
            value={jurisdiction}
            onChange={(event) => setJurisdiction(event.target.value)}
            className={field}
          />
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Cadence</legend>
          <div className="mt-2 flex gap-2">
            {(["daily", "weekly"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={cadence === value}
                onClick={() => setCadence(value)}
                className={`min-h-11 rounded-control px-3 text-sm capitalize ${cadence === value ? "bg-ink text-paper" : "bg-chip text-ink"}`}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
        <Button type="submit" size="lg" className="w-fit">
          Save target
        </Button>
        {saved ? (
          <p className="text-sm text-muted" role="status">
            Saved on this browser.
          </p>
        ) : null}
      </form>
      {current ? (
        <p className="mt-8 font-mono text-xs text-muted">
          Current target {current.url} · {current.jurisdiction} · {current.cadence}
        </p>
      ) : null}
    </div>
  );
}
