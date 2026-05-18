"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface Provider {
  name: string;
  label: string;
}

const PROVIDER_ICONS: Record<string, string> = {
  casdoor: "🔑",
  github: "🐙",
  google: "G",
  microsoft: "M",
};

export default function SignupForm() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  async function loadProviders() {
    setLoading(true);
    setError(false);
    const base = "https://maplespike.lan";

    try {
      const resp = await fetch(`${base}/v1/auth/oauth/providers`);
      const data = await resp.json();
      const list: Provider[] = data?.data?.providers || [];
      setProviders(list);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const casdoor = providers.find((p) => p.name === "casdoor");
  const others = providers.filter((p) => p.name !== "casdoor");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Get your free API key</h1>
        <p className="mt-2 text-muted-foreground">
          1,000 calls/month free. No credit card required.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign up</CardTitle>
          <CardDescription>Choose your sign-in method</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading sign-in options...
            </div>
          )}

          {error && (
            <div className="py-6 text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                Could not load sign-in providers. The API server may be offline.
              </p>
              <Button variant="outline" onClick={loadProviders}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && providers.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No sign-in providers configured. Contact the administrator.
            </div>
          )}

          {!loading && !error && providers.length > 0 && (
            <div className="flex flex-col gap-3">
              {casdoor && (
                <>
                  <p className="text-center text-xs text-muted-foreground">
                    Enterprise SSO
                  </p>
                  <ProviderButton provider={casdoor} />
                </>
              )}

              {casdoor && others.length > 0 && (
                <div className="flex items-center gap-3 py-1">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <Separator className="flex-1" />
                </div>
              )}

              {others.map((p) => (
                <ProviderButton key={p.name} provider={p} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        By signing up you agree to our terms of service.
        <br />
        Free tier: 1,000 API calls/month, 30 req/min rate limit.
      </p>
    </div>
  );
}

function ProviderButton({ provider }: { provider: Provider }) {
  const icon = PROVIDER_ICONS[provider.name] || "→";
  const base = "https://maplespike.lan";

  return (
    <a
      href={`${base}/v1/auth/oauth/${provider.name}`}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <span>{icon}</span>
      <span>Sign up with {provider.label}</span>
    </a>
  );
}
