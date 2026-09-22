// SPDX-License-Identifier: Apache-2.0
/**
 * Quill — Feature Gates
 *
 * Tier-based feature access enforcement. Every SaaS-gated feature checks
 * through this module so the gating logic lives in one place.
 *
 * Design principle (from SAAS-TIERING.md):
 *   - Community (self-hosted): everything in the repo, your problem to run
 *   - Free SaaS: public data, basic tools, capped quota
 *   - Pro: AI/RAG, full tools, developer console
 *   - Business: SSO, team seats, journalism mode, cross-reference reports
 *   - Enterprise: SAML, RBAC, SOC2, dedicated infra, custom modules
 *   - Internal: unrestricted (dev/ops bypass)
 */

import type { Tier } from './types.js';

// ─── Feature Gate Definitions ────────────────────────────────────────────

/**
 * Feature flags mapped to minimum tier required.
 * Use `canAccess(tier, feature)` to check at runtime.
 */
export const FEATURE_GATES = {
  // ── Data & Tools ──
  /** All 198 data modules (free SaaS has public subset only; Pro+ get all) */
  fullDataModules:   ['pro', 'business', 'enterprise', 'internal'] as Tier[],
  /** All 164 MCP tools */
  allMcpTools:       ['pro', 'business', 'enterprise', 'internal'] as Tier[],

  // ── AI ──
  /** RAG-powered AI queries (BYOK or MapleSpike credits) */
  aiRag:             ['pro', 'business', 'enterprise', 'internal'] as Tier[],
  /** AI analysis / cross-reference summarization */
  aiAnalyze:         ['pro', 'business', 'enterprise', 'internal'] as Tier[],

  // ── Platform ──
  /** Developer console with API key management UI */
  developerConsole:  ['pro', 'business', 'enterprise', 'internal'] as Tier[],
  /** Usage analytics dashboard */
  usageAnalytics:    ['business', 'enterprise', 'internal'] as Tier[],
  /** Entity cross-reference reports (lobbying ↔ committees ↔ procurement) */
  crossReferenceReports: ['business', 'enterprise', 'internal'] as Tier[],

  // ── Collaboration ──
  /** Team seats (multi-user accounts) */
  teamSeats:         ['business', 'enterprise', 'internal'] as Tier[],
  /** Journalism mode (verified press credentials → higher rate limits) */
  journalismMode:    ['business', 'enterprise', 'internal'] as Tier[],

  // ── Auth & Security ──
  /** GitHub / Google OAuth SSO */
  oauthSso:          ['business', 'enterprise', 'internal'] as Tier[],
  /** SAML / OIDC enterprise SSO */
  samlSso:           ['enterprise', 'internal'] as Tier[],
  /** Role-based access control */
  rbac:              ['enterprise', 'internal'] as Tier[],
  /** Audit logs (writable — all tiers get read-only audit trail) */
  auditLogsWrite:    ['enterprise', 'internal'] as Tier[],

  // ── Infrastructure ──
  /** Dedicated single-tenant K3s namespace */
  dedicatedInfra:    ['enterprise', 'internal'] as Tier[],
  /** Custom data modules / private ingestion */
  customModules:     ['enterprise', 'internal'] as Tier[],
  /** White-label portal */
  whiteLabel:        ['enterprise', 'internal'] as Tier[],
  /** On-premise deployment */
  onPremise:         ['enterprise', 'internal'] as Tier[],
  /** Commercial license (bypass AGPL for embedding) */
  commercialLicense: ['enterprise', 'internal'] as Tier[],

  // ── Support ──
  /** Priority support (< 8h response) */
  prioritySupport:   ['business', 'enterprise', 'internal'] as Tier[],
  /** Enterprise SLA (99.9% uptime, < 1h response) */
  enterpriseSla:     ['enterprise', 'internal'] as Tier[],
} as const;

export type FeatureGate = keyof typeof FEATURE_GATES;

// ─── Access Check ────────────────────────────────────────────────────────

/**
 * Returns true if the given tier has access to the named feature.
 *
 * @example
 *   if (!canAccess(tenant.tier, 'aiRag')) {
 *     return jsonResponse(buildError('UPGRADE_REQUIRED',
 *       'AI queries require Pro tier or higher', ctx), 402);
 *   }
 */
export function canAccess(tier: Tier, feature: FeatureGate): boolean {
  const allowedTiers = FEATURE_GATES[feature];
  return allowedTiers.includes(tier);
}

/**
 * Returns the minimum tier required for a feature.
 * Useful for error messages and upgrade prompts.
 */
export function minTierFor(feature: FeatureGate): Tier {
  const allowedTiers = FEATURE_GATES[feature];
  return allowedTiers[0];
}

/**
 * Returns all features available at the given tier.
 * Useful for capability discovery and self-serve plan comparison.
 */
export function featuresForTier(tier: Tier): FeatureGate[] {
  return (Object.entries(FEATURE_GATES) as [FeatureGate, readonly Tier[]][])
    .filter(([, tiers]) => tiers.includes(tier))
    .map(([feature]) => feature);
}

