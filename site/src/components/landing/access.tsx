import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PLAN_COPY, PLANS, type PlanId } from "@/lib/plans";
import { saveWaitlistEntry } from "@/lib/waitlist";
import { cn } from "@/lib/utils";

const ROLES = [
  "Newsroom",
  "Policy and government",
  "Research",
  "Legal",
  "Builder",
  "Self-host",
] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldClass =
  "h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ink/30";

type AccessProps = {
  plan: PlanId;
  onPlan: (plan: PlanId) => void;
};

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "duplicate" }
  | { kind: "done"; email: string; plan: PlanId };

export function Access({ plan, onPlan }: AccessProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const name = String(data.get("name") ?? "").trim();
    const role = String(data.get("role") ?? "").trim();

    if (!EMAIL.test(email)) {
      setStatus({ kind: "error", message: "Enter a work email we can reply to." });
      return;
    }
    if (!role) {
      setStatus({ kind: "error", message: "Choose the desk this is for." });
      return;
    }

    const saved = saveWaitlistEntry({
      email,
      name,
      role,
      plan,
      createdAt: new Date().toISOString(),
    });

    if (!saved.ok) {
      setStatus({ kind: "duplicate" });
      return;
    }
    setStatus({ kind: "done", email, plan });
  }

  return (
    <section id="access" className="scroll-mt-24 bg-ink text-on-ink">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 md:py-28 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-on-ink-muted">Access</p>
          <h2 className="mt-3 font-display text-section">Get Quill on the desk.</h2>
          <p className="mt-4 max-w-md text-on-ink-muted">
            Tell us the tier and the work. We follow up with MCP credentials, the free-tier limits,
            and a citation you can recompute before you wire it into a client.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-on-ink-muted">
            <li>Open is 1,000 calls a month. No card.</li>
            <li>Desk is billed in CAD, card or Interac.</li>
            <li>Sovereign stays on infrastructure you control.</li>
          </ul>
        </div>

        <div className="rounded-panel bg-paper p-6 text-ink">
          {status.kind === "done" ? (
            <div role="status">
              <p className="font-display text-3xl tracking-tight">Request received.</p>
              <p className="mt-3 text-muted">
                {status.email} is on the {PLAN_COPY[status.plan].name} list. We will follow up
                with access and a sample citation.
              </p>
              <Button
                className="mt-8"
                type="button"
                variant="secondary"
                onClick={() => setStatus({ kind: "idle" })}
              >
                Use a different address
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <fieldset>
                <legend className="text-sm font-medium text-ink">Tier</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {PLANS.map((id) => (
                    <label
                      key={id}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center justify-center rounded-control border px-2 text-sm",
                        plan === id
                          ? "border-ink bg-ink text-paper"
                          : "border-line bg-surface text-ink hover:bg-chip",
                      )}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="plan"
                        value={id}
                        checked={plan === id}
                        onChange={() => onPlan(id)}
                      />
                      {PLAN_COPY[id].name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="mt-4 block text-sm font-medium" htmlFor="email">
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@newsroom.ca"
                className={cn(fieldClass, "mt-2")}
              />

              <label className="mt-4 block text-sm font-medium" htmlFor="name">
                Name <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                className={cn(fieldClass, "mt-2")}
              />

              <label className="mt-4 block text-sm font-medium" htmlFor="role">
                Desk
              </label>
              <select id="role" name="role" required defaultValue="" className={cn(fieldClass, "mt-2")}>
                <option value="" disabled>
                  Select one
                </option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              {status.kind === "error" ? (
                <p className="mt-3 text-sm text-ink" role="alert">
                  {status.message}
                </p>
              ) : null}
              {status.kind === "duplicate" ? (
                <p className="mt-3 text-sm text-ink" role="alert">
                  That address is already on the list.
                </p>
              ) : null}

              <Button className="mt-6 w-full" size="lg" type="submit">
                Request {PLAN_COPY[plan].name} access
              </Button>
              <p className="mt-3 text-xs text-muted">
                No newsletter. One reply about access. Government records stay under their original
                licence, mostly the Open Government Licence – Canada.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
