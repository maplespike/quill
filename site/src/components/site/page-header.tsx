export function PageHeader({
  kicker,
  title,
  lede,
}: {
  kicker: string;
  title: string;
  lede: string;
}) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-20">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">{kicker}</p>
        <h1 className="mt-3 max-w-3xl font-display text-section text-ink">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">{lede}</p>
      </div>
    </header>
  );
}
