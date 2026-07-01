"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { getAuthUserId } from "./auth";

// ── MapleSpike API client (called from Convex actions) ──────────────────

const MAPLESPIKE_API =
  process.env.MAPLESPIKE_API_BASE || "https://api.maplespike.lan/v1";

async function mapleSpikeFetch(
  path: string,
  apiKey: string,
  options: RequestInit = {},
): Promise<unknown> {
  const url = `${MAPLESPIKE_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    // eslint-disable-next-line no-console
    console.warn(`[convex] MapleSpike API ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  return res.json();
}

export interface Citation {
  source: string;
  title: string;
  url: string;
  hash?: string;
}

export interface AgentResponse {
  answer: string;
  citations: Citation[];
  model: string;
  latencyMs: number;
}

// ── AI Agent Actions ─────────────────────────────────────────────────────

/**
 * Send a user message to the AI agent.
 *
 * 1. Reads the user's MapleSpike API key from userSettings via runQuery
 * 2. Saves the user message to the thread
 * 3. Calls MapleSpike's AI ask endpoint for a synthesized answer
 * 4. Falls back to gov/search if AI endpoint is unavailable
 * 5. Saves the assistant response + citations to the thread
 */
export const chat = action({
  args: {
    threadId: v.id("threads"),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<AgentResponse> => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    // Verify thread ownership
    const thread = await ctx.runQuery("threads:get", {
      threadId: args.threadId,
    });
    if (!thread) throw new Error("Thread not found or access denied");

    // Get the user's MapleSpike API key from their settings
    const apiKey = await ctx.runQuery("userSettings:getApiKeyByUserId", {
      userId,
    });
    if (!apiKey) {
      throw new Error(
        "No MapleSpike API key configured. Add your key in AI Settings on the dashboard.",
      );
    }

    // 1. Save user message
    await ctx.runMutation("messages:insert", {
      threadId: args.threadId,
      role: "user",
      content: args.message,
      createdAt: now,
    });

    // Update thread timestamp
    await ctx.runMutation("threads:touch", { threadId: args.threadId });

    // Set title from first message if not already set
    if (!thread.title) {
      await ctx.runMutation("threads:setTitle", {
        threadId: args.threadId,
        title: args.message.slice(0, 100),
      });
    }

    // 2. Call MapleSpike AI endpoint
    const startTime = Date.now();
    let answer: string;
    let citations: Citation[] = [];
    let model = "maplespike/default";

    try {
      const aiResp = (await mapleSpikeFetch("/ai/ask", apiKey, {
        method: "POST",
        body: JSON.stringify({
          query: args.message,
          max_sources: 5,
          thread_id: args.threadId,
        }),
        signal: AbortSignal.timeout(30_000),
      })) as { data?: { answer: string; citations: Citation[] } } | null;

      if (aiResp?.data?.answer) {
        answer = aiResp.data.answer;
        citations = aiResp.data.citations || [];
      } else {
        // Fallback: gov/search
        const searchResp = (await mapleSpikeFetch(
          `/gov/search?query=${encodeURIComponent(args.message)}&limit=5`,
          apiKey,
          { signal: AbortSignal.timeout(15_000) },
        )) as { data?: { results?: { pipeline?: unknown[]; ckan?: unknown[] } } } | null;

        const results = [
          ...(searchResp?.data?.results?.pipeline || []),
          ...(searchResp?.data?.results?.ckan || []),
        ].slice(0, 5) as Array<Record<string, unknown>>;

        if (results.length > 0) {
          answer = `Found ${results.length} relevant sources:\n\n${results
            .map(
              (r, i) =>
                `${i + 1}. **${(r.title || r.name || "Dataset") as string}**\n   ${String(r.description || "").slice(0, 120)}`,
            )
            .join("\n\n")}`;
          citations = results.map((r) => ({
            source: (r.organization as Record<string, unknown>)?.title as string ||
              (r.source as string) ||
              "Government of Canada",
            title: (r.title || r.name || "Dataset") as string,
            url: (r.url || "#") as string,
          }));
        } else {
          answer =
            "I searched MapleSpike's 198 data modules but couldn't find relevant results. Try rephrasing your query.";
        }
      }
    } catch (err) {
      answer = `Search failed: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`;
    }

    const latencyMs = Date.now() - startTime;

    // 3. Save assistant response
    await ctx.runMutation("messages:insert", {
      threadId: args.threadId,
      role: "assistant",
      content: answer,
      citations: citations.length > 0 ? citations : undefined,
      createdAt: Date.now(),
    });

    await ctx.runMutation("threads:touch", { threadId: args.threadId });

    return { answer, citations, model, latencyMs };
  },
});

/**
 * List all public/federated data sources available via MapleSpike.
 * Called by agents to discover available tools.
 */
export const listDataSources = action({
  args: {},
  handler: async (_ctx) => {
    const url = `${MAPLESPIKE_API}/health`;
    const res = await fetch(url);
    if (!res.ok) return { error: "MapleSpike API unavailable" };
    return res.json();
  },
});
