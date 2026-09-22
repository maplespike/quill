"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@maplespike/i18n";
import ApiKeyReveal from "@/components/ApiKeyReveal";
import { consumePendingReveal } from "@/lib/api-key";

/**
 * One-time reveal for the OAuth signup path (#890).
 *
 * Not us: `pages/auth/callback.astro` redirects to `/workspace` as soon as the
 * session exists, so the key cannot be shown at the callback. The callback
 * stashes it instead and this island consumes the slot on first paint.
 * Consuming deletes the slot, so "this is the only time we show it" holds
 * across reloads — the secondary `quill-api-key` entry stays for the explorer.
 */
export default function KeyRevealNotice({ lang = "en" }: { lang?: Locale }) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    setPendingKey(consumePendingReveal(window.localStorage));
  }, []);

  if (!pendingKey) return null;

  return (
    <section className="container mx-auto px-4 pt-6">
      <ApiKeyReveal apiKey={pendingKey} lang={lang} onDismiss={() => setPendingKey(null)} />
    </section>
  );
}
