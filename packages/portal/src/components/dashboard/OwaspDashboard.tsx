/**
 * OWASP LLM Top 10 Compliance Dashboard
 *
 * Displays security posture across OWASP LLM Top 10 categories.
 * Styled via Tailwind to match the MapleSpike portal design system.
 */
import * as React from "react";

interface CheckItem {
  description: string;
  status: "pass" | "fail" | "partial" | "na";
}

interface OWASPCategory {
  id: string;
  name: string;
  description: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  status: "pass" | "fail" | "partial";
  checkItems: CheckItem[];
}

const statusMeta = {
  pass: { label: "Pass", color: "bg-green-500/15 text-green-400 border-green-500/25" },
  fail: { label: "Fail", color: "bg-red-500/15 text-red-400 border-red-500/25" },
  partial: { label: "Partial", color: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
} as const;

const severityMeta = {
  Critical: "bg-red-600 text-white",
  High: "bg-orange-500 text-white",
  Medium: "bg-amber-500 text-white",
  Low: "bg-green-600 text-white",
} as const;

const checkIcon: Record<string, string> = {
  pass: "✅",
  fail: "❌",
  partial: "⚠️",
  na: "➖",
};

const owaspCategories: OWASPCategory[] = [
  {
    id: "LLM01", name: "Prompt Injection",
    description: "Prompt injection vulnerabilities when malicious users craft inputs that manipulate the LLM to execute unintended actions, bypass controls, or access restricted information.",
    severity: "Critical", status: "partial",
    checkItems: [
      { description: "Input sanitization for user prompts", status: "partial" },
      { description: "Output filtering for code execution", status: "pass" },
      { description: "Context window isolation", status: "pass" },
      { description: "Jailbreak detection", status: "fail" },
    ],
  },
  {
    id: "LLM02", name: "Insecure Output Handling",
    description: "LLM output not validated or sanitized before being used to control downstream components or systems.",
    severity: "High", status: "pass",
    checkItems: [
      { description: "Output type validation", status: "pass" },
      { description: "SQL injection prevention", status: "pass" },
      { description: "XSS prevention in web responses", status: "pass" },
      { description: "Code execution sandboxing", status: "na" },
    ],
  },
  {
    id: "LLM03", name: "Training Data Poisoning",
    description: "Malicious actors manipulate training data or fine-tuning processes to introduce vulnerabilities, backdoors, or biased behavior.",
    severity: "Critical", status: "pass",
    checkItems: [
      { description: "Source data provenance tracking", status: "pass" },
      { description: "Data integrity verification", status: "pass" },
      { description: "Unauthorized modification detection", status: "pass" },
      { description: "Training pipeline audit logging", status: "pass" },
    ],
  },
  {
    id: "LLM04", name: "Model Denial of Service",
    description: "Resource exhaustion attacks targeting the LLM or its infrastructure, causing degraded performance or unavailability.",
    severity: "High", status: "partial",
    checkItems: [
      { description: "Rate limiting per user", status: "pass" },
      { description: "Context window limits", status: "pass" },
      { description: "GPU resource quotas", status: "partial" },
      { description: "Request throttling", status: "pass" },
    ],
  },
  {
    id: "LLM05", name: "Supply Chain Vulnerabilities",
    description: "Compromises in the LLM supply chain, including models, datasets, libraries, or infrastructure.",
    severity: "High", status: "pass",
    checkItems: [
      { description: "Model source verification", status: "pass" },
      { description: "Dependency vulnerability scanning", status: "pass" },
      { description: "Signed model artifacts", status: "pass" },
      { description: "Vendor SBOM requirements", status: "pass" },
    ],
  },
  {
    id: "LLM06", name: "Sensitive Information Disclosure",
    description: "LLMs may inadvertently reveal sensitive information, including training data or user-provided confidential data.",
    severity: "Medium", status: "partial",
    checkItems: [
      { description: "PII detection and redaction", status: "partial" },
      { description: "Training data confidentiality", status: "pass" },
      { description: "Prompt data encryption at rest", status: "pass" },
      { description: "Audit log review", status: "fail" },
    ],
  },
  {
    id: "LLM07", name: "Insecure Plugin Design",
    description: "Vulnerabilities in plugin architectures or tool calling mechanisms that allow unauthorized actions or data access.",
    severity: "High", status: "pass",
    checkItems: [
      { description: "Plugin permission boundaries", status: "pass" },
      { description: "Tool input validation", status: "pass" },
      { description: "Authorization checks per tool", status: "pass" },
      { description: "Plugin sandboxing", status: "na" },
    ],
  },
  {
    id: "LLM08", name: "Excessive Agency",
    description: "LLMs may take actions beyond their intended scope, causing unintended consequences.",
    severity: "High", status: "partial",
    checkItems: [
      { description: "Action allowlist enforcement", status: "partial" },
      { description: "Human-in-the-loop for sensitive operations", status: "pass" },
      { description: "Goal constraint validation", status: "pass" },
      { description: "Tool use logging", status: "pass" },
    ],
  },
  {
    id: "LLM09", name: "Overreliance",
    description: "Users may place excessive trust in LLM outputs without verification, leading to errors or security issues.",
    severity: "Low", status: "fail",
    checkItems: [
      { description: "Citation provenance tracking", status: "pass" },
      { description: "Confidence scoring", status: "fail" },
      { description: "Human verification prompts", status: "fail" },
      { description: "Hallucination detection", status: "fail" },
    ],
  },
  {
    id: "LLM10", name: "Model Theft",
    description: "Unauthorized access to or exfiltration of proprietary models, fine-tuned weights, or training data.",
    severity: "Medium", status: "pass",
    checkItems: [
      { description: "Model artifact encryption", status: "pass" },
      { description: "Access controls on model storage", status: "pass" },
      { description: "Exfiltration monitoring", status: "pass" },
      { description: "Watermarking for model identification", status: "pass" },
    ],
  },
];

export default function OwaspDashboard() {
  const passCount = owaspCategories.filter((c) => c.status === "pass").length;
  const partialCount = owaspCategories.filter((c) => c.status === "partial").length;
  const failCount = owaspCategories.filter((c) => c.status === "fail").length;
  const criticalCount = owaspCategories.filter(
    (c) => c.severity === "Critical" && c.status !== "pass"
  ).length;
  const highCount = owaspCategories.filter(
    (c) => c.severity === "High" && c.status !== "pass"
  ).length;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          OWASP <span className="text-gradient">Compliance</span>
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Security posture assessment based on OWASP Top 10 for LLM Applications (2023)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Categories", value: owaspCategories.length, color: "text-foreground" },
          { label: "Passing", value: passCount, color: "text-green-400" },
          { label: "Partial", value: partialCount, color: "text-amber-400" },
          { label: "Failing", value: failCount, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5">
            <div className="text-sm text-muted-foreground">{s.label}</div>
            <div className={`mt-1 text-3xl font-bold tracking-tight ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Severity Alert */}
      {(criticalCount > 0 || highCount > 0) && (
        <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <h2 className="text-lg font-semibold text-red-300">⚠️ Attention Required</h2>
          <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-red-200/80">
            {criticalCount > 0 && (
              <li>{criticalCount} Critical severity item(s) need immediate action</li>
            )}
            {highCount > 0 && (
              <li>{highCount} High severity item(s) should be addressed soon</li>
            )}
          </ul>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-5">
        {owaspCategories.map((cat) => (
          <div key={cat.id} className="rounded-xl border bg-card p-6">
            {/* Head */}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-semibold">
                    {cat.id}: {cat.name}
                  </h3>
                  <span
                    className={`rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                      severityMeta[cat.severity]
                    }`}
                  >
                    {cat.severity}
                  </span>
                  <span
                    className={`rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                      statusMeta[cat.status].color
                    }`}
                  >
                    {statusMeta[cat.status].label}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {cat.description}
                </p>
              </div>
            </div>

            {/* Checklist */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Checklist ({cat.checkItems.length} items)
              </h4>
              <div className="space-y-1.5">
                {cat.checkItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-3.5 py-2.5"
                  >
                    <span className="text-base">{checkIcon[item.status] || "➖"}</span>
                    <span className="text-sm text-foreground/80">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-border/60 pt-6">
        <p className="text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString("en-CA")}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Reference:{" "}
          <a
            href="https://owasp.org/www-project-top-10-for-large-language-model-applications/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            OWASP Top 10 for Large Language Model Applications
          </a>
        </p>
      </footer>
    </div>
  );
}
