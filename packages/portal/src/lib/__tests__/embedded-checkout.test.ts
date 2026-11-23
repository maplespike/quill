import { describe, expect, test, vi } from "vitest";
import {
  API_KEY_STORAGE,
  SESSION_TOKEN_STORAGE,
  createEmbeddedSession,
  keyLookUsable,
  publishableKey,
  resolveCredential,
  resolvePublishableKey,
  runtimePublishableKey,
  PUBLISHABLE_KEY_ENV,
} from "../embedded-checkout";

describe("publishableKey", () => {
  test("reads and trims the build-time value", () => {
    expect(publishableKey({ [PUBLISHABLE_KEY_ENV]: "  pk_live_abc  " })).toBe("pk_live_abc");
  });
  test("returns empty string when the build did not set it", () => {
    expect(publishableKey({})).toBe("");
    expect(publishableKey({ [PUBLISHABLE_KEY_ENV]: undefined })).toBe("");
  });
});

describe("keyLookUsable", () => {
  test("accepts live and test publishable keys", () => {
    expect(keyLookUsable("pk_live_51ABC").ok).toBe(true);
    expect(keyLookUsable("pk_test_51ABC").ok).toBe(true);
  });
  test("rejects a missing key with an actionable reason", () => {
    const r = keyLookUsable("");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("PUBLIC_STRIPE_PUBLISHABLE_KEY");
  });
  test("rejects a secret key pasted by mistake — it must never reach the browser", () => {
    const r = keyLookUsable("sk_live_51ABC");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("publishable");
  });
});

describe("createEmbeddedSession", () => {
  const okJson = { success: true, data: { client_secret: "cs_live_secret_123" } };

  test("posts embedded:true with the tenant bearer key and returns the secret", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(okJson), { status: 200 }));
    const r = await createEmbeddedSession({
      apiBase: "https://api.maplespike.ca",
      apiKey: "qk_tenant",
      planId: "pro",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r).toEqual({ ok: true, clientSecret: "cs_live_secret_123" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(init).toBeDefined();
    expect(url).toBe("https://api.maplespike.ca/v1/billing/stripe/checkout");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer qk_tenant");
    expect(JSON.parse(init!.body as string)).toEqual({ plan_id: "pro", embedded: true });
  });

  test("strips a trailing slash so the path is not doubled", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(okJson), { status: 200 }));
    await createEmbeddedSession({ apiBase: "https://api.maplespike.ca/", apiKey: "k", planId: "pro", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.maplespike.ca/v1/billing/stripe/checkout");
  });

  test("surfaces the api error message when billing is not configured", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: false, error: { message: "Stripe is not configured" } }), { status: 503 }));
    const r = await createEmbeddedSession({ apiBase: "https://api.maplespike.ca", apiKey: "k", planId: "pro", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Stripe is not configured");
  });

  test("fails loudly when the api returns no client_secret", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }));
    const r = await createEmbeddedSession({ apiBase: "https://api.maplespike.ca", apiKey: "k", planId: "pro", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("client_secret");
  });

  test("reports a network failure instead of throwing", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("ECONNREFUSED"); });
    const r = await createEmbeddedSession({ apiBase: "https://api.maplespike.ca", apiKey: "k", planId: "pro", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("ECONNREFUSED");
  });
});

describe("resolveCredential", () => {
  const storage = (entries: Record<string, string>) => ({
    getItem: (k: string) => entries[k] ?? null,
  });

  test("reads the key signup and the workspace already store", () => {
    expect(resolveCredential({ storage: storage({ [API_KEY_STORAGE]: " quill_live_key " }) })).toBe("quill_live_key");
  });

  test("falls back to the session JWT for an OAuth sign-in", () => {
    expect(resolveCredential({ storage: storage({ [SESSION_TOKEN_STORAGE]: "aaa.bbb.ccc" }) })).toBe("aaa.bbb.ccc");
  });

  test("prefers an explicitly injected config key over storage", () => {
    expect(
      resolveCredential({
        runtimeWindow: { MAPLESPIKE: { apiKey: "quill_injected" } },
        storage: storage({ [API_KEY_STORAGE]: "quill_stored" }),
      }),
    ).toBe("quill_injected");
  });

  test("ignores the empty prod default instead of treating it as a credential", () => {
    expect(
      resolveCredential({
        runtimeWindow: { MAPLESPIKE: { apiKey: "  " } },
        storage: storage({ [API_KEY_STORAGE]: "quill_stored" }),
      }),
    ).toBe("quill_stored");
  });

  test("is empty for a visitor with nothing stored, and survives a throwing Storage", () => {
    expect(resolveCredential({})).toBe("");
    expect(resolveCredential({ storage: storage({}) })).toBe("");
    expect(
      resolveCredential({
        storage: {
          getItem: () => {
            throw new Error("SecurityError: storage disabled");
          },
        },
      }),
    ).toBe("");
  });
});

describe("runtimePublishableKey", () => {
  test("reads the key the server injected into /config.js", () => {
    expect(runtimePublishableKey({ MAPLESPIKE: { stripePublishableKey: " pk_live_rt " } })).toBe("pk_live_rt");
  });
  test("is empty when the page has no runtime config", () => {
    expect(runtimePublishableKey(undefined)).toBe("");
    expect(runtimePublishableKey({})).toBe("");
    expect(runtimePublishableKey({ MAPLESPIKE: {} })).toBe("");
  });
});

describe("resolvePublishableKey", () => {
  test("prefers the runtime value over the build-time value", () => {
    expect(
      resolvePublishableKey({
        buildEnv: { [PUBLISHABLE_KEY_ENV]: "pk_live_build" },
        runtimeWindow: { MAPLESPIKE: { stripePublishableKey: "pk_live_runtime" } },
      }),
    ).toBe("pk_live_runtime");
  });
  test("falls back to the build-time value when runtime is absent or blank", () => {
    const buildEnv = { [PUBLISHABLE_KEY_ENV]: "pk_live_build" };
    expect(resolvePublishableKey({ buildEnv })).toBe("pk_live_build");
    expect(resolvePublishableKey({ buildEnv, runtimeWindow: { MAPLESPIKE: { stripePublishableKey: "   " } } })).toBe(
      "pk_live_build",
    );
  });
  test("returns empty when neither source is configured", () => {
    expect(resolvePublishableKey({})).toBe("");
    expect(resolvePublishableKey({ runtimeWindow: {} })).toBe("");
  });
});
