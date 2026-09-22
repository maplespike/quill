import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/lib/page-meta";

const ROWS = [
  ["LLM01", "Prompt injection", "Tool output is data. A filing is not an instruction to the model."],
  ["LLM02", "Sensitive disclosure", "The record is public. Keys and seats are not written into answers."],
  ["LLM03", "Supply chain", "Pipeline-core is AGPL. The server, engine, and portal are MIT."],
  ["LLM04", "Data poisoning", "Each module keeps its origin, licence, and pipeline version."],
  ["LLM05", "Improper output", "Claims that matter ship with a SHA-256 you can recompute."],
  ["LLM06", "Excessive agency", "The tools read and cite. They do not file, pay, or appoint."],
  ["LLM07", "System prompt leak", "Setup snippets are public. Customer prompts are not a training set."],
  ["LLM08", "Vector weakness", "Search is over the indexed record, not an unlabeled scrape."],
  ["LLM09", "Misinformation", "Verification stays free so a third party can check the hash."],
  ["LLM10", "Unbounded use", "Open is 1,000 calls a month. Citation checks are not metered."],
] as const;

export const Route = createFileRoute("/dashboard/owasp")({
  head: () => pageMeta("OWASP", "How Quill lines up with the OWASP LLM top 10. A map, not a certificate."),
  component: OwaspPage,
});

function OwaspPage() {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">OWASP LLM</p>
      <h1 className="mt-3 font-display text-section text-ink">A map, not a certificate.</h1>
      <p className="mt-4 max-w-xl text-muted">
        These are the controls the product is built around. They are not an audit letter.
      </p>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {ROWS.map((row) => (
          <li key={row[0]} className="grid gap-2 py-4 sm:grid-cols-12">
            <p className="font-mono text-xs text-muted sm:col-span-2">{row[0]}</p>
            <p className="text-ink sm:col-span-3">{row[1]}</p>
            <p className="text-sm text-muted sm:col-span-7">{row[2]}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
