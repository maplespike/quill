import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DESK_YEARLY_CAD,
  PLAN_COPY,
  type BillingCycle,
  type PlanId,
  deskPrice,
} from "@/lib/plans";
import { cn, scrollToId } from "@/lib/utils";

type PricingProps = {
  cycle: BillingCycle;
  onCycle: (cycle: BillingCycle) => void;
  onChoose: (plan: PlanId) => void;
};

export function Pricing({ cycle, onCycle, onChoose }: PricingProps) {
  function choose(plan: PlanId) {
    onChoose(plan);
    scrollToId("access");
  }

  return (
    <section id="pricing" className="scroll-mt-24 border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">Pricing</p>
            <h2 className="mt-3 font-display text-section text-ink">
              Start free. Pay when the desk depends on it.
            </h2>
            <p className="mt-4 text-muted">
              Prices in CAD. Card or Interac e-Transfer. Prefer not to subscribe? Pay per call in
              USDC from a tenth of a cent.
            </p>
          </div>
          <div>
            <div
              className="flex w-fit rounded-control bg-chip p-1"
              role="group"
              aria-label="Billing cycle"
            >
            {(
              [
                ["month", "Monthly"],
                ["year", "Yearly"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={cycle === id}
                className={cn(
                  "min-h-11 rounded-control px-4 text-sm transition-colors duration-150",
                  cycle === id ? "bg-ink text-paper" : "text-muted hover:text-ink",
                )}
                onClick={() => onCycle(id)}
              >
                {label}
              </button>
            ))}
          </div>
            <p className="mt-2 text-sm text-muted">Yearly is two months free.</p>
          </div>
        </div>

        <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-3">
          <PlanCard
            plan="open"
            price="$0"
            cadence="per month"
            action="Start free"
            variant="secondary"
            onChoose={choose}
          />
          <PlanCard
            plan="desk"
            price={`$${deskPrice(cycle)}`}
            cadence={cycle === "month" ? "CAD / month" : `CAD / month, billed $${DESK_YEARLY_CAD} yearly`}
            action="Choose Desk"
            variant="inverse"
            featured
            onChoose={choose}
            className="order-first lg:order-none"
          />
          <PlanCard
            plan="sovereign"
            price="Custom"
            cadence="scoped to your cluster"
            action="Talk to us"
            variant="secondary"
            onChoose={choose}
          />
        </div>
        <p className="mt-6 text-sm text-muted">
          Citation, discovery, and verification endpoints stay free on every tier. Cancel Desk any
          time.
        </p>
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  price,
  cadence,
  action,
  variant,
  featured = false,
  className,
  onChoose,
}: {
  plan: PlanId;
  price: string;
  cadence: string;
  action: string;
  variant: "secondary" | "inverse";
  featured?: boolean;
  className?: string;
  onChoose: (plan: PlanId) => void;
}) {
  const copy = PLAN_COPY[plan];
  return (
    <article
      className={cn(
        "flex flex-col rounded-panel p-6",
        featured ? "bg-ink text-on-ink" : "border border-line bg-surface text-ink",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-2xl tracking-tight">{copy.name}</h3>
        {featured ? (
          <p className="font-mono text-xs uppercase tracking-widest text-on-ink-muted">Recommended</p>
        ) : null}
      </div>
      <p className={cn("mt-2 text-sm", featured ? "text-on-ink-muted" : "text-muted")}>{copy.audience}</p>
      <p className="mt-6 font-display text-4xl tabular-nums tracking-tight">{price}</p>
      <p className={cn("mt-1 text-sm", featured ? "text-on-ink-muted" : "text-muted")}>{cadence}</p>
      <ul className="mt-6 flex-1 space-y-3 text-sm">
        {copy.points.map((point) => (
          <li key={point} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <Button
        className="mt-8 w-full"
        variant={variant}
        size="lg"
        type="button"
        onClick={() => onChoose(plan)}
      >
        {action}
      </Button>
    </article>
  );
}
