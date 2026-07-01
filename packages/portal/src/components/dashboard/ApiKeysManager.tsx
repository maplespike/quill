"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function getApiBase(): string {
  if (typeof window !== "undefined") {
    if (window.MAPLESPIKE?.apiBase) return window.MAPLESPIKE.apiBase;
    const host = window.location.hostname;
    const parts = host.split(".");
    const base = parts.length > 2 && ["api", "portal", "www", "mcp", "dev", "data"].includes(parts[0])
      ? parts.slice(1).join(".") : host;
    return `${window.location.protocol}//api.${base}`;
  }
  return "https://api.maplespike.lan";
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("maplespike_token");
}

interface ApiKey {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

declare global {
  interface Window {
    MAPLESPIKE?: { apiBase?: string };
  }
}

export default function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = getToken();
    setToken(t);
    if (t) {
      loadKeys(t);
    } else {
      setLoading(false);
    }
  }, []);

  const loadKeys = useCallback(async (authToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${getApiBase()}/v1/keys`, {
        headers: { "x-api-key": authToken },
      });
      const data = await resp.json();
      if (data.success) {
        setKeys(data.data.keys || []);
      } else {
        setError(data.error?.message || "Failed to load keys");
      }
    } catch {
      setError("Could not reach API server");
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleCreate() {
    if (!token) return;
    setCreating(true);
    setError(null);
    try {
      const resp = await fetch(`${getApiBase()}/v1/keys`, {
        method: "POST",
        headers: {
          "x-api-key": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newKeyName || "default" }),
      });
      const data = await resp.json();
      if (data.success) {
        const key = data.data.key || data.data.rawKey || "";
        setNewKey(key);
        setNewKeyName("");
        loadKeys(token);
      } else {
        setError(data.error?.message || "Failed to create key");
      }
    } catch {
      setError("Could not reach API server");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!token) return;
    try {
      const resp = await fetch(`${getApiBase()}/v1/keys/${keyId}`, {
        method: "DELETE",
        headers: { "x-api-key": token },
      });
      const data = await resp.json();
      if (data.success) {
        loadKeys(token);
      }
    } catch {
      setError("Failed to revoke key");
    }
  }

  function copyKey(key: string) {
    navigator.clipboard?.writeText(key);
  }

  // Not authenticated
  if (!token) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sign in with Passkey or Web3 wallet to manage API keys.
        <a href="/signup" className="block mt-2 text-primary hover:underline">
          Create Account →
        </a>
      </p>
    );
  }

  // Authenticated
  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* New key reveal */}
      {newKey && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
            New API Key — save it now, it won't be shown again
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-background/60 p-2 font-mono text-sm">
              {newKey}
            </code>
            <Button size="sm" variant="outline" onClick={() => copyKey(newKey)}>
              Copy
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => setNewKey(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Create new key */}
      <div className="flex gap-2">
        <Input
          placeholder="Key name (optional)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          className="flex-1"
        />
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? "Creating..." : "Create Key"}
        </Button>
      </div>

      {/* Key list */}
      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-4">
          Loading keys...
        </p>
      ) : keys.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">
          No API keys yet. Create one above.
        </p>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-lg border bg-card/40 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{key.id}</span>
                  {key.isActive ? (
                    <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-xs text-green-400">
                      Active
                    </span>
                  ) : (
                    <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-xs text-red-400">
                      Revoked
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {key.name} · Created {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                </div>
              </div>
              {key.isActive && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleRevoke(key.id)}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
