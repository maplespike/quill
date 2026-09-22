import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import type { Seat } from "@/lib/desk";
import { pageMeta } from "@/lib/page-meta";
import { useDesk } from "@/lib/use-desk";

const field =
  "mt-2 h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/30";

export const Route = createFileRoute("/signup")({
  head: () => pageMeta("Signup", "Request a Quill seat. This form stays in the browser."),
  component: SignupPage,
});

function SignupPage() {
  const { desk, update } = useDesk();
  const [seat, setSeat] = useState<Seat>({ name: "", email: "", org: "", tier: "desk" });
  const [done, setDone] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ ...desk, seat });
    setDone(true);
  }

  return (
    <Shell>
      <PageHeader
        kicker="Signup"
        title="Ask for a seat."
        lede="The cluster creates the account. This form stores the request on this browser and does not register you."
      />
      <form onSubmit={onSubmit} className="mx-auto grid max-w-lg gap-4 px-5 py-12 sm:px-8">
        <div>
          <label htmlFor="seat-name" className="text-sm font-medium">
            Name
          </label>
          <input id="seat-name" required value={seat.name} onChange={(event) => setSeat({ ...seat, name: event.target.value })} className={field} />
        </div>
        <div>
          <label htmlFor="seat-email" className="text-sm font-medium">
            Email
          </label>
          <input id="seat-email" required type="email" value={seat.email} onChange={(event) => setSeat({ ...seat, email: event.target.value })} className={field} />
        </div>
        <div>
          <label htmlFor="seat-org" className="text-sm font-medium">
            Desk
          </label>
          <input id="seat-org" required value={seat.org} onChange={(event) => setSeat({ ...seat, org: event.target.value })} className={field} />
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Tier</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["open", "desk", "sovereign"] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                aria-pressed={seat.tier === tier}
                onClick={() => setSeat({ ...seat, tier })}
                className={`min-h-11 rounded-control px-3 text-sm capitalize ${seat.tier === tier ? "bg-ink text-paper" : "bg-chip text-ink"}`}
              >
                {tier}
              </button>
            ))}
          </div>
        </fieldset>
        <Button type="submit" size="lg" className="w-fit">
          Save request
        </Button>
        {done ? (
          <p className="text-sm text-muted" role="status">
            Saved here.{" "}
            <Link to="/dashboard" className="underline decoration-line-strong underline-offset-4">
              Open the desk
            </Link>
          </p>
        ) : null}
      </form>
    </Shell>
  );
}
