import { useState } from "react";
import { owaspCategories, getOwaspSummary } from "../../lib/owaspData";
import type { OwaspCategory } from "../../lib/owaspData";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";

function StatusIcon({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10 text-green-500">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/10 text-yellow-500">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01" />
        </svg>
      </span>
    );
  }
  return (
    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10 text-red-500">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
}

function CategoryCard({
  category,
  expanded,
  onToggle,
}: {
  category: OwaspCategory;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusLabel =
    category.status === "active"
      ? "Mitigated"
      : category.status === "partial"
        ? "Partial"
        : "Not Addressed";

  const statusClass =
    category.status === "active"
      ? "bg-green-500/10 text-green-500 border-green-500/20"
      : category.status === "partial"
        ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
        : "bg-red-500/10 text-red-500 border-red-500/20";

  return (
    <Card class="cursor-pointer transition-shadow hover:shadow-md" onClick={onToggle}>
      <CardHeader class="pb-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <StatusIcon status={category.status} />
            <CardTitle class="text-base">
              <span class="text-muted-foreground mr-1">{category.id}</span>{" "}
              {category.name}
            </CardTitle>
          </div>
          <div class="flex items-center gap-2">
            <Badge class={statusClass}>{statusLabel}</Badge>
            <span class="text-xs text-muted-foreground">
              {category.threats.length} threat{category.threats.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {!expanded && (
          <CardDescription class="mt-1">{category.description}</CardDescription>
        )}
      </CardHeader>

      {expanded && (
        <CardContent class="pt-0 space-y-4">
          <p class="text-sm text-muted-foreground">{category.description}</p>

          {category.threats.length > 0 && (
            <div class="space-y-2">
              <h4 class="text-sm font-semibold">Threats and Mitigations</h4>
              {category.threats.map((t, i) => (
                <div key={i} class="rounded-lg border p-3 text-sm space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="font-medium">{t.threat}</span>
                    <Badge variant="outline" class="text-xs">
                      {t.status}
                    </Badge>
                  </div>
                  <p class="text-muted-foreground">{t.mitigation}</p>
                </div>
              ))}
            </div>
          )}

          {category.controls.length > 0 && (
            <div class="space-y-2">
              <h4 class="text-sm font-semibold">Enforced Controls</h4>
              {category.controls.map((c, i) => (
                <div key={i} class="rounded-lg border p-3 text-sm space-y-1">
                  <span class="font-medium">{c.control}</span>
                  <p class="text-muted-foreground">{c.mechanism}</p>
                  <p class="text-xs text-muted-foreground">
                    Enforced by: <code class="rounded bg-muted px-1 py-0.5">{c.enforcedBy}</code>
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function OwaspDashboard() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const summary = getOwaspSummary();

  return (
    <>
      {/* Summary cards */}
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">OWASP Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">{summary.complianceScore}%</p>
            <p class="text-xs text-muted-foreground">
              {summary.active}/{summary.total} categories mitigated
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">Total Threats</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">{summary.totalThreats}</p>
            <p class="text-xs text-muted-foreground">
              {summary.mitigatedThreats} with active mitigations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">CI Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">{summary.totalControls}</p>
            <p class="text-xs text-muted-foreground">automated enforcements</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">Zero-LLM Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold text-green-500">Active</p>
            <p class="text-xs text-muted-foreground">
              deterministic parsers only
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Threat vector breakdown */}
      <h2 class="text-xl font-semibold mb-4">
        OWASP Top 10 (2021) - Security Posture
      </h2>
      <p class="text-sm text-muted-foreground mb-6">
        Each category maps MapleSpike threat vectors and controls from{" "}
        <code class="rounded bg-muted px-1 py-0.5">SECURITY.md</code> to the
        corresponding OWASP classification. Click a category to expand details.
      </p>

      <div class="space-y-3 mb-8">
        {owaspCategories.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            expanded={expandedId === cat.id}
            onToggle={() =>
              setExpandedId(expandedId === cat.id ? null : cat.id)
            }
          />
        ))}
      </div>

      {/* Architecture note */}
      <Card class="border-green-500/20 bg-green-500/5">
        <CardContent class="py-4">
          <div class="flex items-start gap-3">
            <StatusIcon status="active" />
            <div>
              <h3 class="font-semibold text-sm">
                Zero-LLM Ingestion Architecture
              </h3>
              <p class="text-sm text-muted-foreground mt-1">
                MapleSpike's ingestion pipeline uses zero LLMs. All parsing is
                deterministic (CSV, JSON-stat, XML, JSON). This eliminates
                entire classes of prompt-injection and model-hallucination
                attack surfaces from the data pipeline itself. LLMs are
                reserved for user-facing reasoning only.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
