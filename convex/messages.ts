import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "./auth";

/** Insert a message into a thread */
export const insert = mutation({
  args: {
    threadId: v.id("threads"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("tool"),
    ),
    content: v.string(),
    toolCallId: v.optional(v.string()),
    toolName: v.optional(v.string()),
    citations: v.optional(
      v.array(
        v.object({
          source: v.string(),
          title: v.string(),
          url: v.string(),
          hash: v.optional(v.string()),
        }),
      ),
    ),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found or access denied");
    }
    return await ctx.db.insert("messages", args);
  },
});
