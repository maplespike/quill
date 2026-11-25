import { useEffect, useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { resolveCredential } from "@/lib/embedded-checkout";

interface CheckoutSuccessPollerProps {
  /** Optional; resolved from ?order= / sessionStorage in the browser when empty. */
  orderId?: string;
  apiBase?: string;
  apiKey?: string;
  /** Polling interval in ms (default 1500). */
  pollMs?: number;
  /** Max polls before giving up (default 30 ≈ 45s). */
  maxPolls?: number;
}

interface OrderStatusData {
  order_id: string;
  plan_id: string;
  status: "pending" | "paid" | "expired" | "cancelled" | "fulfilled";
  amount_cents: number;
  currency: string;
  stripe_subscription_id?: string | null;
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
  // Same resolution as EmbeddedCheckout (lib/embedded-checkout.ts): injected
  // window.MAPLESPIKE.apiKey first (empty in every shipped config), then the
  // credential the session actually stored — `quill-api-key` (signup /
  // workspace) or the `maplespike_token` JWT.
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  return resolveCredential({ runtimeWindow: window, storage }) || null;
}

const PLAN_LABEL: Record<string, { en: string; fr: string }> = {
  free: { en: "Free", fr: "Gratuit" },
  pro: { en: "Pro", fr: "Pro" },
  business: { en: "Business", fr: "Business" },
};

/**
 * Polls /v1/billing/stripe/order/:id every 1.5s until status is paid / fulfilled /
 * cancelled / expired. Used by /dashboard/checkout-success.astro to confirm to
 * the user that Stripe's webhook settled and their tier upgraded. Silent on
 * pending so the UI doesn't flicker.
 *
 * pollsRef (mutable) drives the maxPolls guard; polls state mirrors it for the
 * progress bar. Reading state.polls from inside a closure with state deps
 * excluded is the classic React trap that would make maxPolls effectively
 * infinite.
 */
/**
 * The portal is a static build, so the page can't read ?order= at render
 * time. Resolve it in the browser: the explicit prop, then the ?order= Stripe
 * returns with, then the id StripeCheckoutButton stashed in sessionStorage.
 */
export function resolveOrderId(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof window === "undefined") return "";
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("order");
    if (fromUrl && /^[A-Za-z0-9_-]{1,64}$/.test(fromUrl)) return fromUrl;
  } catch {
    /* malformed URL */
  }
  try {
    return window.sessionStorage.getItem("last_stripe_order_id") ?? "";
  } catch {
    return "";
  }
}

