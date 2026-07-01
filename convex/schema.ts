import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * MapleSpike Agent Layer — Convex Schema
 *
 * Persistent thread/message storage for AI agent conversations.
 * Agents read/write via Convex functions; external APIs (MapleSpike,
 * LLM inference) are called from Convex actions.
 */
export default defineSchema({
  /** Conversation threads — one per user session */
  threads: defineTable({
    /** User ID from Astral Key JWT (sub claim) */
    userId: v.string(),
    /** Display title (first user message or custom) */
    title: v.optional(v.string()),
    /** Creation timestamp */
    createdAt: v.number(),
    /** Last activity timestamp */
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  /** Messages within a thread */
  messages: defineTable({
    /** Parent thread */
    threadId: v.id("threads"),
    /** Message role */
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("tool"),
    ),
    /** Message content (plain text or JSON for tool calls) */
    content: v.string(),
    /** Tool call ID (for tool role messages) */
    toolCallId: v.optional(v.string()),
    /** Tool name (for tool role messages) */
    toolName: v.optional(v.string()),
    /** Citations from MapleSpike data sources */
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
    /** Message timestamp */
    createdAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_createdAt", ["createdAt"]),

  /** Registered agents / tool definitions */
  agents: defineTable({
    /** Agent name (e.g. "maplespike-search", "committee-analyzer") */
    name: v.string(),
    /** Human-readable description */
    description: v.string(),
    /** Tool schema (JSON Schema for function calling) */
    toolSchema: v.optional(v.string()),
    /** Whether the agent is active */
    active: v.boolean(),
  }),

  /** User preferences / settings */
  userSettings: defineTable({
    /** User ID from Astral Key JWT */
    userId: v.string(),
    /** Preferred AI model */
    model: v.optional(v.string()),
    /** MapleSpike API key (forwarded to API calls from Convex actions) */
    apiKey: v.optional(v.string()),
    /** Updated timestamp */
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"]),
});
