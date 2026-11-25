/**
 * Embedded Checkout island — Stripe's payment form inside quill.maplespike.ca,
 * instead of a redirect to checkout.stripe.com.
 *
 * Falls back to a clear operator message when the build lacks the publishable
 * key, so a misconfigured build is legible rather than a blank box.
 */
import { useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout as StripeEmbeddedCheckout } from "@stripe/react-stripe-js";
import {
  createEmbeddedSession,
  keyLookUsable,
  resolveCredential,
  resolvePublishableKey,
} from "../lib/embedded-checkout";
import { deriveApiBase } from "../lib/api-base";

const env: Record<string, unknown> =
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, unknown> }).env) || {};

export default function EmbeddedCheckoutIsland({ planId = "pro" }: { planId?: string }) {
  // Runtime (/config.js injection) first, build-time env second.
  const key = resolvePublishableKey({
    buildEnv: env,
    runtimeWindow: typeof window !== "undefined" ? window : undefined,
  });
  const usability = keyLookUsable(key);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stripePromise = useRef<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    if (!usability.ok) return;
    // Runtime config first (a deployment may inject one), then the credential
    // the session already stored: `quill-api-key` from signup/workspace, or the
    // `maplespike_token` JWT. Reading only the config global is what made a
    // signed-in visitor see "sign in first" — see resolveCredential.
    const apiKey = resolveCredential({
      runtimeWindow: window,
      storage: window.localStorage,
    });
    if (!apiKey) {
      setError("Sign in first, or save an API key in the workspace — checkout needs one.");
      return;
    }
    let cancelled = false;
    stripePromise.current = loadStripe(key).catch((cause: Error) => {
      if (!cancelled) setError(`Payment form could not load: ${cause.message}`);
      return null;
    });
    createEmbeddedSession({ apiBase: deriveApiBase(window.location), apiKey, planId })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setClientSecret(r.clientSecret);
        else setError(r.error);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [planId, key, usability.ok]);

  if (!usability.ok) {
    return (
      <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Checkout is not configured for this build.</strong>
        <div className="mt-1 opacity-80">{usability.reason}</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        <strong>Checkout could not start.</strong>
        <div className="mt-1 opacity-80">{error}</div>
      </div>
    );
  }
  if (!clientSecret) {
    return <div className="p-4 text-sm opacity-70">Preparing secure checkout…</div>;
  }
  return (
    <div id="embedded-checkout">
      <EmbeddedCheckoutProvider stripe={stripePromise.current} options={{ clientSecret }}>
        <StripeEmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
