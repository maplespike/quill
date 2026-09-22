"use client";

import { useState } from "react";
import type { Locale } from "@maplespike/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { pick } from "@/utils/bilingual";
import { localeUrl } from "@/utils/localeUrl";
import { getApiBase } from "@/lib/api-base";

interface ApiKeyRevealProps {
  /** The freshly minted key, shown in full — never truncated. */
  apiKey: string;
  lang?: Locale;
  /** Called when the customer confirms they saved the key. */
  onDismiss?: () => void;
}

/**
 * One-time API-key reveal (#890 / gate B1-KEYREVEAL).
 *
 * Shown exactly once per mint, right after the key is created. It carries the
 * whole value (the account card truncates), a copy button, the one-time
 * warning, a copyable curl against a free endpoint, and the docs link.
 */
export default function ApiKeyReveal({ apiKey, lang = "en", onDismiss }: ApiKeyRevealProps) {
  const [copied, setCopied] = useState<"key" | "curl" | null>(null);
  const curl = `curl -H "x-api-key: ${apiKey}" ${getApiBase()}/v1/llms.txt`;

  async function copy(value: string, which: "key" | "curl") {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(which);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Card data-testid="api-key-reveal" className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-lg">{pick(lang, "Save your API key", "Enregistrez votre clé API")}</CardTitle>
        <CardDescription data-testid="one-time-warning">
          {pick(
            lang,
            "This is the only time we show it.",
            "C'est la seule fois que nous l'affichons.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              {pick(lang, "Your API key", "Votre clé API")}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="copy-key"
              onClick={() => copy(apiKey, "key")}
            >
              {copied === "key" ? pick(lang, "Copied", "Copié") : pick(lang, "Copy key", "Copier la clé")}
            </Button>
          </div>
          <code
            data-testid="api-key-value"
            className="block break-all rounded bg-background/60 p-2 font-mono text-sm"
          >
            {apiKey}
          </code>
          <p className="mt-2 text-xs text-muted-foreground">
            {pick(
              lang,
              "Store it now — a password manager or a secret store. We also saved it in this browser so the API explorer can reuse it.",
              "Conservez-la maintenant — dans un gestionnaire de mots de passe ou un coffre de secrets. Nous l'avons aussi enregistrée dans ce navigateur pour que l'explorateur d'API puisse la réutiliser.",
            )}
          </p>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="mb-2 text-xs text-muted-foreground">
            {pick(lang, "Test it against a free endpoint:", "Testez-la avec un point de terminaison gratuit :")}
          </div>
          <div className="flex items-start justify-between gap-3">
            <code data-testid="api-key-curl" className="block break-all font-mono text-xs">
              {curl}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="copy-curl"
              onClick={() => copy(curl, "curl")}
            >
              {copied === "curl" ? pick(lang, "Copied", "Copié") : pick(lang, "Copy", "Copier")}
            </Button>
          </div>
        </div>

        <p className="text-sm">
          <a
            data-testid="docs-link"
            className="text-primary underline underline-offset-4"
            href={`${localeUrl("/docs", lang)}#authentication`}
          >
            {pick(
              lang,
              "How API keys and passkeys work",
              "Fonctionnement des clés API et des clés d'accès",
            )}
          </a>
        </p>

        {onDismiss && (
          <Button type="button" className="w-full" data-testid="dismiss-reveal" onClick={onDismiss}>
            {pick(lang, "I saved my key", "J'ai enregistré ma clé")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
