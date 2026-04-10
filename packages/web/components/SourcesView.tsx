"use client";

import { sourceLinks } from "../lib/data";

export function SourcesView() {
  const sources = Object.entries(sourceLinks);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1
          className="text-xl font-bold mb-2"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          Data Sources & Methodology
        </h1>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          CivicIntel exclusively uses publicly available Canadian government
          data. Every signal, connection, and assertion in this platform traces
          back to an official primary source. No speculation, no anonymous tips,
          no editorial inference.
        </p>
      </div>

      {/* Source cards */}
      <div className="flex flex-col gap-4 mb-8">
        {sources.map(([key, src]) => (
          <a
            key={key}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card hover:bg-[var(--card-hover)] transition-colors block"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] text-sm font-bold">
                {src.label.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-semibold">{src.label}</div>
                <div className="text-[10px] text-[var(--muted)]">{src.url}</div>
              </div>
              <span className="ml-auto text-[var(--muted)] text-xs">↗</span>
            </div>
            <p className="text-xs text-[var(--muted)]">{src.description}</p>
          </a>
        ))}
      </div>

      {/* Methodology */}
      <div className="card border-dashed mb-8">
        <h2 className="text-sm font-bold mb-3">How Signals Are Detected</h2>
        <div className="grid grid-cols-2 gap-4 text-xs text-[var(--muted)] leading-relaxed">
          <div>
            <h3 className="text-[var(--foreground)] font-semibold mb-1">
              Entity Resolution
            </h3>
            <p>
              People and organizations are matched across data sources using
              name normalization, alias management, and role-based
              disambiguation. Multiple mentions of "L3Harris Technologies"
              across contracts, lobbying filings, and disclosure records are
              resolved to a single entity.
            </p>
          </div>
          <div>
            <h3 className="text-[var(--foreground)] font-semibold mb-1">
              Signal Detection
            </h3>
            <p>
              7 signal types detect patterns: procurement-lobbying overlap,
              revolving door transitions, spousal interest proximity,
              sole-source + heavy lobbying correlation, donation-proximity
              correlation, mandate divergence, and international layering.
            </p>
          </div>
          <div>
            <h3 className="text-[var(--foreground)] font-semibold mb-1">
              Confidence Scoring
            </h3>
            <p>
              Each signal receives a confidence score (0–100%) based on: number
              of independent data sources confirming the connection, temporal
              proximity of events, directness of the relationship chain, and
              whether primary documents are available. Scores below 50% are
              flagged as speculative.
            </p>
          </div>
          <div>
            <h3 className="text-[var(--foreground)] font-semibold mb-1">
              Data Freshness
            </h3>
            <p>
              The sweep engine periodically re-fetches data from all government
              portals. New contracts, lobbying filings, donations, and
              disclosures are automatically cross-referenced against existing
              entities and signal patterns.
            </p>
          </div>
        </div>
      </div>

      {/* Legal */}
      <div className="card bg-[var(--background)]">
        <h2 className="text-sm font-bold mb-2">Legal & Ethics</h2>
        <div className="text-xs text-[var(--muted)] leading-relaxed space-y-2">
          <p>
            <strong className="text-[var(--foreground)]">Non-partisan.</strong>{" "}
            CivicIntel is not affiliated with any political party. It tracks
            donations and connections involving all parties equally.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">
              Public data only.
            </strong>{" "}
            All data comes from official government sources that are freely
            accessible to any citizen. No private information, no leaked
            documents, no speculation.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">
              Connections ≠ accusations.
            </strong>{" "}
            Detecting that two entities appear in the same data sources does not
            imply wrongdoing. Correlation is not causation. Every connection is
            presented with its confidence score and primary sources.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Open source.</strong>{" "}
            The entire platform is open source under the MIT license. Every
            algorithm, every data source, every signal detection rule is
            auditable.
          </p>
        </div>
      </div>
    </div>
  );
}
