import { useState } from "react";
import { Button } from "@/components/ui/button";
import { discoveryCurl } from "@/lib/api-key-reveal";

/**
 * Blocking reveal shown once, right after a key is minted.
 * The full key is on the page. A later account card may truncate it.
 */
export function ApiKeyReveal({
  apiKey,
  apiBase,
  onContinue,
}: {
  apiKey: string;
  apiBase: string;
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const curl = discoveryCurl(apiBase, apiKey);

  return (
    <div role="region" aria-label="Your API key" className="space-y-3">
      <p className="text-sm">
        Copy this key now. It is also stored in this browser.
      </p>
      <code data-testid="api-key-value" className="block break-all font-mono text-sm">
        {apiKey}
      </code>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={() => {
          void navigator.clipboard?.writeText(apiKey);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="whitespace-pre-wrap break-all rounded-md border bg-muted/40 p-3 font-mono text-xs">
        {curl}
      </pre>
      <p className="text-xs text-muted-foreground">
        Manage or rotate this key on the <a href="/dashboard" className="underline">dashboard</a>.
      </p>
      <Button type="button" className="w-full" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}
