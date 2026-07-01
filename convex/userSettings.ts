import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "./auth";

// ── Queries ──────────────────────────────────────────────────────────────

/** Get the authenticated user's settings (model, API key, etc.) */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    return settings;
  },
});

/**
 * Internal query: read user's API key by userId.
 * Used by Convex actions (which can't access ctx.db directly).
 */
export const getApiKeyByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    return settings?.apiKey || null;
  },
});

// ── Mutations ────────────────────────────────────────────────────────────

/** Upsert user settings (creates if not exists, updates if exists) */
export const upsert = mutation({
  args: {
    model: v.optional(v.string()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("userSettings", {
      userId,
      model: args.model,
      apiKey: args.apiKey,
      updatedAt: Date.now(),
    });
  },
});
