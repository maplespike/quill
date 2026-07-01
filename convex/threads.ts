import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "./auth";

// ── Queries ──────────────────────────────────────────────────────────────

/** List all threads for the authenticated user, newest activity first */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db
      .query("threads")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Get a single thread by ID (must belong to authenticated user) */
export const get = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) return null;
    return thread;
  },
});

/** Get all messages for a thread, ordered by creation time */
export const messages = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) return [];
    return await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

// ── Mutations ────────────────────────────────────────────────────────────

/** Create a new thread */
export const create = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    return await ctx.db.insert("threads", {
      userId,
      title: args.title,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update the last-activity timestamp on a thread */
export const touch = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return;
    await ctx.db.patch(args.threadId, { updatedAt: Date.now() });
  },
});

/** Set or update the thread title */
export const setTitle = mutation({
  args: { threadId: v.id("threads"), title: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return;
    await ctx.db.patch(args.threadId, { title: args.title });
  },
});

/** Delete a thread and all its messages */
export const remove = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found or access denied");
    }
    // Delete all messages in the thread
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();
    for (const msg of msgs) {
      await ctx.db.delete(msg._id);
    }
    await ctx.db.delete(args.threadId);
  },
});
