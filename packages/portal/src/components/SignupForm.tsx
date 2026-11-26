"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiBase } from "@/lib/api-base";
import { ApiKeyReveal } from "@/components/ApiKeyReveal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Provider {
  name: string;
  label: string;
}

interface AuthState {
  token: string | null;
  userId: string | null;
  method: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */


function getAuthState(): AuthState {
  if (typeof window === "undefined") return { token: null, userId: null, method: null };
  return {
    token: localStorage.getItem("maplespike_token"),
    userId: localStorage.getItem("maplespike_userId"),
    method: localStorage.getItem("maplespike_method"),
  };
}

function setAuthState(token: string, userId: string, method: string) {
  localStorage.setItem("maplespike_token", token);
  localStorage.setItem("maplespike_userId", userId);
  localStorage.setItem("maplespike_method", method);
  if (typeof window !== "undefined" && window.QuillAuth) {
    window.QuillAuth.setAuth(token, userId, method);
  }
}

function clearAuthState() {
  localStorage.removeItem("maplespike_token");
  localStorage.removeItem("maplespike_userId");
  localStorage.removeItem("maplespike_method");
  localStorage.removeItem("quill-api-key");
  localStorage.removeItem("maplespike_oidc_token");
  if (typeof window !== "undefined" && window.QuillAuth) {
    window.QuillAuth.logout();
  }
}

declare global {
  interface Window {
    MAPLESPIKE?: { apiBase?: string };
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<string[]>;
      on?: (event: string, handler: () => void) => void;
    };
    solana?: {
      connect: () => Promise<{ publicKey: { toBytes: () => Uint8Array; toBase58: () => string } }>;
      signMessage: (msg: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
      isPhantom?: boolean;
      publicKey?: { toBytes: () => Uint8Array; toBase58: () => string };
    };
    QuillAuth?: {
      getAuth: () => { token: string | null; userId: string | null; method: string | null; isAuthenticated: boolean };
      setAuth: (token: string, userId: string, method: string) => void;
      logout: () => void;
      isAuthenticated: () => boolean;
      getToken: () => string | null;
      updateNav: () => void;
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function SignupForm() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [authState, setAuth] = useState<AuthState>({ token: null, userId: null, method: null });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIdentityHelp, setShowIdentityHelp] = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [hasSolanaWallet, setHasSolanaWallet] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  useEffect(() => {
    setAuth(getAuthState());
    setWebAuthnSupported(browserSupportsWebAuthn());
    setHasWallet(typeof window !== "undefined" && !!window.ethereum);
    setHasSolanaWallet(typeof window !== "undefined" && !!(window.solana && window.solana.connect));
    loadProviders();
  }, []);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${getApiBase()}/v1/auth/oauth/providers`);
      const data = await resp.json();
      setProviders(data?.data?.providers || []);
    } catch {
      setError("Could not reach auth server");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Passkey Registration ────────────────────────────────────── */

  async function handlePasskeyRegister() {
    setBusy("passkey-register");
    setError(null);
    try {
      const base = getApiBase();
      const userId = `user_${crypto.randomUUID().slice(0, 8)}`;
      const userName = `MapleSpike User`;

      // Step 1: Begin registration
      const beginResp = await fetch(`${base}/v1/auth/passkey/register/begin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName, deviceName: navigator.userAgent.split(" ").slice(-2).join(" ") }),
      });
      const beginData = await beginResp.json();
      if (!beginData.success) throw new Error(beginData.error?.message || "Registration begin failed");

      const { options, registrationId } = beginData.data;

      // Step 2: Browser creates credential
      const credential = await startRegistration({ optionsJSON: options as unknown as Parameters<typeof startRegistration>[0]['optionsJSON'] });

      // Step 3: Complete registration
      const completeResp = await fetch(`${base}/v1/auth/passkey/register/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, credential }),
      });
      const completeData = await completeResp.json();
      if (!completeData.success) throw new Error(completeData.error?.message || "Registration failed");

      const { apiKey } = completeData.data;

      // Store API key for API calls, then block on the full key until the
      // user continues. A later account card may truncate it.
      if (apiKey?.key) {
        localStorage.setItem("quill-api-key", apiKey.key);
        setFreshKey(apiKey.key);
      }

      // Immediately log in with the passkey to get a JWT for Convex auth.
      setBusy("passkey-login");
      try {
        const loginBeginResp = await fetch(`${base}/v1/auth/passkey/login/begin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const loginBeginData = await loginBeginResp.json();
        if (!loginBeginData.success) throw new Error(loginBeginData.error?.message || "Login begin failed");

        const { options: loginOptions, loginId } = loginBeginData.data;

        // Step 2: Authenticate with the newly created passkey
        const authCredential = await startAuthentication({ optionsJSON: loginOptions as unknown as Parameters<typeof startAuthentication>[0]['optionsJSON'] });

        // Step 3: Complete login → get JWT
        const loginCompleteResp = await fetch(`${base}/v1/auth/passkey/login/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loginId, credential: authCredential }),
        });
        const loginCompleteData = await loginCompleteResp.json();
        if (!loginCompleteData.success) throw new Error(loginCompleteData.error?.message || "Login after registration failed");

        const { token } = loginCompleteData.data;
        // Store JWT as maplespike_token for ConvexProvider OIDC exchange
        setAuthState(token, userId, "passkey");
        setAuth({ token, userId, method: "passkey" });
      } catch {
        // Login after registration failed — store API key as fallback.
        // Convex features won't work until the user signs in with their passkey.
        const fallbackToken = apiKey?.key || "";
        setAuthState(fallbackToken, userId, "passkey");
        setAuth({ token: fallbackToken, userId, method: "passkey" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Passkey registration failed");
    } finally {
      setBusy(null);
    }
  }

  /* ── Passkey Login ───────────────────────────────────────────── */

  async function handlePasskeyLogin() {
    setBusy("passkey-login");
    setError(null);
    setShowIdentityHelp(false);
    // login/begin REQUIRES a userId (api-server validateBody marks it
    // required) and the UI never collects one — for a fresh visitor there is
    // no credential to assert. Fail with a clear instruction instead of a
    // server error. Passkeys are device-bound, so the instruction names the
    // second-key path (GitHub / wallet) rather than only "create another
    // passkey", which would silently fork the account (see #892).
    if (!authState.userId) {
      const lang =
        (typeof window !== "undefined" ? (window as any).__LANG : "en") === "fr"
          ? "fr"
          : "en";
      setError(
        lang === "fr"
          ? "Aucune clé d'accès n'a été trouvée sur cet appareil. Les clés d'accès sont stockées sur l'appareil qui les a créées. Si vous avez déjà un compte, connectez-vous avec GitHub ou un portefeuille pour l'utiliser ici — en créer une nouvelle commence plutôt un nouveau compte."
          : "No passkey found on this device. Passkeys are stored on the device that created them. If you already have an account, sign in with GitHub or a wallet to use it here — creating a passkey instead starts a new account."
      );
      setShowIdentityHelp(true);
      setBusy(null);
      return;
    }
    try {
      const base = getApiBase();

      const beginResp = await fetch(`${base}/v1/auth/passkey/login/begin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: authState.userId || "" }),
      });
      const beginData = await beginResp.json();
      if (!beginData.success) throw new Error(beginData.error?.message || "Login begin failed");

      const { options, loginId } = beginData.data;

      const credential = await startAuthentication({ optionsJSON: options as unknown as Parameters<typeof startAuthentication>[0]['optionsJSON'] });

      const completeResp = await fetch(`${base}/v1/auth/passkey/login/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, credential }),
      });
      const completeData = await completeResp.json();
      if (!completeData.success) throw new Error(completeData.error?.message || "Login failed");

      const { token, userId } = completeData.data;
      setAuthState(token, userId, "passkey");
      setAuth({ token, userId, method: "passkey" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Passkey login failed");
    } finally {
      setBusy(null);
    }
  }

  /* ── Web3 Wallet Login ───────────────────────────────────────── */

  async function handleWeb3Login() {
    setBusy("web3-login");
    setError(null);
    try {
      if (!window.ethereum) throw new Error("No Ethereum wallet found. Install MetaMask.");

      const base = getApiBase();

      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("No account returned from wallet");

      const chainIdHex = (await window.ethereum.request({ method: "eth_chainId" })) as unknown as string;
      // eth_chainId returns a hex STRING ("0x1"); indexing it with [0]
      // yielded "0" → parseInt("0", 16) = 0, so every nonce request sent
      // chainId 0. Parse the whole string.
      const chainId = parseInt(chainIdHex, 16);

      const challengeResp = await fetch(`${base}/v1/astral/web3/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chainId }),
      });
      const challengeData = await challengeResp.json();
      if (!challengeData || (!challengeData.nonce && !challengeData.message_template)) throw new Error(challengeData.error?.message || challengeData.error || "Challenge failed");

      const message = challengeData.message_template || challengeData.data?.message;

      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });

      const loginResp = await fetch(`${base}/v1/astral/web3/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, address }),
      });
      const loginData = await loginResp.json();
      if (!loginData || (!loginData.access_token && !loginData.token)) throw new Error(loginData.error?.message || loginData.error || "Web3 login failed");

      const token = loginData.access_token || loginData.data?.token;
      setAuthState(token, address, "web3");
      setAuth({ token, userId: address, method: "web3" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Web3 login failed");
    } finally {
      setBusy(null);
    }
  }

  /* ── Solana Wallet Login ────────────────────────────────────── */

  async function handleSolanaLogin() {
    setBusy("solana-login");
    setError(null);
    try {
      if (!window.solana) throw new Error("No Solana wallet found. Install Phantom or Backpack.");

      const base = getApiBase();
      const resp = await window.solana.connect();
      const publicKey = resp.publicKey.toBase58();

      // Request nonce
      const nonceResp = await fetch(`${base}/v1/astral/web3/solana/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey }),
      });
      const nonceData = await nonceResp.json();
      if (!nonceData.success) throw new Error(nonceData.error?.message || "Nonce request failed");
      const { message } = nonceData.data;

      // Sign with wallet
      const encoded = new TextEncoder().encode(message);
      const { signature } = await window.solana.signMessage(encoded, "utf8");

      // Convert signature to base58 (bs58@6 cjs types omit encode — cast)
      const bs58 = (await import("bs58")) as unknown as { encode: (b: Uint8Array) => string };
      const sigBase58 = bs58.encode(signature);

      // Verify
      const verifyResp = await fetch(`${base}/v1/astral/web3/solana/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, signature: sigBase58, message }),
      });
      const verifyData = await verifyResp.json();
      if (!verifyData.success) throw new Error(verifyData.error?.message || "Solana login failed");

      const apiKey = verifyData.data?.apiKey?.key || "";
      if (apiKey) {
        localStorage.setItem("quill-api-key", apiKey);
        setFreshKey(apiKey);
      }
      setAuthState(apiKey, publicKey, "solana");
      setAuth({ token: apiKey, userId: publicKey, method: "solana" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Solana login failed");
    } finally {
      setBusy(null);
    }
  }

  /* ── OAuth ───────────────────────────────────────────────────── */

  const casdoor = providers.find((p) => p.name === "casdoor");
  const others = providers.filter((p) => p.name !== "casdoor");

  /* ── Logout ──────────────────────────────────────────────────── */

  function handleLogout() {
    clearAuthState();
    setFreshKey(null);
    setAuth({ token: null, userId: null, method: null });
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */

  // The passkey flow stores the real API key separately from the session
  // JWT (authState.token). Show the API key when available — it is what
  // callers actually send as `x-api-key`; the JWT is only a session
  // credential and must be sent as `Authorization: Bearer <token>`.
  const storedApiKey = typeof window !== "undefined" ? localStorage.getItem("quill-api-key") : null;
  const shownKey = storedApiKey || authState.token;
  const isApiKey = !!storedApiKey;

  if (freshKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Save your API key</CardTitle>
          <CardDescription>This is the only time the full key is shown here.</CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeyReveal
            apiKey={freshKey}
            apiBase={getApiBase()}
            onContinue={() => setFreshKey(null)}
          />
        </CardContent>
      </Card>
    );
  }

  if (authState.token || authState.method === "passkey") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400"></span>
            Account Active
          </CardTitle>
          <CardDescription>
            {authState.method === "web3" && "Connected via Web3 wallet"}
            {authState.method === "solana" && "Connected via Solana wallet"}
            {authState.method === "passkey" && "Registered with passkey"}
            {authState.method === "oauth" && "Signed in via OAuth"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {shownKey && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-primary">{isApiKey ? "Your API Key" : "Session token"}</div>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    navigator.clipboard?.writeText(shownKey || "");
                  }}
                >
                  Copy
                </button>
              </div>
              <code className="block break-all font-mono text-sm">
                {shownKey.slice(0, 20)}...{shownKey.slice(-8)}
              </code>
              <p className="mt-2 text-xs text-muted-foreground">
                {isApiKey ? (
                  <>Use this as the <code className="font-mono">x-api-key</code> header in API calls.</>
                ) : (
                  <>Use this as the <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> header in API calls.</>
                )}
              </p>
            </div>
          )}
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">User ID</div>
            <code className="text-sm break-all">
              {authState.userId?.slice(0, 24)}
              {authState.userId && authState.userId.length > 24 && "..."}
            </code>
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Sign up</CardTitle>
        <CardDescription>
          {webAuthnSupported
            ? "Register a passkey or connect your wallet"
            : "Choose your sign-in method"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
            {showIdentityHelp && (
              <a
                href="/docs/guide/identity-model.html"
                className="mt-2 block font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Learn how account identity and device linking work
              </a>
            )}
          </div>
        )}

        {webAuthnSupported && (
          <div className="space-y-3">
            <Button
              className="w-full"
              disabled={busy !== null}
              onClick={handlePasskeyRegister}
            >
              {busy !== null ? (
                <span className="flex items-center gap-2">
                  <Spinner /> {busy === "passkey-register" ? "Creating passkey..." : "Completing setup..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <FingerprintIcon /> Create passkey
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              disabled={busy !== null}
              onClick={handlePasskeyLogin}
            >
              {busy === "passkey-login" ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Authenticating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <FingerprintIcon /> Sign in with passkey
                </span>
              )}
            </Button>
          </div>
        )}

        {(webAuthnSupported || hasWallet) && providers.length > 0 && (
          <div className="flex items-center gap-3 py-4">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
        )}

        {(hasWallet || hasSolanaWallet) && (
          <div className="space-y-3">
            {hasWallet && (
              <Button
                variant="outline"
                className="w-full"
                disabled={busy !== null}
                onClick={handleWeb3Login}
              >
                {busy === "web3-login" ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> Connect wallet...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <WalletIcon /> Connect Web3 wallet
                  </span>
                )}
              </Button>
            )}
            {hasSolanaWallet && (
              <Button
                variant="outline"
                className="w-full"
                disabled={busy !== null}
                onClick={handleSolanaLogin}
              >
                {busy === "solana-login" ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> Connecting Solana wallet...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <SolanaIcon /> Connect Solana wallet
                  </span>
                )}
              </Button>
            )}
          </div>
        )}

        {!loading && providers.length > 0 && (
          <>
            {(webAuthnSupported || hasWallet || hasSolanaWallet) && (
              <div className="flex items-center gap-3 py-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>
            )}
            <div className="space-y-2">
              {casdoor && (
                <ProviderButton provider={casdoor} base={getApiBase()} />
              )}
              {casdoor && others.length > 0 && (
                <div className="py-1 text-center text-xs text-muted-foreground">
                  Social sign-in
                </div>
              )}
              {others.map((p) => (
                <ProviderButton key={p.name} provider={p} base={getApiBase()} />
              ))}
            </div>
          </>
        )}

        {loading && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading sign-in options...
          </div>
        )}
        {!loading && !error && providers.length === 0 && !webAuthnSupported && !hasWallet && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No sign-in providers configured. Contact the administrator.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ProviderButton({ provider, base }: { provider: Provider; base: string }) {
  const icons: Record<string, string> = {
    casdoor: "🔑",
    github: "🐙",
    google: "G",
    microsoft: "M",
  };
  const icon = icons[provider.name] || "→";

  return (
    <a
      href={`${base}/v1/auth/oauth/${provider.name}`}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span className="text-base">{icon}</span>
      <span>Continue with {provider.label}</span>
    </a>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function FingerprintIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M8.65 22c.21-.66.45-1.32.57-2" />
      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function SolanaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h16" />
      <path d="M4 12h16" />
      <path d="M4 16h16" />
      <path d="M6 3l-3 3 3 3" />
      <path d="M18 18l3-3-3-3" />
    </svg>
  );
}
