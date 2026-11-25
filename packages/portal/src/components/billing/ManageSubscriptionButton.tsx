import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveCredential } from "@/lib/embedded-checkout";

interface ManageSubscriptionButtonProps {
  /** Override the public API base. */
  apiBase?: string;
  /** Pre-set API key; falls back to window.MAPLESPIKE.apiKey / localStorage. */
  apiKey?: string;
  className?: string;
  label?: { en: string; fr: string };
  variant?: "default" | "outline" | "ghost";
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

/**
 * Opens Stripe Customer Portal in a new tab. Requires bearer auth (user must
 * have subscribed previously so a Stripe customer exists for the tenant).
 */
export default function ManageSubscriptionButton({
  apiBase,
  apiKey,
  className,
  label,
  variant = "default",
}: ManageSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lang = (typeof window !== "undefined" ? (window as any).__LANG : "en") === "fr" ? "fr" : "en";
  const copy = label ?? {
    en: "Manage subscription",
    fr: "Gérer l'abonnement",
  };

  async function handleClick() {
    setError(null);
    const key = resolveApiKey(apiKey);
    if (!key) {
      setError(
        lang === "fr"
          ? "Clé API requise. Connectez-vous ou créez une clé dans le tableau de bord."
          : "API key required. Sign in or generate one in the dashboard.",
      );
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBase(apiBase)}/billing/stripe/portal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
      });
      const body = (await res.json()) as ApiEnvelope<{ portal_url: string; expires_in_seconds: number }>;
      if (!body.success || !body.data) {
        const code = body.error?.code ?? "PORTAL_FAILED";
        const msg =
          code === "NO_STRIPE_CUSTOMER"
            ? lang === "fr"
              ? "Aucun abonnement actif. Souscrivez d'abord à un plan payant."
              : "No active subscription. Subscribe to a paid plan first."
            : code === "UNAUTHORIZED"
              ? lang === "fr"
                ? "Clé API invalide."
                : "Invalid API key."
              : body.error?.message ?? (lang === "fr" ? "Échec du portail." : "Portal failed.");
        setError(msg);
        setIsLoading(false);
        return;
      }
      window.location.href = body.data.portal_url;
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
        variant={variant}
        onClick={handleClick}
        disabled={isLoading}
        className={cn("press-feedback transition-transform duration-200 ease-out", isLoading && "opacity-80")}
      >
        {isLoading
          ? lang === "fr"
            ? "Ouverture…"
            : "Opening…"
          : copy[lang]}
      </Button>
      {error && (
        <p
          role="alert"
          className="text-xs text-red-500 dark:text-red-400"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}