// ─── Rate Limit Helpers ──────────────────────────────────────────────────

/**
 * Returns whether the tier can self-host (community = no hosted API).
 * Free+ use the hosted SaaS API; community runs their own infra.
 */
export function isHostedTier(_tier: Tier): boolean {
  // All current tiers use the hosted SaaS API.
  // A future 'community' tier distinction may be added for self-hosted vs. hosted-free gating.
  return true;
}

// ─── Free Tier Boundary (decision #803) ─────────────────────────────────
//
// Free = DISCOVERY / METADATA ONLY. Actual data queries + AI + tool execution
// are Pro+. This whitelist is the single source of truth for what a Free
// tenant may call (per spec ADR: the Free/Pro line lives in ONE place).
//
// Allowed: health, version, spec, onboarding, catalog/compliance (metadata),
// citations, gov releases/list (discovery), billing portal/checkout/plans
// (so Free users can upgrade), auth/register/verify — including wallet and
// passkey auth via the /v1/astral proxy (auth must work on Free so users can
// sign up and log in), usage (see own limit), contact, security audit-summary
// (observability).
//
// Blocked: all data-query routes (gov/search, entity, energy, real-estate,
// financial-regulation, municipal, audit/query, watcher, extraction,
// annotations, AI, ai-settings), API-key management (keys), export, modules
// data — these require Pro+.

export const FREE_TIER_ALLOWED_PREFIXES: readonly string[] = [
  '/v1/health',
  '/v1/version',
  '/v1/onboarding',
  '/v1/compliance',
  '/v1/citation/',
  '/v1/claims/verify/',
  '/v1/claims/latest',
  '/v1/gov/releases',
  '/v1/billing/plans',
  '/v1/billing/stripe/checkout',
  '/v1/billing/stripe/portal',
  '/v1/billing/stripe/status',
  '/v1/billing/stripe/order',
  // Stripe calls this anonymously (HMAC-signed events); the Free-tier gate
  // must never block payment events (found 402'd on 2026-09-21).
  '/v1/billing/stripe/webhook',
  '/v1/billing/seed-plans',
  '/v1/auth/',
  '/v1/astral/web3/',
  '/v1/astral/fido2/',
  '/v1/astral/health',
  '/v1/register',
  '/v1/verify/',
  '/v1/usage',
  '/v1/contact',
  '/v1/security/audit-summary',
  '/v1/engine/status',
  '/v1/data/quality',
  // Ingestion liveness: the cluster health check reads it anonymously, and a
  // pipeline name + timestamp is cluster observability, not tenant data. The
  // route ships auth-exempt too (src/index.ts) — without this entry the Free
  // boundary 402'd it (found live on 2026-09-22).
  '/v1/ingest/status',
  '/v1/status',
  '/v1/openapi',
  // AI-discovery docs (llms.txt / llms-full.txt) — same class as openapi.
  '/v1/llms',
];

/**
 * Returns true if a Free-tier tenant is permitted to call `path`.
 * Anything not on the discovery/metadata whitelist is Pro+.
 */
export function isFreeTierRoute(path: string): boolean {
  return FREE_TIER_ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

// ─── Operator routes (shared-secret, not tenant surface) ────────────────
//
// These routes authenticate via X-Billing-Secret (operator/cron only) and
// are enforced inside their handlers. They must bypass the Free-tier gate —
// the cron caller is anonymous and would otherwise be 402'd by the Free
// boundary before its secret was ever checked (latent bug found while
// wiring #811: reconcile-expiry was already affected).

export const OPERATOR_ROUTE_PREFIXES: readonly string[] = [
  '/v1/billing/reconcile',
  '/v1/billing/reconcile-expiry',
  '/v1/billing/verify',
  '/v1/billing/tax/',
];

/** True for operator/cron routes (X-Billing-Secret enforced in-handler). */
export function isOperatorRoute(path: string): boolean {
  return OPERATOR_ROUTE_PREFIXES.some((p) => path.startsWith(p));
}

// ─── Tier Metadata ───────────────────────────────────────────────────────

export const TIER_METADATA: Record<Tier, { name: string; description: string; isSelfHosted: boolean }> = {
  free: {
    name: 'Free',
    description: 'Hosted API — 1,000 calls/month. Discovery & metadata only (catalog, citations, compliance). Data queries + AI require Pro.',
    isSelfHosted: false,
  },
  pro: {
    name: 'Pro',
    description: 'Researchers & journalists — AI/RAG, full tools, 50K calls/month',
    isSelfHosted: false,
  },
  business: {
    name: 'Business',
    description: 'Think tanks & newsrooms — SSO, team seats, journalism mode, 250K calls/month',
    isSelfHosted: false,
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Government & compliance — SAML, RBAC, SOC2, dedicated infra, custom modules',
    isSelfHosted: false,
  },
  internal: {
    name: 'Internal',
    description: 'Unrestricted dev/ops access — bypasses all gates',
    isSelfHosted: true,
  },
};
