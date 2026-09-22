import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/fr")({
  head: () =>
    pageMeta(
      "Quill",
      "Les données publiques du Canada, à la portée de n'importe quelle IA.",
    ),
  component: FrenchPage,
});

function FrenchPage() {
  return (
    <Shell>
      <PageHeader
        kicker="MapleSpike · données publiques"
        title="Les données publiques du Canada, à la portée de n'importe quelle IA."
        lede="Quill lit le registre, les comités, la Gazette et les tribunaux. Chaque réponse porte une empreinte SHA-256 que vous pouvez recalculer."
      />
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-8 md:grid-cols-3">
        <section>
          <h2 className="font-display text-2xl tracking-tight">207 modules</h2>
          <p className="mt-3 text-muted">
            Fédéral, provinces, territoires, villes. La licence de la source reste attachée au
            document.
          </p>
        </section>
        <section>
          <h2 className="font-display text-2xl tracking-tight">184 outils</h2>
          <p className="mt-3 text-muted">
            Claude, ChatGPT, Cursor, Gemini, Grok ou LM Studio. Une configuration MCP.
          </p>
        </section>
        <section>
          <h2 className="font-display text-2xl tracking-tight">Au Canada</h2>
          <p className="mt-3 text-muted">
            Le code est ouvert. L'offre gratuite est de 1 000 appels par mois. La vérification
            n'est pas comptée.
          </p>
        </section>
      </div>
      <p className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-5 pb-16 text-sm sm:px-8">
        <Link to="/" className="underline decoration-line-strong underline-offset-4">
          English
        </Link>
        <Link to="/coverage" className="underline decoration-line-strong underline-offset-4">
          Couverture
        </Link>
        <Link to="/docs" className="underline decoration-line-strong underline-offset-4">
          Notes
        </Link>
        <Link to="/pricing" className="underline decoration-line-strong underline-offset-4">
          Tarifs
        </Link>
      </p>
    </Shell>
  );
}
