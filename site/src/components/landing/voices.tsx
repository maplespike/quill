const VOICES = [
  {
    quote:
      "We stopped pasting Hansard into a chatbot and hoping. The model gets the record. We get a hash legal can recompute.",
    role: "Investigative editor",
    place: "National newsroom",
  },
  {
    quote:
      "Lobbying filings and committee appearances used to be a week of spreadsheets. It is one tool call, with the source still attached.",
    role: "Policy analyst",
    place: "Caucus research",
  },
  {
    quote:
      "It runs on our cluster. No US cloud account, and the citation endpoint stays free so counsel can check a claim without a seat.",
    role: "Infrastructure lead",
    place: "Public-interest lab",
  },
] as const;

export function Voices() {
  return (
    <section id="desks" className="scroll-mt-24 mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">Desks</p>
      <h2 className="mt-3 max-w-3xl font-display text-section text-ink">
        Built for people who get quoted on a bad fact.
      </h2>
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {VOICES.map((voice) => (
          <figure key={voice.role} className="flex flex-col rounded-panel border border-line bg-surface p-6">
            <blockquote className="flex-1 font-display text-xl leading-snug tracking-tight text-ink">
              “{voice.quote}”
            </blockquote>
            <figcaption className="mt-6 text-sm">
              <span className="block text-ink">{voice.role}</span>
              <span className="text-muted">{voice.place}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
