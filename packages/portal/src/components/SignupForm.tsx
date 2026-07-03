"use client";

import { useState, useEffect, useCallback } from "react";
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

function getApiBase(): string {
  if (typeof window !== "undefined") {
    if (window.MAPLESPIKE?.apiBase) {
      return window.MAPLESPIKE.apiBase;
    }
    const host = window.location.hostname;
    const parts = host.split(".");
    let baseDomain;
    if (parts.length > 2 && ["api", "portal", "www", "mcp", "dev", "data"].includes(parts[0])) {
      baseDomain = parts.slice(1).join(".");
    } else {
      baseDomain = host;
    }
    return `${window.location.protocol}//api.${baseDomain}`;
  }
  return "https://api.maplespike.ca";
}

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
  if (typeof window !== "undefined" && window.MapleSpikeAuth) {
    window.MapleSpikeAuth.setAuth(token, userId, method);
  }
}

function clearAuthState() {
  localStorage.removeItem("maplespike_token");
  localStorage.removeItem("maplespike_userId");
  localStorage.removeItem("maplespike_method");
  localStorage.removeItem("maplespike-api-key");
  localStorage.removeItem("maplespike_oidc_token");
  if (typeof window !== "undefined" && window.MapleSpikeAuth) {
    window.MapleSpikeAuth.logout();
  }
}

declare global {
  interface Window {
    MAPLESPIKE?: { apiBase?: string };
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<string[]>;
      on?: (event: string, handler: () => void) => void;
    };
    MapleSpikeAuth?: {
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
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    setAuth(getAuthState());
    setWebAuthnSupported(browserSupportsWebAuthn());
    setHasWallet(typeof window !== "undefined" && !!window.ethereum);
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
      const credential = await startRegistration({ optionsJSON: options as PublicKeyCredentialCreationJSON });

      // Step 3: Complete registration
      const completeResp = await fetch(`${base}/v1/auth/passkey/register/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, credential }),
      });
      const completeData = await completeResp.json();
      if (!completeData.success) throw new Error(completeData.error?.message || "Registration failed");

      const { apiKey } = completeData.data;

      // Store API key for API calls
      if (apiKey?.key) {
        localStorage.setItem("maplespike-api-key", apiKey.key);
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
        const authCredential = await startAuthentication({ optionsJSON: loginOptions as PublicKeyCredentialRequestJSON });

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

      const credential = await startAuthentication({ optionsJSON: options as PublicKeyCredentialRequestJSON });

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

      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts[0];
      if (!address) throw new Error("No account returned from wallet");

      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      const chainId = parseInt(chainIdHex, 16);

      const challengeResp = await fetch(`${base}/v1/auth/web3/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chainId }),
      });
      const challengeData = await challengeResp.json();
      if (!challengeData.success) throw new Error(challengeData.error?.message || "Challenge failed");

      const { message } = challengeData.data;

      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });

      const loginResp = await fetch(`${base}/v1/auth/web3/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, address }),
      });
      const loginData = await loginResp.json();
      if (!loginData.success) throw new Error(loginData.error?.message || "Web3 login failed");

      const { token } = loginData.data;
      setAuthState(token, address, "web3");
      setAuth({ token, userId: address, method: "web3" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Web3 login failed");
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
    setAuth({ token: null, userId: null, method: null });
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */

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
            {authState.method === "passkey" && "Registered with passkey"}
            {authState.method === "oauth" && "Signed in via OAuth"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {authState.token && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-primary">Your API Key</div>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    navigator.clipboard?.writeText(authState.token || "");
                  }}
                >
                  Copy
                </button>
              </div>
              <code className="block break-all font-mono text-sm">
                {authState.token.slice(0, 20)}...{authState.token.slice(-8)}
              </code>
              <p className="mt-2 text-xs text-muted-foreground">
                Use this as the <code className="font-mono">x-api-key</code> header in API calls.
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

        {hasWallet && (
          <div className="space-y-3">
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
          </div>
        )}

        {!loading && providers.length > 0 && (
          <>
            {(webAuthnSupported || hasWallet) && (
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
