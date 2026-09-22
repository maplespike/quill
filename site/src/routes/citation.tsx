import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";

const SAMPLE = `{
  "source": "ocl",
  "note": "Illustrative payload. Not a stored Quill citation."
}`;

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/citation")({
  head: () =>
    pageMeta("Verify", "Hash a payload with SHA-256 the same way Quill cites a record."),
  component: CitationPage,
});

function CitationPage() {
  const [payload, setPayload] = useState(SAMPLE);
  const [hash, setHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHash(await sha256(payload));
    setCopied(false);
  }

  async function copy() {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Shell>
      <PageHeader
        kicker="Verify"
        title="Hash the bytes. Then decide."
        lede="Quill hashes canonical JSON, not a pretty-printed file. Paste the exact text. This page hashes UTF-8 with SHA-256 and shows the hex."
      />
      <form onSubmit={onSubmit} className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <label htmlFor="payload" className="text-sm font-medium">
          Payload
        </label>
        <textarea
          id="payload"
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          rows={8}
          spellCheck={false}
          className="mt-2 w-full rounded-control border border-line bg-surface p-4 font-mono text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        />
        <Button className="mt-4" type="submit" size="lg">
          Compute SHA-256
        </Button>
        {hash ? (
          <div className="mt-8 rounded-panel border border-line bg-surface p-6" role="status">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">sha256</p>
            <p className="mt-3 break-all font-mono text-sm text-ink">{hash}</p>
            <Button className="mt-4" type="button" variant="secondary" onClick={copy}>
              {copied ? "Copied" : "Copy hash"}
            </Button>
          </div>
        ) : null}
      </form>
    </Shell>
  );
}
