"use client";

import { ReactNode, useMemo, useEffect } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

/**
 * Token bridge: Astral Key HMAC token → Convex OIDC token.
 *
 * Astral Key issues HMAC (HS256) tokens for API auth.
 * Convex requires RS256 OIDC tokens with `aud` claim.
 *
 * Auth methods supported:
 * - Web3 (SIWE): JWT stored in localStorage → exchanged for OIDC
 * - Passkey login: JWT stored in localStorage → exchanged for OIDC
 * - Passkey register: API key → second passkey prompt → JWT → OIDC
 * - OAuth (GitHub/Google): JWT in `session` cookie → exchanged for OIDC
 *
 * Uses Convex v1.42.1 API: `client.setAuth(fetchToken)`.
 */
async function exchangeTokenForOidc(
  hmacToken: string,
): Promise<string | null> {
  try {
    const base = getAstralKeyBase();
    const url = `${base}/oidc/token?client_id=convex`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${hmacToken}`,
      },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.access_token || data.id_token || null;
  } catch {
    return null;
  }
}

function getAstralKeyBase(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const parts = host.split(".");
    const base =
      parts.length > 2 && ["api", "portal", "www", "dev"].includes(parts[0])
        ? parts.slice(1).join(".")
        : host;
    return `${window.location.protocol}//auth.${base}`;
  }
  return "https://auth.maplespike.lan";
}

/** Get the best available token from localStorage */
function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;

  // 1. localStorage token (Web3, passkey login)
  const localToken = localStorage.getItem("maplespike_token");
  if (localToken) return localToken;

  // 2. API key (passkey register without login chain, or workspace page)
  //    API keys start with "mp_" — these can't be exchanged for OIDC,
  //    but we return them so Convex can try (it will fail gracefully).
  const apiKey = localStorage.getItem("maplespike-api-key");
  if (apiKey) return apiKey;

  return null;
}

interface Props {
  children: ReactNode;
  convexUrl?: string;
}

export default function MapleSpikeConvexProvider({
  children,
  convexUrl = "https://convex.maplespike.lan",
}: Props) {
  const client = useMemo(() => new ConvexReactClient(convexUrl), [convexUrl]);

  useEffect(() => {
    client.setAuth(async (): Promise<string | null> => {
      const storedToken = getStoredToken();
      if (!storedToken) return null;

      // If it's an API key (starts with mp_), we can't exchange it for
      // OIDC via Astral Key. Return null — Convex will show unauthenticated.
      // The user needs to sign in with passkey/Web3 to get a JWT.
      if (storedToken.startsWith("mp_") || storedToken.startsWith("maplespike_")) {
        return null;
      }

      // Heuristic: RS256 JWT signature segment is ~456 chars base64url.
      const parts = storedToken.split(".");
      if (parts.length === 3 && parts[2].length > 300) {
        return storedToken;
      }

      // Exchange HMAC token for OIDC token via Astral Key
      const oidcToken = await exchangeTokenForOidc(storedToken);
      if (oidcToken) {
        localStorage.setItem("maplespike_oidc_token", oidcToken);
        return oidcToken;
      }

      // Fallback: cached OIDC token
      return localStorage.getItem("maplespike_oidc_token") || null;
    });
  }, [client]);

  return (
    <ConvexProvider client={client}>
      {children}
    </ConvexProvider>
  );
}
