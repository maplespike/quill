"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function getApiBase(): string {
  if (typeof window !== "undefined") {
    if (window.MAPLESPIKE?.apiBase) return window.MAPLESPIKE.apiBase;
    const host = window.location.hostname;
    const parts = host.split(".");
    const base = parts.length > 2 && ["api", "portal", "www", "mcp", "dev", "data"].includes(parts[0])
      ? parts.slice(1).join(".") : host;
    return `${window.location.protocol}//api.${base}`;
  }
  return "https://api.maplespike.ca";
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("maplespike_token");
}

declare global {
  interface Window {
    MAPLESPIKE?: { apiBase?: string };
  }
}

const PROVIDERS = [
  { value: "default", label: "Cluster Default (local model)", description: "Use MapleSpike's hosted AI — no setup needed" },
  { value: "openai", label: "OpenAI", description: "GPT-4o, GPT-4 Turbo" },
  { value: "anthropic", label: "Anthropic", description: "Claude Sonnet, Opus" },
  { value: "openrouter", label: "OpenRouter", description: "100+ models via one API" },
  { value: "zai", label: "Z.AI", description: "GLM-5.2, GLM-5.1" },
  { value: "nvidia", label: "NVIDIA NIM", description: "Llama, Mistral, Nemotron" },
  { value: "custom", label: "Custom Endpoint", description: "Your own OpenAI-compatible server" },
];

export default function AISettings() {
  const [provider, setProvider] = useState("default");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    setToken(t);
    if (t) loadSettings(t);
    else setLoading(false);
  }, []);

  const loadSettings = useCallback(async (authToken: string) => {
    setLoading(true);
    try {
      const resp = await fetch(`${getApiBase()}/v1/ai/settings`, {
        headers: { "x-api-key": authToken },
      });
      const data = await resp.json();
      if (data.success && data.data.settings) {
        setProvider(data.data.settings.provider || "default");
        setModel(data.data.settings.model || "");
        setEndpoint(data.data.settings.endpoint || "");
        setApiKey(data.data.settings.apiKey || "");
      }
    } catch {
      // Not critical — defaults are fine
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const resp = await fetch(`${getApiBase()}/v1/ai/settings`, {
        method: "PUT",
        headers: {
          "x-api-key": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.includes("...") ? "" : apiKey, // Don't send masked key
          model,
          endpoint,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error?.message || "Failed to save settings");
      }
    } catch {
      setError("Could not reach API server");
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        <a href="/signup" className="text-primary hover:underline">Sign in</a> to configure your AI settings.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>;
  }

  const selectedProvider = PROVIDERS.find((p) => p.value === provider);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Provider selector */}
      <div>
        <label className="mb-2 block text-sm font-medium">AI Provider</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              onClick={() => setProvider(p.value)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                provider === p.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div className="text-sm font-medium">{p.label}</div>
              <div className="text-xs text-muted-foreground">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Provider-specific fields */}
      {provider !== "default" && (
        <div className="space-y-3 rounded-lg border bg-card/40 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">API Key</label>
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Model {selectedProvider && `(default: ${getModelDefault(provider)})`}
            </label>
            <Input
              placeholder={getModelDefault(provider)}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
          {provider === "custom" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Endpoint URL
              </label>
              <Input
                placeholder="http://your-server:8080/v1"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        {saved && (
          <span className="text-sm text-green-400">Saved! AI queries will use your settings.</span>
        )}
      </div>
    </div>
  );
}

function getModelDefault(provider: string): string {
  const defaults: Record<string, string> = {
    openai: "gpt-4o",
    anthropic: "claude-sonnet-4-20250514",
    openrouter: "deepseek/deepseek-chat",
    zai: "glm-5.2",
    nvidia: "meta/llama-3.3-70b-instruct",
    custom: "custom",
    default: "cluster model",
  };
  return defaults[provider] || "auto";
}