export default function CheckoutSuccessPoller({
  orderId: orderIdProp,
  apiBase,
  apiKey,
  pollMs = 1500,
  maxPolls = 30,
}: CheckoutSuccessPollerProps) {
  const [status, setStatus] = useState<OrderStatusData["status"] | "loading" | "error">("loading");
  const [data, setData] = useState<OrderStatusData | null>(null);
  const pollsRef = useRef(0);
  const [polls, setPolls] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const lang = (typeof window !== "undefined" ? (window as any).__LANG : "en") === "fr" ? "fr" : "en";
  const [orderId, setOrderId] = useState(orderIdProp ?? "");
  const [orderResolved, setOrderResolved] = useState(Boolean(orderIdProp));
  useEffect(() => {
    if (!orderResolved) {
      setOrderId(resolveOrderId(orderIdProp));
      setOrderResolved(true);
    }
  }, [orderIdProp, orderResolved]);

  useEffect(() => {
    if (!orderResolved) return;
    if (!orderId) {
      setStatus("error");
      setError(lang === "fr" ? "ID de commande manquant." : "Missing order id.");
      return;
    }
    const key = resolveApiKey(apiKey);
    if (!key) {
      setStatus("error");
      setError(
        lang === "fr"
          ? "Clé API manquante. Reconnectez-vous pour vérifier le statut."
          : "API key missing. Sign in again to check status.",
      );
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `${getApiBase(apiBase)}/billing/stripe/order/${encodeURIComponent(orderId)}`,
          {
            headers: { Authorization: `Bearer ${key}` },
          },
        );
        const body = (await res.json()) as ApiEnvelope<OrderStatusData>;
        if (cancelled) return;
        if (!body.success || !body.data) {
          setStatus("error");
          setError(body.error?.message ?? (lang === "fr" ? "Échec de la vérification." : "Status check failed."));
          return;
        }
        setData(body.data);
        pollsRef.current += 1;
        setPolls(pollsRef.current);
        if (body.data.status === "pending") {
          // Read against the ref, not the closure capture of `polls`
          // (state setters don't re-run this callback, and excluding `polls`
          // from deps would mean stale value forever).
          if (pollsRef.current >= maxPolls) {
            setStatus("error");
            setError(
              lang === "fr"
                ? "Le webhook Stripe n'a pas encore mis à jour le statut. Actualisez dans quelques secondes."
                : "Stripe webhook hasn't settled yet. Refresh in a few seconds.",
            );
            return;
          }
          setTimeout(tick, pollMs);
        } else {
          setStatus(body.data.status);
        }
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError((e as Error).message);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
    // apiKey resolution happens once per mount; maxPolls and apiBase are
    // externally stable for any given checkout-success session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, orderResolved, apiBase, apiKey, pollMs, maxPolls]);

  if (status === "loading" || (status === "pending" && polls < maxPolls)) {
    return (
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>
            {lang === "fr" ? "Vérification du paiement…" : "Verifying payment…"}
          </CardTitle>
          <CardDescription>
            {lang === "fr"
              ? "Nous attendons que Stripe confirme votre paiement. Cela prend généralement moins de 5 secondes."
              : "Waiting for Stripe to confirm your payment. This usually takes under 5 seconds."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={lang === "fr" ? "Vérification du paiement" : "Payment verification"}
          >
            <div
              className={cn(
                "h-full bg-[var(--maple)] transition-[width] duration-700 ease-out",
                polls > 0 ? "w-2/3" : "w-1/3",
              )}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === "paid" || status === "fulfilled") {
    const planName = PLAN_LABEL[data?.plan_id ?? "pro"]?.[lang] ?? data?.plan_id ?? "—";
    return (
      <Card className="card-hover border-primary/40 ring-1 ring-primary/30 shadow-lg shadow-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {lang === "fr" ? `Bienvenue dans ${planName} !` : `Welcome to ${planName}!`}
            </CardTitle>
            <Badge variant="default" className="btn-sheen">
              {lang === "fr" ? "Activé" : "Active"}
            </Badge>
          </div>
          <CardDescription>
            {lang === "fr"
              ? "Votre abonnement est actif. Les limites de débit et les crédits sont déjà mis à jour."
              : "Your subscription is active. Rate limits and credits are already updated."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild className="press-feedback transition-transform duration-200 ease-out">
            <a href="/dashboard/billing">{lang === "fr" ? "Voir la facturation" : "View billing"}</a>
          </Button>
          <Button variant="outline" asChild className="press-feedback transition-transform duration-200 ease-out">
            <a href="/dashboard">{lang === "fr" ? "Aller au tableau de bord" : "Go to dashboard"}</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "cancelled" || status === "expired") {
    return (
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>{lang === "fr" ? "Paiement non abouti" : "Payment didn't complete"}</CardTitle>
          <CardDescription>
            {status === "expired"
              ? lang === "fr"
                ? "La session de paiement a expiré. Réessayez."
                : "The checkout session expired. Please try again."
              : lang === "fr"
                ? "Le paiement a été annulé. Réessayez quand vous êtes prêt."
                : "Payment was cancelled. Try again whenever you're ready."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="press-feedback transition-transform duration-200 ease-out">
            <a href="/pricing">{lang === "fr" ? "Voir les forfaits" : "See plans"}</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle>{lang === "fr" ? "Impossible de vérifier le statut" : "Couldn't verify status"}</CardTitle>
        <CardDescription className="text-red-500 dark:text-red-400">{error}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" asChild className="press-feedback transition-transform duration-200 ease-out">
          <a href="/dashboard/billing">{lang === "fr" ? "Voir la facturation" : "View billing"}</a>
        </Button>
        <Button variant="ghost" asChild className="press-feedback transition-transform duration-200 ease-out">
          <a href="/dashboard">{lang === "fr" ? "Tableau de bord" : "Dashboard"}</a>
        </Button>
      </CardContent>
    </Card>
  );
}
