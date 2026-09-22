import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { API_ORIGIN, ENDPOINTS, type Endpoint } from "@/lib/endpoints";
import { pageMeta } from "@/lib/page-meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/api-explorer")({
  head: () => pageMeta("API explorer", "The Quill gateway routes, and a browser call when the endpoint is public."),
  component: ApiExplorerPage,
});

function ApiExplorerPage() {
  const [current, setCurrent] = useState<Endpoint>(ENDPOINTS[0]);
  const [body, setBody] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = `${API_ORIGIN}${current.path}`;
  const curl =
    current.method === "GET"
      ? `curl ${url}`
      : `curl -X ${current.method} ${url} \\\n  -H 'authorization: Bearer $QUILL_API_KEY' \\\n  -H 'content-type: application/json'`;

  async function send() {
    setPending(true);
    setBody(null);
    try {
      const response = await fetch(url, { method: current.method === "GET" ? "GET" : "POST" });
      const text = await response.text();
      setBody(`${response.status}\n${text.slice(0, 2000)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setBody(`The browser could not read the response. ${message}. Copy the curl and run it locally.`);
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Shell>
      <PageHeader
        kicker="API"
        title="The gateway, route by route."
        lede="Base URL is api.maplespike.ca. Public routes can be called from this page. Authed routes need a cluster key, so the browser will show the failure instead of a fake payload."
      />
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-12">
        <ul className="flex gap-2 overflow-x-auto lg:col-span-4 lg:block lg:overflow-visible">
          {ENDPOINTS.map((endpoint) => (
            <li key={endpoint.id}>
              <button
                type="button"
                onClick={() => {
                  setCurrent(endpoint);
                  setBody(null);
                  setCopied(false);
                }}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-sm",
                  current.id === endpoint.id ? "bg-ink text-paper" : "hover:bg-chip",
                )}
              >
                <span className="font-mono text-xs">{endpoint.method}</span>
                <span className="truncate">{endpoint.path}</span>
              </button>
            </li>
          ))}
        </ul>
        <section className="lg:col-span-8">
          <h2 className="font-display text-2xl tracking-tight">{current.description}</h2>
          <p className="mt-2 font-mono text-xs text-muted">Auth {current.auth}</p>
          <pre className="mt-4 overflow-x-auto rounded-control bg-ink p-4 font-mono text-xs leading-relaxed text-on-ink">
            {curl}
          </pre>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={copy} variant="secondary">
              {copied ? "Copied" : "Copy curl"}
            </Button>
            <Button type="button" onClick={send} disabled={pending}>
              {pending ? "Calling…" : "Call from this browser"}
            </Button>
          </div>
          {body ? (
            <pre className="mt-4 max-h-80 overflow-auto rounded-control border border-line bg-surface p-4 font-mono text-xs text-ink" role="status">
              {body}
            </pre>
          ) : null}
        </section>
      </div>
    </Shell>
  );
}
