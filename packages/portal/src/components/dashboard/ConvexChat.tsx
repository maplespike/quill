"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Citation {
  source: string;
  title: string;
  url: string;
  hash?: string;
}

/** Detect if the stored token looks like an API key (not a JWT) */
function isApiKeyToken(token: string | null | undefined): boolean {
  if (!token) return false;
  return (
    token.startsWith("mp_") ||
    token.startsWith("maplespike_") ||
    !token.includes(".")
  );
}

export default function ConvexAgentChat() {
  const [threadId, setThreadId] = useState<Id<"threads"> | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Convex queries & mutations
  const threads = useQuery(api.threads.list);
  const thread = useQuery(api.threads.get, threadId ? { threadId } : "skip");
  const messages = useQuery(
    api.threads.messages,
    threadId ? { threadId } : "skip",
  );
  const createThread = useMutation(api.threads.create);
  const deleteThread = useMutation(api.threads.remove);
  const chatAction = useAction(api.agents.chat);

  // Read stored token to determine whether to show the upgrade prompt.
  // Reads on mount and any time the value changes via storage events.
  useEffect(() => {
    const readToken = () => {
      try {
        const t =
          localStorage.getItem("maplespike_token") ||
          localStorage.getItem("maplespike-api-key") ||
          null;
        setStoredToken(t);
      } catch {
        setStoredToken(null);
      }
    };
    readToken();
    window.addEventListener("storage", readToken);
    return () => window.removeEventListener("storage", readToken);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ensureThread = useCallback(async () => {
    if (threadId) return threadId;
    const id = await createThread({});
    setThreadId(id);
    return id;
  }, [threadId, createThread]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);
    setError(null);

    try {
      const tid = await ensureThread();
      await chatAction({ threadId: tid, message: text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }, [input, loading, ensureThread, chatAction]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Loading state — not yet hydrated
  if (threads === undefined) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <div className="py-8">
            <p className="mb-2">Connecting to agent layer…</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not authenticated (no token at all)
  if (!storedToken) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <div className="py-8 space-y-3">
            <p className="mb-2">Sign in to access the AI agent.</p>
            <a
              href="/signup"
              className="text-primary hover:underline text-sm font-medium"
            >
              Sign up or sign in →
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  // API-key auth — show upgrade prompt
  if (isApiKeyToken(storedToken)) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <div className="text-3xl">🔑</div>
          <h3 className="text-lg font-semibold">
            Sign in to use the AI agent
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your account is authenticated with an API key. The agent layer
            runs on Convex with persistent thread memory and requires a
            signed-in session.
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Sign in with your <strong>passkey</strong>,{" "}
            <strong>Web3 wallet</strong>, or <strong>OAuth</strong> to unlock
            the agent. Your API key will continue to work for the REST API.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button asChild className="btn-sheen">
              <a href="/signup">Sign in to enable agent</a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Going to <code className="font-mono">/signup</code> will keep
            your API key intact.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-4" style={{ minHeight: "480px" }}>
      {/* Sidebar: Thread list */}
      <aside className="hidden md:block w-56 shrink-0">
        <Card className="h-full">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Threads</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const id = await createThread({});
                  setThreadId(id);
                }}
                title="New thread"
              >
                +
              </Button>
            </div>
            <div className="space-y-1">
              {threads?.length === 0 && (
                <p className="text-xs text-muted-foreground px-1">
                  No threads yet
                </p>
              )}
              {threads?.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setThreadId(t._id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs truncate transition-colors ${
                    t._id === threadId
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {t.title || "New thread"}
                </button>
              ))}
            </div>
            {threadId && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs text-destructive hover:text-destructive"
                onClick={async () => {
                  await deleteThread({ threadId: threadId! });
                  setThreadId(null);
                }}
              >
                Delete thread
              </Button>
            )}
          </CardContent>
        </Card>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 flex flex-col">
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[320px] max-h-[480px]">
              {(!messages || messages.length === 0) && (
                <div className="flex flex-col items-center justify-center text-center py-12">
                  <div className="text-3xl mb-4 opacity-60">✦</div>
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                    Ask anything about Canadian government
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-6">
                    Questions answered using MapleSpike&apos;s 198 data
                    modules. Every response includes citations for
                    verification.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[
                      "What did the ethics committee discuss recently?",
                      "Show me lobbying activity by RBC",
                      "Recent OAG audits and findings",
                      "Sole-source contracts awarded in 2025",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        className="suggestion-chip"
                        onClick={() => {
                          setInput(prompt);
                          setTimeout(() => handleSend(), 100);
                        }}
                      >
                        {prompt.length > 45
                          ? prompt.slice(0, 42) + "..."
                          : prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages?.map((msg) => (
                <div
                  key={msg._id}
                  className={`chat-message ${msg.role}`}
                >
                  <div className="avatar">
                    {msg.role === "user" ? "U" : "AI"}
                  </div>
                  <div className="bubble">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.content}
                    </div>
                    {msg.citations && msg.citations.length > 0 && (
                      <details className="mt-3 pt-3 border-t border-border">
                        <summary className="text-xs text-muted-foreground cursor-pointer font-mono">
                          {msg.citations.length} citation
                          {msg.citations.length > 1 ? "s" : ""}
                        </summary>
                        <div className="mt-2 space-y-1">
                          {msg.citations.map((c: Citation, i: number) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 p-1.5 rounded bg-muted/50 text-xs"
                            >
                              <span className="text-primary font-medium shrink-0">
                                {c.source}
                              </span>
                              <span className="text-muted-foreground truncate">
                                {c.title}
                              </span>
                              {c.hash && (
                                <span className="font-mono text-[0.6rem] text-muted-foreground shrink-0">
                                  {c.hash.slice(0, 12)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="chat-message assistant">
                  <div className="avatar">AI</div>
                  <div className="bubble">
                    <div className="typing-dots">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4 bg-muted/30">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about Parliament, lobbying, regulations..."
                  className="min-h-[48px] max-h-[160px] flex-1 resize-none"
                  rows={1}
                  disabled={loading}
                />
                <Button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="shrink-0 h-10 px-5"
                >
                  {loading ? "..." : "Ask"}
                </Button>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  Powered by Convex + MapleSpike MCP · Persistent memory
                </span>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                  {thread?.title ? "Active thread" : "New thread"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
