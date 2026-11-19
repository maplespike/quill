/**
 * Embedded Checkout helpers.
 *
 * Stripe's Embedded Checkout mounts the real payment form inside our page, so it
 * needs the PUBLISHABLE key in the browser (safe by design — it ships in the
 * client bundle) plus a client_secret minted by our own api for the tenant.
 *
 * Deliberately free of React and of any top-level Stripe import so the rules
 * below are unit-testable.
 */

export const PUBLISHABLE_KEY_ENV = "PUBLIC_STRIPE_PUBLISHABLE_KEY";

const KEY_PREFIXES = ["pk_live_", "pk_test_"] as const;

/** Read the build-time publishable key. Empty string means "not configured". */
export function publishableKey(env: Record<string, unknown> = {}): string {
  const raw = (env[PUBLISHABLE_KEY_ENV] ?? "") as string;
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Guard: is the key present AND shaped like a Stripe publishable key?
 * A wrong key makes Stripe.js fail at mount with an opaque error, so we check
 * the shape up front and show the operator a message they can act on.
 */
export function keyLookUsable(key: string): { ok: boolean; reason?: string } {
  const k = (key ?? "").trim();
  if (!k) return { ok: false, reason: "PUBLIC_STRIPE_PUBLISHABLE_KEY is not set for this build" };
  if (!KEY_PREFIXES.some((p) => k.startsWith(p))) {
    return { ok: false, reason: "PUBLIC_STRIPE_PUBLISHABLE_KEY does not look like a Stripe publishable key" };
  }
  return { ok: true };
}

export type EmbeddedSessionResult =
  | { ok: true; clientSecret: string }
  | { ok: false; error: string; status?: number };

/**
 * Ask our api for an embedded Checkout session. The tenant bearer key travels
 * in the Authorization header exactly as the hosted flow does — we never read a
 * key from localStorage here.
 */
export async function createEmbeddedSession(args: {
  apiBase: string;
  apiKey: string;
  planId: string;
  locale?: "en" | "fr";
  fetchImpl?: typeof fetch;
}): Promise<EmbeddedSessionResult> {
  const doFetch = args.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${args.apiBase.replace(/\/$/, "")}/v1/billing/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.apiKey}` },
      body: JSON.stringify({
        plan_id: args.planId,
        embedded: true,
        ...(args.locale ? { locale: args.locale } : {}),
      }),
    });
  } catch (e) {
    return { ok: false, error: `Could not reach billing (${(e as Error).message})` };
  }

  let body: { success?: boolean; data?: { client_secret?: string }; error?: { message?: string } };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { ok: false, error: `Billing returned a non-JSON response (HTTP ${res.status})`, status: res.status };
  }

  if (!res.ok || body.success === false) {
    return { ok: false, error: body.error?.message ?? `Billing rejected the request (HTTP ${res.status})`, status: res.status };
  }
  const secret = body.data?.client_secret;
  if (!secret) {
    return { ok: false, error: "Billing did not return a client_secret for embedded checkout." };
  }
  return { ok: true, clientSecret: secret };
}
