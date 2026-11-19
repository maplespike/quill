import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StripeCheckoutButtonProps {
  planId: "pro" | "business";
  className?: string;
  /** Route locale, shared by server render and client hydration. */
  lang?: "en" | "fr";
  /** Override the public API base (otherwise derived from window.location). */
  apiBase?: string;
  /**
   * Optional pre-set API key. ONLY acceptable as a prop or via
   * window.MAPLESPIKE.apiKey. We deliberately do NOT read from localStorage
   * — a single XSS on the portal would expose the raw bearer (this is the
   * exact bug GitHub shipped for years before moving to sessionStorage /
   * httpOnly cookies). Auth must complete before the button can fire.
   */
  apiKey?: string;
  /**
   * Bilingual UI label override. Falls back to per-plan EN/FR copy if absent.
   * Either a plain string (used in both languages) or an {en, fr} pair.
   */
  label?: string | { en: string; fr: string };
  /**
   * Where to send users who haven't signed in yet (no API key in scope).
   * Default: `/signup?plan={planId}&return=/pricing`. Use this when the
   * button is rendered somewhere other than /pricing.
   */
  notSignedInHref?: string;
}

interface CheckoutResponseData {
  order_id: string;
  plan_id: string;
  checkout_url: string;
  stripe_checkout_session_id: string;
  expires_at: number;
  amount_cents: number;
  currency: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

function getApiBase(override?: string): string {
  if (override) return override.replace(/\/$/, "") + "/v1";
  if (typeof window === "undefined") return "";
  const fromGlobal = (window as any).MAPLESPIKE?.apiBase as string | undefined;
  if (fromGlobal) return fromGlobal.replace(/\/$/, "") + "/v1";
  const host = window.location.hostname;
  const parts = host.split(".");
  const base =
    parts.length > 2 &&
    ["api", "portal", "www", "mcp", "dev", "data", "quill"].includes(parts[0])
      ? parts.slice(1).join(".")
      : host;
  return `${window.location.protocol}//api.${base}/v1`;
}

function resolveApiKey(overridden?: string): string | null {
  if (overridden) return overridden;
  if (typeof window === "undefined") return null;
  // window.MAPLESPIKE is set by /auth.js after OAuth exchange; this is the
  // ONLY client-side source for the bearer. localStorage is NOT safe.
  const g = (window as any).MAPLESPIKE?.apiKey as string | undefined;
  return g ?? null;
}

const COPY: Record<
  "pro" | "business",
  { default: Record<"en" | "fr", string>; busy: Record<"en" | "fr", string> }
> = {
  pro: {
    default: { en: "Buy Pro", fr: "Acheter Pro" },
    busy: { en: "Opening Stripe…", fr: "Ouverture de Stripe…" },
  },
  business: {
    default: { en: "Buy Business", fr: "Acheter Business" },
    busy: { en: "Opening Stripe…", fr: "Ouverture de Stripe…" },
  },
};

/**
 * Buy-Pro / Buy-Business island — drops into static .astro pages next to the
 * non-Stripe CTAs. Reads the user's API key from `window.MAPLESPIKE.apiKey`
 * (set by auth.js post-OAuth-exchange); surfaces a redirect-to-signup if the
 * key is missing.
 *
 * On success: redirects to `checkout_url` and the user lands on Stripe's
 * hosted checkout. Returning to /dashboard triggers the `checkout=success`
 * banner, which polls /v1/billing/stripe/order/:id until paid.
 */
export default function StripeCheckoutButton({
  planId,
  className,
  apiBase,
  apiKey,
  label,
  notSignedInHref,
  lang = "en",
}: StripeCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[planId];

  function resolveLabel(): string {
    if (typeof label === "string") return label;
    if (label && typeof label === "object") return label[lang] ?? copy.default[lang];
    return copy.default[lang];
  }

  async function handleClick() {
    setError(null);
    const key = resolveApiKey(apiKey);
    if (!key) {
      // Send users without an active session to /signup first; we don't
      // expose localStorage fallback because that would defeat the whole
      // "no XSS exfil" goal. The /signup page must complete OAuth/passkey
      // exchange before returning.
      const prefix = lang === "fr" ? "/fr" : "";
      const fallbackHref = notSignedInHref ?? `${prefix}/signup?plan=${planId}&return=${prefix}/pricing`;
      window.location.href = fallbackHref;
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBase(apiBase)}/billing/stripe/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ plan_id: planId, locale: lang }),
      });
      const body = (await res.json()) as ApiEnvelope<CheckoutResponseData>;
      if (!body.success || !body.data) {
        const code = body.error?.code ?? "CHECKOUT_FAILED";
        const msg =
          code === "STRIPE_NOT_CONFIGURED"
            ? lang === "fr"
              ? "Stripe n'est pas encore activé sur ce serveur."
              : "Stripe is not yet configured on this server."
            : code === "INVALID_PLAN"
              ? lang === "fr"
                ? "Plan non valide."
                : "Invalid plan."
              : code === "UNAUTHORIZED"
                ? lang === "fr"
                  ? "Clé API invalide. Régénérez-la dans le tableau de bord après vous être reconnecté."
                  : "Invalid API key. Re-authenticate and regenerate in the dashboard."
                : body.error?.message ?? (lang === "fr" ? "Échec du paiement." : "Checkout failed.");
        setError(msg);
        setIsLoading(false);
        return;
      }
      // Persist the order id so the success page can poll without re-deriving
      // it. sessionStorage auto-clears on tab close \u2014 better than localStorage.
      try {
        window.sessionStorage.setItem("last_stripe_order_id", body.data.order_id);
        window.sessionStorage.setItem("last_stripe_plan_id", body.data.plan_id);
      } catch {
        /* session storage may be disabled; non-fatal */
      }
      window.location.href = body.data.checkout_url;
    } catch (e) {
      setError(
        lang === "fr"
          ? `Erreur réseau : ${(e as Error).message}`
          : `Network error: ${(e as Error).message}`,
      );
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "w-full btn-sheen press-feedback transition-transform duration-200 ease-out",
          isLoading && "opacity-80",
        )}
      >
        {isLoading ? copy.busy[lang] : resolveLabel()}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-500 dark:text-red-400" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
