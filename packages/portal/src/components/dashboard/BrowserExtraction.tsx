"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface ExtractionTask {
  source_id: string;
  jurisdiction: string;
  name: string;
  url: string;
  extract_type: "link_list";
  selector: string;
  instructions: string;
  cache_ttl_hours: number;
  cached?: boolean;
}

interface ExtractionResult {
  title: string;
  url: string;
  format: string;
}

type TaskStatus =
  | "pending"
  | "loading"
  | "extracting"
  | "done"
  | "error"
  | "cached"
  | "manual";

const STATUS_META: Record<
  TaskStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  },
  loading: {
    label: "Loading",
    className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  extracting: {
    label: "Extracting",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  },
  done: {
    label: "Done",
    className: "bg-green-500/10 text-green-500 border-green-500/20",
  },
  cached: {
    label: "Cached",
    className: "bg-green-500/10 text-green-500 border-green-500/20",
  },
  error: {
    label: "Error",
    className: "bg-red-500/10 text-red-500 border-red-500/20",
  },
  manual: {
    label: "Manual",
    className: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
};

const FORMAT_BADGE: Record<string, string> = {
  XLSX: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  CSV: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  PDF: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

function detectFormat(href: string): string {
  if (href.endsWith(".xlsx") || href.endsWith(".xls")) return "XLSX";
  if (href.endsWith(".pdf")) return "PDF";
  if (href.endsWith(".csv")) return "CSV";
  if (href.endsWith(".json")) return "JSON";
  if (href.endsWith(".zip")) return "ZIP";
  return "other";
}

function buildBookmarklet(task: ExtractionTask): string {
  // Bookmarklet: finds links matching the selector on the current page,
  // then opens the MapleSpike results endpoint with the extracted JSON.
  const code = `
(function(){
  try {
    var links = document.querySelectorAll(${JSON.stringify(task.selector)});
    var results = [];
    for (var i = 0; i < links.length; i++) {
      var el = links[i];
      if (!el.href) continue;
      results.push({
        title: (el.textContent || '').trim() || el.href.split('/').pop() || 'Unknown',
        url: el.href,
        format: el.href.endsWith('.xlsx') ? 'XLSX' : el.href.endsWith('.pdf') ? 'PDF' : el.href.endsWith('.csv') ? 'CSV' : 'other'
      });
    }
    var payload = JSON.stringify({ source_id: ${JSON.stringify(task.source_id)}, results: results });
    var dest = window.location.origin + '/api/extraction/results';
    fetch(dest, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
      .then(function(r){ return r.json(); })
      .then(function(d){ alert('MapleSpike: posted ' + results.length + ' links to cache.'); })
      .catch(function(e){ alert('MapleSpike: post failed — ' + e.message); });
  } catch (err) {
    alert('MapleSpike bookmarklet error: ' + err.message);
  }
})();`.trim();
  return `javascript:${encodeURIComponent(code)}`;
}

import { createI18n } from "@maplespike/i18n";
import type { Locale } from "@maplespike/i18n";

export default function BrowserExtraction({ lang: propLang }: { lang?: Locale }) {
  const lang = propLang || (typeof window !== "undefined" ? ((window as Record<string, string>).__LANG as Locale || "en") : "en");
  const i18n = createI18n(lang);
  const [tasks, setTasks] = useState<ExtractionTask[]>([]);
  const [statuses, setStatuses] = useState<Record<string, TaskStatus>>({});
  const [results, setResults] = useState<Record<string, ExtractionResult[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});

  // Fetch tasks on mount
  useEffect(() => {
    fetch("/api/extraction/tasks")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const taskList: ExtractionTask[] = data.data.tasks || [];
          setTasks(taskList);
          const initialStatuses: Record<string, TaskStatus> = {};
          taskList.forEach((t) => {
            initialStatuses[t.source_id] = t.cached ? "cached" : "pending";
          });
          setStatuses(initialStatuses);
        }
      })
      .catch(() => {
        /* API not available yet — show empty state */
      })
      .finally(() => setLoadingTasks(false));
  }, []);

  const updateStatus = (id: string, status: TaskStatus) =>
    setStatuses((s) => ({ ...s, [id]: status }));

  // Execute extraction for a single task — tries iframe, then no-cors fetch,
  // then falls back to manual extraction UI.
  const runExtraction = useCallback(async (task: ExtractionTask) => {
    updateStatus(task.source_id, "loading");
    setErrors((e) => ({ ...e, [task.source_id]: "" }));

    // --- Attempt 1: hidden iframe ---
    let iframe: HTMLIFrameElement | null = null;
    try {
      iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
      iframe.src = task.url;

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Timeout")),
          15000,
        );
        iframe!.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        iframe!.onerror = () => {
          clearTimeout(timer);
          reject(new Error("Load error"));
        };
        document.body.appendChild(iframe!);
      });

      updateStatus(task.source_id, "extracting");

      // Cross-origin pages throw / return null on access
      const doc =
        iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error("Cannot access iframe document (CORS)");

      const links = doc.querySelectorAll(task.selector);
      const extracted: ExtractionResult[] = Array.from(links)
        .map((a) => {
          const el = a as HTMLAnchorElement;
          if (!el.href) return null;
          const title =
            el.textContent?.trim() ||
            el.href.split("/").pop() ||
            "Unknown";
          return {
            title,
            url: el.href,
            format: detectFormat(el.href),
          };
        })
        .filter((r): r is ExtractionResult => r !== null);

      await fetch("/api/extraction/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_id: task.source_id,
          results: extracted,
        }),
      });

      setResults((r) => ({ ...r, [task.source_id]: extracted }));
      updateStatus(task.source_id, "done");
      return;
    } catch (err) {
      // Fall through to attempt 2
    } finally {
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }

    // --- Attempt 2: no-cors fetch (probes reachability, opaque response) ---
    // We can't read the DOM, but if it succeeds we tell the server-side
    // proxy to fetch it. If it fails, we surface manual fallback.
    try {
      const probe = await fetch(task.url, {
        mode: "no-cors",
        method: "GET",
      });
      // Opaque response (type: "opaque") means the server exists but CORS
      // blocks reading. Queue server-side proxy extraction.
      if (probe) {
        await fetch("/api/extraction/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_id: task.source_id,
            proxy: true,
            url: task.url,
            selector: task.selector,
          }),
        });
        updateStatus(task.source_id, "manual");
        setErrors((e) => ({
          ...e,
          [task.source_id]:
            "CORS blocked direct extraction. Queued for server-side proxy. You can also extract manually below.",
        }));
        return;
      }
    } catch {
      /* fall through to manual */
    }

    // --- Attempt 3: manual extraction fallback ---
    updateStatus(task.source_id, "manual");
    setErrors((e) => ({
      ...e,
      [task.source_id]:
        "Direct extraction blocked. Open the source page and use the bookmarklet or paste results manually.",
    }));
  }, []);

  // Run all pending extractions
  const runAll = () => {
    tasks
      .filter((t) => statuses[t.source_id] === "pending")
      .forEach((task) => {
        runExtraction(task);
      });
  };

  const pendingCount = tasks.filter(
    (t) => statuses[t.source_id] === "pending",
  ).length;

  const toggleCollapse = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  // Submit manually pasted results (one JSON array or newline-separated URLs)
  const submitManual = async (task: ExtractionTask) => {
    const raw = (manualInputs[task.source_id] || "").trim();
    if (!raw) return;
    let extracted: ExtractionResult[] = [];
    try {
      // Try JSON array first
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        extracted = parsed.map((item: ExtractionResult) => ({
          title: item.title || "Unknown",
          url: item.url,
          format: item.format || detectFormat(item.url || ""),
        }));
      }
    } catch {
      // Fall back to one URL per line
      extracted = raw
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const url = /^https?:\/\//.test(line) ? line : `https://${line}`;
          return {
            title: url.split("/").pop() || url,
            url,
            format: detectFormat(url),
          };
        });
    }

    if (extracted.length === 0) return;

    updateStatus(task.source_id, "extracting");
    try {
      await fetch("/api/extraction/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_id: task.source_id,
          results: extracted,
        }),
      });
      setResults((r) => ({ ...r, [task.source_id]: extracted }));
      updateStatus(task.source_id, "done");
      setManualInputs((m) => ({ ...m, [task.source_id]: "" }));
    } catch {
      updateStatus(task.source_id, "error");
      setErrors((e) => ({
        ...e,
        [task.source_id]: "Failed to submit manual results.",
      }));
    }
  };

  if (loadingTasks) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading extraction tasks…
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No extraction tasks available. Government data sources are
          auto-discovered and will appear here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Browser Extraction</h2>
          <p className="text-sm text-muted-foreground">
            Your browser extracts public data from government portals and
            caches it server-side for all users.
          </p>
        </div>
        <Button onClick={runAll} disabled={pendingCount === 0}>
          {pendingCount > 0
            ? `Run All (${pendingCount})`
            : "All Up To Date"}
        </Button>
      </div>

      {/* Task list */}
      {tasks.map((task) => {
        const status = statuses[task.source_id] || "pending";
        const meta = STATUS_META[status];
        const isCollapsed = collapsed[task.source_id] ?? true;
        const taskResults = results[task.source_id] || [];
        const errorMsg = errors[task.source_id];
        const showManual = status === "manual";

        return (
          <Card key={task.source_id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{task.name}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {task.jurisdiction}
                    </Badge>
                  </div>
                  <CardDescription className="mt-1 truncate">
                    {task.url}
                  </CardDescription>
                </div>
                <Badge className={meta.className}>{meta.label}</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Cache TTL + instructions */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Cache TTL:{" "}
                  <strong className="text-foreground">
                    {task.cache_ttl_hours}h
                  </strong>
                </span>
                <span>
                  Selector:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    {task.selector}
                  </code>
                </span>
              </div>

              {task.instructions && (
                <p className="text-xs text-muted-foreground italic">
                  {task.instructions}
                </p>
              )}

              {/* Error / CORS warning */}
              {errorMsg && (
                <div className="flex items-start gap-2 rounded-md border border-orange-500/20 bg-orange-500/5 p-3 text-xs">
                  <span className="text-orange-600 font-medium">⚠ CORS</span>
                  <span className="text-muted-foreground">{errorMsg}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {status === "pending" && (
                  <Button
                    size="sm"
                    onClick={() => runExtraction(task)}
                  >
                    Extract
                  </Button>
                )}
                {(status === "error" || status === "manual") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runExtraction(task)}
                  >
                    Retry
                  </Button>
                )}
                {(status === "cached" || status === "done") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => runExtraction(task)}
                  >
                    Re-extract
                  </Button>
                )}

                {/* Manual fallback actions */}
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                >
                  <a href={task.url} target="_blank" rel="noopener noreferrer">
                    Open Source Page
                  </a>
                </Button>

                {(showManual || status === "error") && (
                  <a
                    href={buildBookmarklet(task)}
                    onClick={(e) => e.preventDefault()}
                    className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground cursor-move"
                    title="Drag this to your bookmarks bar, then click it while on the source page."
                  >
                    ⬆ Bookmarklet
                  </a>
                )}
              </div>

              {/* Manual paste box */}
              {(showManual || status === "error") && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium">
                    Manual extraction fallback
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paste a JSON array of{" "}
                    <code className="bg-muted px-1 rounded">
                      {"{title, url, format}"}
                    </code>{" "}
                    objects, or one file URL per line.
                  </p>
                  <textarea
                    value={manualInputs[task.source_id] || ""}
                    onChange={(e) =>
                      setManualInputs((m) => ({
                        ...m,
                        [task.source_id]: e.target.value,
                      }))
                    }
                    placeholder={'https://gov.example.ca/data/2024.xlsx\nor [{"title":"...","url":"...","format":"XLSX"}]'}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    disabled={!(manualInputs[task.source_id] || "").trim()}
                    onClick={() => submitManual(task)}
                  >
                    Submit Results
                  </Button>
                </div>
              )}

              {/* Collapsible results */}
              {taskResults.length > 0 && (
                <div className="pt-1">
                  <button
                    onClick={() => toggleCollapse(task.source_id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isCollapsed
                      ? `▶ Show ${taskResults.length} result${taskResults.length === 1 ? "" : "s"}`
                      : "▼ Hide results"}
                  </button>
                  {!isCollapsed && (
                    <div className="mt-2 space-y-1.5">
                      {taskResults.map((res, i) => {
                        const fmtClass =
                          FORMAT_BADGE[res.format] ||
                          "bg-muted text-muted-foreground border-border";
                        return (
                          <div
                            key={`${res.url}-${i}`}
                            className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                          >
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                              title={res.title}
                            >
                              {res.title}
                            </a>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-xs ${fmtClass}`}
                            >
                              {res.format}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
