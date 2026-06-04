/**
 * OWASP-aligned security posture data for MapleSpike.
 *
 * Maps SECURITY.md threat vectors and controls to OWASP Top 10 (2021)
 * categories so the dashboard can show compliance status per category.
 *
 * This is static data derived from SECURITY.md — no API calls needed.
 */

export interface OwaspCategory {
  id: string;
  name: string;
  description: string;
  status: "active" | "partial" | "not-addressed";
  threats: ThreatEntry[];
  controls: ControlEntry[];
}

export interface ThreatEntry {
  threat: string;
  mitigation: string;
  status: string;
}

export interface ControlEntry {
  control: string;
  mechanism: string;
  enforcedBy: string;
}

// ── OWASP Top 10 (2021) mapping ──

export const owaspCategories: OwaspCategory[] = [
  {
    id: "A01",
    name: "Broken Access Control",
    description:
      "Restrictions on authenticated users are properly enforced — cluster network isolation, K8s RBAC, agenix secret gating.",
    status: "active",
    threats: [
      {
        threat: "Unauthorized cluster access",
        mitigation:
          "K3s on private network (10.1.1.0/24), Tailscale mesh for remote access",
        status: "Active",
      },
      {
        threat: "Pod escape / privilege escalation",
        mitigation:
          "K8s manifests validated by scripts/validate-k8s-manifests.sh in CI",
        status: "Active",
      },
    ],
    controls: [
      {
        control: "K8s manifest validation",
        mechanism: "Security/resource/schema validation on every PR",
        enforcedBy: ".github/workflows/ci.yml (k8s-manifests job)",
      },
    ],
  },
  {
    id: "A02",
    name: "Cryptographic Failures",
    description:
      "Sensitive data is encrypted at rest (agenix) and in transit (HTTPS). No secrets in frontend code.",
    status: "active",
    threats: [
      {
        threat: "Secret exposure",
        mitigation:
          "agenix-encrypted .age files, decrypted at deploy time only",
        status: "Active",
      },
      {
        threat: "API keys in frontend code",
        mitigation:
          "Portal is token-free — window.MAPLESPIKE.apiKey is empty by default",
        status: "Active",
      },
      {
        threat: "K8s Secret values in ConfigMaps",
        mitigation:
          "ConfigMaps used only for non-sensitive config; secrets use Secret resources",
        status: "Active",
      },
      {
        threat: "Secrets in source control",
        mitigation:
          "agenix encryption; CI checks for committed secrets via placeholder audit",
        status: "Active",
      },
    ],
    controls: [
      {
        control: "Placeholder/stub detection",
        mechanism: "audit-placeholders.mjs blocks merge on mock data",
        enforcedBy: ".github/workflows/ci.yml",
      },
    ],
  },
  {
    id: "A03",
    name: "Injection",
    description:
      "Deterministic parsers reject malformed input. No LLM in the pipeline eliminates prompt-injection vectors. CI validates PR diffs.",
    status: "active",
    threats: [
      {
        threat: "Prompt injection via issue body",
        mitigation:
          "CI validates PR diff; agent system prompts enforce context-first verification",
        status: "Active",
      },
      {
        threat: "Malicious or corrupted source data",
        mitigation:
          "Trust scoring (>=60% threshold), deterministic parsers reject malformed input",
        status: "Active",
      },
    ],
    controls: [
      {
        control: "PR validation",
        mechanism: "Branch naming, issue linking, conventional commits",
        enforcedBy: ".github/workflows/pr-validation.yml",
      },
    ],
  },
  {
    id: "A04",
    name: "Insecure Design",
    description:
      "Zero-LLM ingestion architecture eliminates entire attack classes. Source allowlist prevents privacy-sensitive data ingestion.",
    status: "active",
    threats: [
      {
        threat: "Ingestion of non-public or privacy-sensitive data",
        mitigation:
          "Source allowlist in registry.ts — only OGL-Canada or permissively licensed endpoints",
        status: "Active",
      },
    ],
    controls: [],
  },
  {
    id: "A05",
    name: "Security Misconfiguration",
    description:
      "Nix-built images ensure reproducible closures. Dockerfiles are prohibited in CI. Commit signing is enforced.",
    status: "active",
    threats: [
      {
        threat: "Legacy Docker image supply chain",
        mitigation: "CI forbids Dockerfiles — all images built via Nix",
        status: "Active",
      },
      {
        threat: "Unverified container images",
        mitigation: "Nix-built images with reproducible closures",
        status: "Active",
      },
    ],
    controls: [
      {
        control: "Dockerfile prohibition",
        mechanism: "CI fails on any legacy Dockerfile",
        enforcedBy: ".github/workflows/ci.yml",
      },
      {
        control: "Commit signing verification",
        mechanism: "CI checks every PR commit for GPG signature",
        enforcedBy: ".github/workflows/ci.yml",
      },
    ],
  },
  {
    id: "A06",
    name: "Vulnerable & Outdated Components",
    description:
      "Dependabot weekly scans across npm, docker, github-actions ecosystems. Major version bumps require manual review.",
    status: "active",
    threats: [
      {
        threat: "Compromised npm dependencies",
        mitigation:
          "Dependabot weekly scans (npm, docker, github-actions ecosystems)",
        status: "Active",
      },
      {
        threat: "Major version bumps introducing breaking changes",
        mitigation:
          "Auto-merge blocks major bumps — manual review required",
        status: "Active",
      },
      {
        threat: "Unpinned GitHub Actions",
        mitigation: "Dependabot monitors github-actions ecosystem weekly",
        status: "Active",
      },
    ],
    controls: [
      {
        control: "Dependabot automated updates",
        mechanism: "Weekly npm/github-actions, monthly docker",
        enforcedBy: ".github/dependabot.yml",
      },
    ],
  },
  {
    id: "A07",
    name: "Identification & Authentication Failures",
    description:
      "Cluster access gated by private network + Tailscale. CODEOWNERS requires approval on infrastructure paths.",
    status: "active",
    threats: [
      {
        threat: "Agent modifying security-sensitive files without review",
        mitigation:
          "CODEOWNERS requires @reverb256 approval on infrastructure paths",
        status: "Active",
      },
    ],
    controls: [
      {
        control: "PR validation",
        mechanism: "Branch naming, issue linking, conventional commits",
        enforcedBy: ".github/workflows/pr-validation.yml",
      },
    ],
  },
  {
    id: "A08",
    name: "Software & Data Integrity Failures",
    description:
      "SHA-256 citation hashes on every record. CI live-data-check validates endpoints. Documentation rot detection enforces freshness.",
    status: "active",
    threats: [
      {
        threat: "Government API compromise (MITM, DNS poisoning)",
        mitigation:
          "HTTPS enforcement, SHA-256 citation hashes on every record",
        status: "Active",
      },
      {
        threat: "Data drift (source changes schema silently)",
        mitigation:
          "CI live-data-check workflow validates endpoints on every push to main",
        status: "Active",
      },
    ],
    controls: [
      {
        control: "Metrics drift detection",
        mechanism: "Auto-generated metrics.json diff checked in CI",
        enforcedBy: ".github/workflows/ci.yml",
      },
      {
        control: "Documentation rot detection",
        mechanism:
          "TODO density check warns >5%; security docs enforce 0 TODOs",
        enforcedBy: ".github/workflows/docs-validation.yml",
      },
    ],
  },
  {
    id: "A09",
    name: "Security Logging & Monitoring Failures",
    description:
      "AI agent hallucination detection via CI guardrails. AI PR reviewer enforces zero-tolerance rules before merge.",
    status: "active",
    threats: [
      {
        threat: "AI agent fabricating completions (hallucinated PRs, reports)",
        mitigation:
          "CI guardrails: placeholder audit, metrics drift check, docs rot check",
        status: "Active",
      },
      {
        threat: "Kelos agent producing substandard code",
        mitigation:
          "AI PR reviewer (pr-reviewer kagent) enforces zero-tolerance rules before merge",
        status: "Active",
      },
    ],
    controls: [],
  },
  {
    id: "A10",
    name: "Server-Side Request Forgery (SSRF)",
    description:
      "Pipeline only ingests from government API allowlist. No user-controlled URL fetch. Egress restricted by K3s network policies.",
    status: "active",
    threats: [
      {
        threat: "Ingestion from unapproved sources",
        mitigation:
          "Source allowlist in registry.ts — only OGL-Canada or permissively licensed endpoints",
        status: "Active",
      },
    ],
    controls: [],
  },
];

// ── Summary stats ──

export function getOwaspSummary() {
  const total = owaspCategories.length;
  const active = owaspCategories.filter(
    (c) => c.status === "active"
  ).length;
  const partial = owaspCategories.filter(
    (c) => c.status === "partial"
  ).length;
  const notAddressed = owaspCategories.filter(
    (c) => c.status === "not-addressed"
  ).length;
  const totalThreats = owaspCategories.reduce(
    (sum, c) => sum + c.threats.length,
    0
  );
  const totalControls = owaspCategories.reduce(
    (sum, c) => sum + c.controls.length,
    0
  );
  const mitigatedThreats = owaspCategories.reduce(
    (sum, c) =>
      sum + c.threats.filter((t) => t.status === "Active").length,
    0
  );

  return {
    total,
    active,
    partial,
    notAddressed,
    totalThreats,
    totalControls,
    mitigatedThreats,
    complianceScore: total > 0 ? Math.round((active / total) * 100) : 0,
  };
}
