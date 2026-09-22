import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/plans";
import { cn } from "@/lib/utils";

const MCP_CONFIG = `{
  "mcpServers": {
    "quill": {
      "command": "npx",
      "args": ["-y", "@maplespike/quill-mcp"]
    }
  }
}`;

const STATS = [
  { value: "207", label: "Data modules" },
  { value: "184", label: "MCP tools" },
  { value: "13", label: "Legislatures" },
  { value: "1,000", label: "Free calls / month" },
] as const;

export function Hero() {
  const [pane, setPane] = useState<"brief" | "config">("brief");

  return (
    <section id="top" className="border-b border-line">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-6">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">
            {SITE.org} · Sovereign public data
          </p>
          <h1 className="mt-4 font-display text-hero text-ink">
            Canadian government data, on tap for any AI.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Quill reads the public record so a model does not have to invent it. Parliament,
            lobbying, courts, procurement, and statistics — every claim hashed, sourced, and
            reproducible without trusting us.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <a href="#access">Request access</a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#pricing">See pricing</a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted">
            No card. Citation checks stay free.{" "}
            <a className="underline decoration-line-strong underline-offset-4 hover:text-ink" href={SITE.url}>
              quill.maplespike.ca
            </a>
          </p>
        </div>

        <div className="min-w-0 lg:col-span-6">
          <div className="rounded-console border border-line bg-surface p-5 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-xs text-muted">Sample brief · not a live record</p>
              <div className="flex rounded-control bg-chip p-1" role="tablist" aria-label="Sample views">
                {(
                  [
                    ["brief", "Citation"],
                    ["config", "MCP config"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={pane === id}
                    className={cn(
                      "min-h-11 rounded-control px-3 text-sm transition-colors duration-150",
                      pane === id ? "bg-ink text-paper" : "text-muted hover:text-ink",
                    )}
                    onClick={() => setPane(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {pane === "brief" ? (
              <div className="mt-4 rounded-control bg-paper p-4" role="tabpanel">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">Query</p>
                <p className="mt-1 text-ink">Lobbying registrations · environment committee</p>
                <dl className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                {(
                  [
                    ["Organization", "Example registrant"],
                    ["Committee", "House · Environment"],
                    ["Source", "Lobbying Commissioner · OGL-CA"],
                    ["sha256", "4c1e9a0b…f17c"],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-widest text-muted">{label}</dt>
                    <dd className={cn("mt-1 text-sm text-ink", label === "sha256" && "font-mono text-xs")}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 border-t border-line pt-3 font-mono text-xs text-muted">
                {"echo -n '<canonical json>' | sha256sum"}
              </p>
              </div>
            ) : (
              <div className="mt-4 rounded-control bg-ink p-4" role="tabpanel">
                <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-on-ink">
                  {MCP_CONFIG}
                </pre>
                <p className="mt-3 text-xs text-on-ink-muted">
                  Claude, ChatGPT, Cursor, Gemini, Grok, LM Studio.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                "border-line px-5 py-6 sm:px-8",
                index % 2 === 0 && "border-r lg:border-r",
                index < 2 && "border-b lg:border-b-0",
                index < STATS.length - 1 && "lg:border-r",
              )}
            >
              <dt className="text-sm text-muted">{stat.label}</dt>
              <dd className="mt-1 font-display text-3xl tabular-nums tracking-tight text-ink">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
