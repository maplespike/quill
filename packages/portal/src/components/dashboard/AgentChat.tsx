"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

/**
 * AgentChat — direct client-side chat with the MapleSpike edge AI worker.
 * Replaces the Convex-based ConvexAgentChat. No external dependency required.
 * Sends questions to /v1/ai/ask (edge worker) and renders responses with citations.
 */
import { createI18n } from "@maplespike/i18n";
import type { Locale } from "@maplespike/i18n";

export default function AgentChat({ lang: propLang }: { lang?: Locale }) {
  const lang = propLang || (typeof window !== "undefined" ? ((window as Record<string, string>).__LANG as Locale || "en") : "en");
  const i18n = createI18n(lang);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Resolve API base — same pattern as other portal components
  const apiBase =
    (typeof window !== "undefined" && (window as Record<string, { apiBase?: string }>).MAPLESPIKE?.apiBase) ||
    "http://127.0.0.1:8082";

  useEffect(() => {
    const readToken = () => {
      try {
        const t =
          localStorage.getItem("maplespike_token") ||
          localStorage.getItem("quill-api-key") ||
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (storedToken) {
        // Send as Bearer if JWT, or X-API-Key if API key
        if (storedToken.includes(".")) {
          headers["Authorization"] = `Bearer ${storedToken}`;
        } else {
          headers["X-API-Key"] = storedToken;
        }
      }

      const resp = await fetch(`${apiBase}/v1/ai/ask`, {
        method: "POST",
        headers,
        body: JSON.stringify({ question: text }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`API error ${resp.status}: ${body.slice(0, 200)}`);
      }

      const data = await resp.json();
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.answer || data.data?.answer || "No response received.",
        citations: data.citations || data.data?.citations,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chat request failed";
      setError(msg);
      // Still add a placeholder so the user sees something happened
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Could not reach the AI service. ${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, storedToken, apiBase]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Not authenticated
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

  return (
    <Card>
      <CardContent className="p-0">
        {/* Messages */}
        <div className="overflow-y-auto p-4 space-y-4 min-h-[320px] max-h-[480px]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="text-3xl mb-4 opacity-60">✦</div>
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Ask anything about Canadian government
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Questions answered using MapleSpike's 206 data modules. Every
                response includes citations for verification.
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
                    {prompt.length > 45 ? prompt.slice(0, 42) + "..." : prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div className="avatar">{msg.role === "user" ? "U" : "AI"}</div>
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
                      {msg.citations.map((c, j) => (
                        <div
                          key={j}
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
                  <span />
                  <span />
                  <span />
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
              Powered by MapleSpike Edge AI · Workers AI + homelab fallback
            </span>
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
              Live
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
