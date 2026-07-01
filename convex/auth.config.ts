/**
 * MapleSpike Convex Auth Configuration
 *
 * Uses Astral Key (Rust OIDC provider) as the JWT issuer.
 * Astral Key serves JWKS at /oidc/jwks and issues RS256 tokens
 * with the `aud` claim set to the client_id (typically "convex").
 *
 * Configure these via environment variables or hardcode for self-hosted.
 */
const issuer = process.env.CONVEX_AUTH_ISSUER || "https://auth.maplespike.lan";
const audience = process.env.CONVEX_AUTH_AUDIENCE || "convex";

export default {
  providers: [
    {
      // Astral Key OIDC provider
      domain: issuer,
      applicationID: audience,
    },
  ],
};
