import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";

const SWATCHES: { name: string; note: string; fill: string; ink: string }[] = [
  { name: "paper", note: "Page", fill: "bg-paper", ink: "text-ink" },
  { name: "surface", note: "Cards", fill: "bg-surface", ink: "text-ink" },
  { name: "chip", note: "Quiet fills", fill: "bg-chip", ink: "text-ink" },
  { name: "ink", note: "Text and primary actions", fill: "bg-ink", ink: "text-on-ink" },
  { name: "ink-soft", note: "Hover on ink", fill: "bg-ink-soft", ink: "text-on-ink" },
  { name: "muted", note: "Secondary text only", fill: "bg-muted", ink: "text-paper" },
];

const TYPE = [
  { role: "Hero", sample: "text-hero font-display", note: "Home title only. Weight 500." },
  { role: "Section", sample: "text-section font-display", note: "Page titles and section heads." },
  { role: "Card title", sample: "font-display text-2xl tracking-tight", note: "Newsreader, not a second sans." },
  { role: "Body", sample: "text-base", note: "Source Sans 3. Line height 1.5." },
  { role: "Label", sample: "font-mono text-xs uppercase tracking-widest", note: "IBM Plex Mono. Kickers, hashes, ids." },
] as const;

export const Route = createFileRoute("/style")({
  head: () =>
    pageMeta(
      "Style guide",
      "Quill's ink-and-paper system. Type, color, buttons, and what the old portal guide no longer uses.",
    ),
  component: StylePage,
});

function StylePage() {
  return (
    <Shell>
      <PageHeader
        kicker="Style guide"
        title="Ink, paper, and a nib. Nothing else."
        lede="This replaces the portal guide that used Inter, a maple-red primary, cyan focus rings, and aurora washes. New pages use the tokens below."
      />
      <div className="mx-auto grid max-w-6xl gap-16 px-5 py-16 sm:px-8">
        <section aria-labelledby="principles">
          <h2 id="principles" className="font-display text-2xl tracking-tight">
            Principles
          </h2>
          <ul className="mt-4 max-w-2xl space-y-3 text-muted">
            <li>One voice. Titles in Newsreader. Text in Source Sans 3. Data in IBM Plex Mono.</li>
            <li>Ink does the emphasis. Color is not decoration, and it is not a second brand hue.</li>
            <li>Planes, not stickers. Hairline borders. One soft shadow, on the hero console only.</li>
            <li>Every control is at least 44px. Motion is opacity and color, 150ms, and it stops when the reader asks.</li>
          </ul>
        </section>

        <section aria-labelledby="color">
          <h2 id="color" className="font-display text-2xl tracking-tight">
            Color
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SWATCHES.map((swatch) => (
              <div key={swatch.name} className={`rounded-panel border border-line p-4 ${swatch.fill}`}>
                <p className={`font-mono text-xs uppercase tracking-widest ${swatch.ink}`}>{swatch.name}</p>
                <p className={`mt-6 text-sm ${swatch.ink}`}>{swatch.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-2xl text-sm text-muted">
            Paper is #f4f2ec. Ink is #161614. Muted text is #534f46, and only for secondary lines.
            Lines are #ddd8cc. Do not introduce maple red, parliament cyan, or violet as fills.
          </p>
        </section>

        <section aria-labelledby="type">
          <h2 id="type" className="font-display text-2xl tracking-tight">
            Type
          </h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {TYPE.map((row) => (
              <div key={row.role} className="grid gap-2 py-6 md:grid-cols-4 md:items-baseline">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">{row.role}</p>
                <p className={`text-ink md:col-span-2 ${row.sample}`}>The public record</p>
                <p className="text-sm text-muted">{row.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="actions">
          <h2 id="actions" className="font-display text-2xl tracking-tight">
            Actions and fields
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button">Primary</Button>
            <Button type="button" variant="secondary">
              Secondary
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 rounded-panel bg-ink p-6">
            <Button type="button" variant="inverse">
              Inverse
            </Button>
            <Button type="button" variant="ghost">
              Ghost
            </Button>
          </div>
          <label className="mt-6 block text-sm font-medium" htmlFor="style-field">
            Field
          </label>
          <input
            id="style-field"
            defaultValue="you@newsroom.ca"
            className="mt-2 h-11 w-full max-w-md rounded-control border border-line bg-surface px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          />
          <p className="mt-3 max-w-xl text-sm text-muted">
            Primary is ink on paper. Inverse is paper on ink, for bands that have already gone dark.
            Focus is a 2px ink ring, not a cyan outline. Buttons press to 0.98 scale.
          </p>
        </section>

        <section aria-labelledby="radius">
          <h2 id="radius" className="font-display text-2xl tracking-tight">
            Radius
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Outer radius equals inner radius plus padding. A panel at 32px with 24px of padding holds
            an 8px control. Do not give the card and the button the same corner.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-control border border-line bg-surface p-4">
              <p className="font-mono text-xs text-muted">control · 8px</p>
              <p className="mt-4 text-sm">Buttons, inputs, chips.</p>
            </div>
            <div className="rounded-console border border-line bg-surface p-5">
              <p className="font-mono text-xs text-muted">console · 28px</p>
              <p className="mt-4 text-sm">Hero sample, 20px padding.</p>
            </div>
            <div className="rounded-panel border border-line bg-surface p-6">
              <p className="font-mono text-xs text-muted">panel · 32px</p>
              <p className="mt-4 text-sm">Cards, 24px padding.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="retired">
          <h2 id="retired" className="font-display text-2xl tracking-tight">
            Retired
          </h2>
          <div className="mt-6 rounded-panel border border-line bg-surface p-6">
            <ul className="max-w-2xl space-y-3 text-muted">
              <li>Maple red as the primary fill, and red-to-ember gradient titles.</li>
              <li>Parliament cyan focus rings.</li>
              <li>Inter as the only family, including for navigation.</li>
              <li>Aurora glows, dot grids, and landing backgrounds that leak into other pages.</li>
              <li>Card hover that lifts and recolors the border.</li>
            </ul>
            <p className="mt-6 text-sm text-ink">
              The product is unchanged. The chrome is.{" "}
              <Link to="/changelog" className="underline decoration-line-strong underline-offset-4">
                Changelog
              </Link>
            </p>
          </div>
        </section>
      </div>
    </Shell>
  );
}
