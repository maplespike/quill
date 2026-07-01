import { Auth } from "convex/server";

/**
 * Extract the authenticated user's ID from the Convex auth context.
 * Astral Key puts the user UUID in the `sub` claim of the JWT.
 */
export async function getAuthUserId(ctx: { auth: Auth }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated: valid JWT required from Astral Key");
  }
  // Astral Key stores user UUID in the `sub` claim
  return identity.subject;
}
