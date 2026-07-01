"use client";

import { ReactNode, useMemo, useEffect } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

/**
 * Token bridge: Astral Key HMAC token -> Convex OIDC token.
 *
 * Astral Key issues HMAC (HS256) tokens for API auth.
 * Convex requires RS256 OIDC tokens with `aud` claim.
 *
 * This bridge calls Astral Key's /oidc/token endpoint to exchange
 * the HMAC token for an RS256 token that Convex can verify.
 *
 * Uses Convex v1.42.1 API: `client.setAuth(fetchToken)`.
 */
async function exchangeTokenForOidc(
  hmacToken: string,
): Promise<string | null> {
  try {
    const base = getAstralKeyBase();
    // Pass client_id=convex so Astral Key sets the `aud` claim
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

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("maplespike_token") ||
    localStorage.getItem("maplespike-api-key") ||
    null
  );
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

  // Wire custom auth via client.setAuth() (Convex v1.42.1 API)
  useEffect(() => {
    client.setAuth(async (): Promise<string | null> => {
      const storedToken = getStoredToken();
      if (!storedToken) return null;

      // Heuristic: RS256 JWT signature segment is ~456 chars base64url.
      // If the third segment (signature) is long, it's likely OIDC.
      const parts = storedToken.split(".");
      if (parts.length === 3 && parts[2].length > 300) {
        return storedToken;
      }

      // Exchange HMAC token for OIDC token
      const oidcToken = await exchangeTokenForOidc(storedToken);
      if (oidcToken) {
        localStorage.setItem("maplespike_oidc_token", oidcToken);
        return oidcToken;
      }

      // Fallback: try cached OIDC token
      return localStorage.getItem("maplespike_oidc_token") || null;
    });
  }, [client]);

  return (
    <ConvexProvider client={client}>
      {children}
    </ConvexProvider>
  );
}
