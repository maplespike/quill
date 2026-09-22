import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { MODULES } from "@/lib/catalog";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/ask")({
  head: () =>
    pageMeta("Ask", "Shape a Quill question. Live answers run on the cluster, not in this preview."),
  component: AskPage,
});

function AskPage() {
  const [question, setQuestion] = useState("Which committees heard from telecom lobbyists?");
  const [asked, setAsked] = useState("");

  const matches = useMemo(() => {
    const words = asked
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length > 3);
    if (words.length === 0) return [];
    return MODULES.filter((item) => {
      const haystack = [item.name, item.group, item.source, item.jurisdiction].join(" ").toLowerCase();
      return words.some((word) => haystack.includes(word));
    }).slice(0, 6);
  }, [asked]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAsked(question.trim());
  }

  const call = JSON.stringify(
    { tool: "ai_ask", arguments: { question: asked || question } },
    null,
    2,
  );

  return (
    <Shell>
      <PageHeader
        kicker="Ask"
        title="Ask in plain language. Cite the row."
        lede="A connected server answers from the record and returns a hash. This page only matches your question to the catalog and shows the tool call."
      />
      <form onSubmit={onSubmit} className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <label htmlFor="question" className="text-sm font-medium">
          Question
        </label>
        <textarea
          id="question"
          required
          rows={4}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="mt-2 w-full rounded-control border border-line bg-surface p-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        />
        <Button className="mt-4" type="submit" size="lg">
          Match the catalog
        </Button>
        {asked ? (
          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="font-display text-2xl tracking-tight">Catalog matches</h2>
              {matches.length === 0 ? (
                <p className="mt-4 text-muted" role="status">
                  No module name shares a word with that question.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-line border-y border-line">
                  {matches.map((item) => (
                    <li key={item.id} className="py-3">
                      <Link
                        to="/explorer/$id"
                        params={{ id: item.id }}
                        className="text-ink underline decoration-line-strong underline-offset-4"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-1 text-sm text-muted">{item.source}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2 className="font-display text-2xl tracking-tight">Tool call</h2>
              <pre className="mt-4 overflow-x-auto rounded-control bg-ink p-4 font-mono text-xs leading-relaxed text-on-ink">
                {call}
              </pre>
              <p className="mt-3 text-sm text-muted">
                POST /v1/ai/ask on the gateway does the same job with a key.{" "}
                <Link to="/api-explorer" className="underline decoration-line-strong underline-offset-4">
                  API explorer
                </Link>
              </p>
            </section>
          </div>
        ) : null}
      </form>
    </Shell>
  );
}
