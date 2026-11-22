// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — API Gateway (Worker Entry)
 *
 * Cloudflare Workers fetch handler + Node.js dev server compatible.
 * Multi-tenant REST API gateway wrapping pipeline-core.
 *
 * Architecture:
 *   Request → Auth middleware → Rate limit → Route dispatch → Response envelope
 *
 * MapleSpike-quality response envelope with:
 *   - Quality meta (freshness, confidence, certainty)
 *   - Citation envelope
 *   - Token optimization params (_fields, _format, _limit, etc.)
 *   - Cache tracking (hit/miss)
 *   - Duration tracking
 */

import type { Env, RouteHandler, RouteContext, ApiResponse } from './types.js';
import { TIER_LIMITS, parseQueryOptions } from './types.js';
import type { QueryOptions } from './types.js';
import { authenticateRequest } from './auth.js';
import { enforceRateLimit } from './rate-limit.js';
import { isFreeTierRoute, isOperatorRoute } from './feature-gates.js';
import {
  buildError,
  buildSuccess,
  jsonResponse,
  corsPreflight,
  addRateLimitHeaders,
  applyCorsHeaders,
} from './response.js';
import type { BuildContext } from './response.js';
import { detectLocale, buildBilingualError } from './error-codes.js';
import { loadConfig, validateConfig } from './config.js';
import { D1Storage, KVCache, MemoryStorage, MemoryCache } from './storage.js';
import type { QuillStorage, QuillCache } from './types.js';
import { recordIngestion, getFreshness, getConfidence, getCertainty } from './freshness.js';
export type { ApiResponse } from './types.js';
export type { QueryOptions } from './types.js';
import { initEmailConfig } from './email.js';
import logger from './logger.js';
import { registerApiMetricRoute } from './metrics.js';

interface Route {
  pattern: RegExp;
  method: string;
  params: string[];
  handler: RouteHandler;
  /** Per-route cache TTL in seconds. Only GET routes with ttlSeconds > 0 are cached. */
  ttlSeconds?: number;
}

import { healthHandler } from './routes/health.js';
import { versionHandler } from './routes/version.js';
import { statusHandler } from './routes/status.js';
import { addAttributionHeader } from './middleware/attribution.js';
import { applySecurityHeaders } from './middleware/security-headers.js';
import { withRouteCache } from './middleware/cache-middleware.js';
import { complianceHandler } from './routes/compliance.js';
import { listReleasesHandler, searchGovHandler } from './routes/gov.js';
import { getCitationHandler, getVerifyClaimHandler, postVerifyClaimHandler, getLatestClaimsHandler } from './routes/citation.js';
import { auditQueryHandler } from './routes/audit.js';
import { auditGetHandler } from './routes/audit-get.js';
import { securityAuditSummaryHandler } from './routes/security-audit.js';
import { usageHandler } from './routes/usage.js';
import { llmsTxtHandler, llmsFullTxtHandler } from './routes/llms.js';
import { openApiHandler } from './routes/openapi.js';
import { listModulesHandler, exportModuleHandler } from './routes/export.js';
import { registerHandler, verifyHandler, meHandler } from './routes/register.js';
import { web3ChallengeHandler, web3LoginHandler } from './routes/auth-web3.js';
import { billingPlansHandler, billingOrderHandler, billingOrderStatusHandler, billingReconcileHandler, billingVerifyHandler, billingSeedPlansHandler } from './routes/billing.js';
import { taxStatusHandler, taxAdjustmentHandler } from './routes/tax-status.js';
import {
  stripeCheckoutHandler,
  stripeWebhookHandler,
  stripePortalHandler,
  stripeOrderStatusHandler,
  stripeStatusHandler,
  reconcileExpiryHandler,
} from './routes/billing-stripe.js';
import {
  listAnnotationsHandler, createAnnotationHandler, updateAnnotationHandler,
  deleteAnnotationHandler, exportAnnotationsHandler,
} from './routes/annotations.js';
import { initAnnotationStore } from './services/annotationService.js';
import { aiAskHandler, aiAnalyzeHandler } from './routes/ai.js';
import { aiSettingsGetHandler, aiSettingsUpdateHandler, resolveAIConfig } from './routes/ai-settings.js';
import {
  astralWeb3NonceHandler,
  astralWeb3VerifyHandler,
  astralWeb3ChainsHandler,
  astralFido2RegisterOptionsHandler,
  astralFido2RegisterVerifyHandler,
  astralFido2AuthOptionsHandler,
  astralFido2AuthVerifyHandler,
  astralHealthHandler,
  astralSolanaNonceHandler,
  astralSolanaVerifyHandler,
} from './routes/astral-proxy.js';
import {
  oauthProvidersHandler,
  oauthLoginHandler,
  oauthCallbackHandler,
  oauthExchangeHandler,
  legacyGithubLoginHandler,
} from './routes/auth-oauth.js';
import {
  passkeyRegisterBeginHandler,
  passkeyRegisterCompleteHandler,
  passkeyLoginBeginHandler,
  passkeyLoginCompleteHandler,
  passkeyListHandler,
  passkeyDeleteHandler,
} from './routes/auth-passkey.js';
// signalsHandler is lazy-loaded dynamically — see ROUTES
import { listKeysHandler, createKeyHandler, deleteKeyHandler, rotateKeyHandler } from './routes/keys.js';
import { onboardingHandler } from './routes/onboarding.js';
import { contactHandler } from './routes/contact.js';
import { energyDataHandler } from './routes/energy.js';
import { realEstateDataHandler } from './routes/real-estate.js';
import { finRegDataHandler, finRegCrossRefHandler } from './routes/financial-regulation.js';
import { watcherStatusHandler, watcherEventsHandler } from './routes/watcher.js';
import { watchCreateHandler, watchListHandler, watchDeleteHandler, watchEventsHandler } from './routes/watches.js';
import {
  webhookListHandler, webhookGetHandler, webhookCreateHandler,
  webhookUpdateHandler, webhookDeleteHandler, webhookTestHandler,
  webhookDeliveriesHandler,
} from './routes/webhooks.js';
import { entityResolveHandler, entityConnectionsHandler } from './routes/entity.js';
import { entityByIdHandler, entityLinksHandler } from './routes/entities-detail.js';
import { municipalDataHandler, municipalCityHandler, municipalCoverageHandler, municipalFacetsHandler, municipalHealthHandler, municipalSearchHandler } from './routes/municipal.js';
import { dataQualityHandler } from './routes/data-quality.js';
import { ingestStatusHandler } from './routes/ingest-status.js';
import { ingestReportHandler } from './routes/ingest-report.js';
import {
  refreshTokenHandler,
  logoutHandler,
  meHandler as authMeHandler,
} from './auth/github.js';
import {
  extractionTasksHandler,
  extractionResultsHandler,
  extractionCachedHandler,
} from './routes/extraction.js';
import { upstreamStatusHandler } from './routes/upstream-status.js';

export const ROUTES: Route[] = [
  { pattern: /^\/v1\/health\/?$/, method: 'GET', params: [], handler: withRouteCache(healthHandler, 30) },
  { pattern: /^\/v1\/version\/?$/, method: 'GET', params: [], handler: withRouteCache(versionHandler, 30) },
  { pattern: /^\/v1\/status\/?$/, method: 'GET', params: [], handler: withRouteCache(statusHandler, 30) },
  // Upstream health, read by the site banner. 15 s cache: the prober ticks once
  // a minute, and a banner may lag a few seconds without misleading anyone.
  { pattern: /^\/v1\/upstream\/status\/?$/, method: 'GET', params: [], handler: withRouteCache(upstreamStatusHandler, 15) },
  { pattern: /^\/v1\/compliance\/?$/, method: 'GET', params: [], handler: withRouteCache(complianceHandler, 3600) },
  { pattern: /^\/v1\/onboarding\/?$/, method: 'GET', params: [], handler: withRouteCache(onboardingHandler, 3600) },
  { pattern: /^\/v1\/contact\/?$/, method: 'POST', params: [], handler: contactHandler },
  { pattern: /^\/v1\/register\/?$/, method: 'POST', params: [], handler: registerHandler },
  { pattern: /^\/v1\/verify\/([^/]+)\/?$/, method: 'GET', params: ['token'], handler: verifyHandler },
  // NOTE: intentionally NOT wrapped in withRouteCache — /v1/me is tenant-scoped
  // (tenant identity + that tenant's usage) and the route cache keys on
  // method:path:search WITHOUT a tenant dimension, so the first caller's body
  // would be replayed to every other tenant for the whole TTL. Same reasoning
  // as /v1/entities/{id} below and /v1/usage.
  { pattern: /^\/v1\/me\/?$/, method: 'GET', params: [], handler: meHandler },
  { pattern: /^\/v1\/gov\/releases\/?$/, method: 'GET', params: [], handler: withRouteCache(listReleasesHandler, 3600) },
  { pattern: /^\/v1\/gov\/search\/?$/, method: 'GET', params: [], handler: withRouteCache(searchGovHandler, 300) },

  { pattern: /^\/v1\/citation\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: withRouteCache(getCitationHandler, 3600) },
  // Claim Stack WS-1f: independent claim verification
  { pattern: /^\/v1\/claims\/verify\/([^/]+)\/?$/, method: 'GET', params: ['hash'], handler: withRouteCache(getVerifyClaimHandler, 60) },
  { pattern: /^\/v1\/claims\/verify\/?$/, method: 'POST', params: [], handler: postVerifyClaimHandler },
  // Claims discovery (public): what has Quill attested recently?
  { pattern: /^\/v1\/claims\/latest\/?$/, method: 'GET', params: [], handler: withRouteCache(getLatestClaimsHandler, 60) },
  { pattern: /^\/v1\/audit\/query\/?$/, method: 'POST', params: [], handler: auditQueryHandler },
  { pattern: /^\/v1\/audit\/?$/, method: 'GET', params: [], handler: withRouteCache(auditGetHandler, 60) },
  // Live dependency security — runs pnpm audit server-side, falls back to static snapshot
  { pattern: /^\/v1\/security\/audit-summary\/?$/, method: 'GET', params: [], handler: withRouteCache(securityAuditSummaryHandler, 60) },
  // NOTE: intentionally NOT wrapped in withRouteCache — the body is the
  // calling key's OWN counters (#891) and the route cache keys on
  // method:path:search WITHOUT a tenant dimension, so tenant A's numbers
  // would be served to tenant B for the whole TTL. Self-scoped reads must be
  // computed per request.
  { pattern: /^\/v1\/usage\/?$/, method: 'GET', params: [], handler: usageHandler },
  // Billing
  { pattern: /^\/v1\/billing\/plans\/?$/, method: 'GET', params: [], handler: withRouteCache(billingPlansHandler, 3600) },
  { pattern: /^\/v1\/billing\/seed-plans\/?$/, method: 'POST', params: [], handler: billingSeedPlansHandler },
  { pattern: /^\/v1\/billing\/orders\/?$/, method: 'POST', params: [], handler: billingOrderHandler },
  { pattern: /^\/v1\/billing\/orders\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: billingOrderStatusHandler },
  { pattern: /^\/v1\/billing\/reconcile\/?$/, method: 'POST', params: [], handler: billingReconcileHandler },
  { pattern: /^\/v1\/billing\/verify\/?$/, method: 'POST', params: [], handler: billingVerifyHandler },
  // Stripe — Checkout / Webhook / Customer Portal (webhook is authExempt; see below)
  { pattern: /^\/v1\/billing\/stripe\/checkout\/?$/, method: 'POST', params: [], handler: stripeCheckoutHandler },
  { pattern: /^\/v1\/billing\/stripe\/webhook\/?$/, method: 'POST', params: [], handler: stripeWebhookHandler },
  { pattern: /^\/v1\/billing\/stripe\/portal\/?$/, method: 'POST', params: [], handler: stripePortalHandler },
  { pattern: /^\/v1\/billing\/stripe\/order\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: stripeOrderStatusHandler },
  { pattern: /^\/v1\/billing\/stripe\/status\/?$/, method: 'GET', params: [], handler: stripeStatusHandler },
  // STRIPE-1: cron reconciler — shared-secret auth (X-Billing-Secret); route-level authExempt false; handler enforces secret.
  { pattern: /^\/v1\/billing\/reconcile-expiry\/?$/, method: 'POST', params: [], handler: reconcileExpiryHandler },

  // #811 GST/HST tracker — operator routes (X-Billing-Secret enforced in-handler; bypass Free-tier gate via isOperatorRoute)
  { pattern: /^\/v1\/billing\/tax\/status\/?$/, method: 'GET', params: [], handler: taxStatusHandler },
  { pattern: /^\/v1\/billing\/tax\/adjustment\/?$/, method: 'POST', params: [], handler: taxAdjustmentHandler },

  // Extraction — client-side browser extraction system
  { pattern: /^\/v1\/extraction\/tasks\/?$/, method: 'GET', params: [], handler: withRouteCache(extractionTasksHandler, 300) },
  { pattern: /^\/v1\/extraction\/tasks\/([^/]+)\/?$/, method: 'GET', params: ['jurisdiction'], handler: withRouteCache(extractionTasksHandler, 300) },
  { pattern: /^\/v1\/extraction\/results\/?$/, method: 'POST', params: [], handler: extractionResultsHandler },
  { pattern: /^\/v1\/extraction\/cached\/([^/]+)\/?$/, method: 'GET', params: ['source_id'], handler: withRouteCache(extractionCachedHandler, 300) },


  // API Key Management
  { pattern: /^\/v1\/keys\/?$/, method: 'GET', params: [], handler: listKeysHandler },

  // Journalism — Annotations
  { pattern: /^\/v1\/annotations\/?$/, method: 'GET', params: [], handler: withRouteCache(listAnnotationsHandler, 60) },
  { pattern: /^\/v1\/annotations\/?$/, method: 'POST', params: [], handler: createAnnotationHandler },
  { pattern: /^\/v1\/annotations\/([^/]+)\/?$/, method: 'PATCH', params: ['id'], handler: updateAnnotationHandler },
  { pattern: /^\/v1\/annotations\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: deleteAnnotationHandler },
  { pattern: /^\/v1\/annotations\/export\/?$/, method: 'GET', params: [], handler: withRouteCache(exportAnnotationsHandler, 60) },
  // AI
  { pattern: /^\/v1\/ai_ask\/?$/, method: 'POST', params: [], handler: aiAskHandler }, // DEPRECATED: use /v1/ai/ask
  { pattern: /^\/v1\/ai\/ask\/?$/, method: 'POST', params: [], handler: aiAskHandler },
  { pattern: /^\/v1\/ai\/analyze\/?$/, method: 'POST', params: [], handler: aiAnalyzeHandler },
  { pattern: /^\/v1\/ai\/settings\/?$/, method: 'GET', params: [], handler: aiSettingsGetHandler },
  { pattern: /^\/v1\/ai\/settings\/?$/, method: 'PUT', params: [], handler: aiSettingsUpdateHandler },
  // Astral Key proxy — Web3 + FIDO2 via Astral Key microservice
  { pattern: /^\/v1\/astral\/health\/?$/, method: 'GET', params: [], handler: astralHealthHandler },
  { pattern: /^\/v1\/astral\/web3\/chains\/?$/, method: 'GET', params: [], handler: astralWeb3ChainsHandler },
  { pattern: /^\/v1\/astral\/web3\/nonce\/?$/, method: 'POST', params: [], handler: astralWeb3NonceHandler },
  { pattern: /^\/v1\/astral\/web3\/verify\/?$/, method: 'POST', params: [], handler: astralWeb3VerifyHandler },
  { pattern: /^\/v1\/astral\/fido2\/register\/options\/?$/, method: 'POST', params: [], handler: astralFido2RegisterOptionsHandler },
  { pattern: /^\/v1\/astral\/fido2\/register\/verify\/?$/, method: 'POST', params: [], handler: astralFido2RegisterVerifyHandler },
  { pattern: /^\/v1\/astral\/fido2\/authenticate\/options\/?$/, method: 'POST', params: [], handler: astralFido2AuthOptionsHandler },
  { pattern: /^\/v1\/astral\/fido2\/authenticate\/verify\/?$/, method: 'POST', params: [], handler: astralFido2AuthVerifyHandler },
  // Solana Web3 — direct Ed25519 signature verification (not proxied to Astral Key)
  { pattern: /^\/v1\/astral\/web3\/solana\/nonce\/?$/, method: 'POST', params: [], handler: astralSolanaNonceHandler },
  { pattern: /^\/v1\/astral\/web3\/solana\/verify\/?$/, method: 'POST', params: [], handler: astralSolanaVerifyHandler },
  { pattern: /^\/v1\/keys\/?$/, method: 'POST', params: [], handler: createKeyHandler },
  { pattern: /^\/v1\/keys\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: deleteKeyHandler },
  { pattern: /^\/v1\/keys\/([^/]+)\/rotate\/?$/, method: 'POST', params: ['id'], handler: rotateKeyHandler },
  { pattern: /^\/v1\/openapi\.json\/?$/, method: 'GET', params: [], handler: withRouteCache(openApiHandler, 3600) },
  { pattern: /^\/v1\/?$/, method: 'GET', params: [], handler: withRouteCache(openApiHandler, 3600) }, // Root redirect to spec
  // AI-visibility discovery surfaces (llms.txt standard) — public, machine-consumed
  { pattern: /^\/v1\/llms\.txt\/?$/, method: 'GET', params: [], handler: withRouteCache(llmsTxtHandler, 3600) },
  { pattern: /^\/v1\/llms-full\.txt\/?$/, method: 'GET', params: [], handler: withRouteCache(llmsFullTxtHandler, 3600) },

  // --- Auth routes ---
  // Generic OAuth
  { pattern: /^\/v1\/auth\/oauth\/providers\/?$/, method: 'GET', params: [], handler: withRouteCache(oauthProvidersHandler, 3600) },
  // NOTE: /exchange MUST precede the /:provider wildcard — the router takes
  // the first match, so the wildcard would otherwise swallow "exchange" as
  // a provider name (found live 2026-09-21: every browser OAuth login died
  // at redemption with OAUTH_PROVIDER_NOT_FOUND).
  { pattern: /^\/v1\/auth\/oauth\/exchange\/?$/, method: 'GET', params: [], handler: oauthExchangeHandler },
  // OAuth login/callback redirects — no cache (user-specific redirects)
  { pattern: /^\/v1\/auth\/oauth\/([^/]+)\/?$/, method: 'GET', params: ['provider'], handler: oauthLoginHandler },
  { pattern: /^\/v1\/auth\/oauth\/([^/]+)\/callback\/?$/, method: 'GET', params: ['provider'], handler: oauthCallbackHandler },
  // Legacy GitHub-specific URLs: both start the generic flow (the old
  // handler landed users anonymous on /me — see legacyGithubLoginHandler).
  { pattern: /^\/v1\/auth\/github\/?$/, method: 'GET', params: [], handler: legacyGithubLoginHandler },
  { pattern: /^\/v1\/auth\/github\/callback\/?$/, method: 'GET', params: [], handler: legacyGithubLoginHandler },
  { pattern: /^\/v1\/auth\/refresh\/?$/, method: 'POST', params: [], handler: refreshTokenHandler },
  { pattern: /^\/v1\/auth\/logout\/?$/, method: 'POST', params: [], handler: logoutHandler },
  { pattern: /^\/v1\/auth\/me\/?$/, method: 'GET', params: [], handler: withRouteCache(authMeHandler, 60) },
  // Web3 wallet auth
  { pattern: /^\/v1\/auth\/web3\/challenge\/?$/, method: 'POST', params: [], handler: web3ChallengeHandler },
  { pattern: /^\/v1\/auth\/web3\/login\/?$/, method: 'POST', params: [], handler: web3LoginHandler },
  // Passkey / WebAuthn auth
  { pattern: /^\/v1\/auth\/passkey\/register\/begin\/?$/, method: 'POST', params: [], handler: passkeyRegisterBeginHandler },
  { pattern: /^\/v1\/auth\/passkey\/register\/complete\/?$/, method: 'POST', params: [], handler: passkeyRegisterCompleteHandler },
  { pattern: /^\/v1\/auth\/passkey\/login\/begin\/?$/, method: 'POST', params: [], handler: passkeyLoginBeginHandler },
  { pattern: /^\/v1\/auth\/passkey\/login\/complete\/?$/, method: 'POST', params: [], handler: passkeyLoginCompleteHandler },
  { pattern: /^\/v1\/auth\/passkey\/credentials\/?$/, method: 'GET', params: [], handler: withRouteCache(passkeyListHandler, 60) },
  { pattern: /^\/v1\/auth\/passkey\/credentials\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: passkeyDeleteHandler },

  // Energy data
  { pattern: /^\/v1\/energy\/?$/, method: 'GET', params: [], handler: withRouteCache(energyDataHandler, 3600) },

  // Real estate data
  { pattern: /^\/v1\/real-estate\/?$/, method: 'GET', params: [], handler: withRouteCache(realEstateDataHandler, 3600) },

  // Financial regulation data
  { pattern: /^\/v1\/financial-regulation\/?$/, method: 'GET', params: [], handler: withRouteCache(finRegDataHandler, 3600) },
  { pattern: /^\/v1\/financial-regulation\/cross-reference\/?$/, method: 'GET', params: [], handler: withRouteCache(finRegCrossRefHandler, 3600) },

  // Municipal data
  // NOTE: facets, search, and coverage MUST be registered BEFORE the city
  // catch-all route — all four patterns can match '/v1/municipal/<word>'
  // literally and matchRoute returns the first regex hit. Reversing the
  // order would 404 coverage/facets/search and dispatch them as city=word.
  { pattern: /^\/v1\/municipal\/?$/, method: 'GET', params: [], handler: withRouteCache(municipalDataHandler, 3600) },
  { pattern: /^\/v1\/municipal\/facets\/?$/, method: 'GET', params: [], handler: withRouteCache(municipalFacetsHandler, 300) },
  { pattern: /^\/v1\/municipal\/search\/?$/, method: 'GET', params: [], handler: withRouteCache(municipalSearchHandler, 60) },
  { pattern: /^\/v1\/municipal\/coverage\/?$/, method: 'GET', params: [], handler: withRouteCache(municipalCoverageHandler, 60) },
  { pattern: /^\/v1\/municipal\/health\/?$/, method: 'GET', params: [], handler: withRouteCache(municipalHealthHandler, 60) },
  { pattern: /^\/v1\/municipal\/([^/]+)\/?$/, method: 'GET', params: ['city'], handler: withRouteCache(municipalCityHandler, 3600) },

  // Entity resolution
  { pattern: /^\/v1\/entity\/resolve\/?$/, method: 'POST', params: [], handler: entityResolveHandler },
  { pattern: /^\/v1\/entity\/connections\/?$/, method: 'GET', params: [], handler: withRouteCache(entityConnectionsHandler, 300) },
  // Entity composition surface — quill://entity/{id} scheme + linked_entities results
  // (WS-2 cross-reference hub exposed to non-MCP clients). links MUST be registered
  // before {id} — both patterns can match '/v1/entities/<word>'; matchRoute returns
  // the first regex hit, so ordering links first is safe either way.
  //
  // NOTE: intentionally NOT wrapped in withRouteCache — these routes are tier-gated
  // (Pro+/Business+) and the route cache keys on method:path:search WITHOUT a tenant
  // dimension, so a cached response from a higher-tier caller would bypass the gate
  // for a lower-tier caller (surfaced in live verification: a Pro-key call received
  // the cached internal-tier 200 instead of UPGRADE_REQUIRED). Tier gates must run
  // on every request.
  { pattern: /^\/v1\/entities\/([^/]+)\/links\/?$/, method: 'GET', params: ['id'], handler: entityLinksHandler },
  { pattern: /^\/v1\/entities\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: entityByIdHandler },

  // Watcher (real-time monitoring)
  { pattern: /^\/v1\/watcher\/status\/?$/, method: 'GET', params: [], handler: withRouteCache(watcherStatusHandler, 60) },
  { pattern: /^\/v1\/watcher\/events\/?$/, method: 'GET', params: [], handler: withRouteCache(watcherEventsHandler, 60) },

  // Watchlist alerts (watchlist-alerts-v1) — tenant-scoped, deliberately uncached.
  { pattern: /^\/v1\/watches\/?$/, method: 'GET', params: [], handler: watchListHandler },
  { pattern: /^\/v1\/watches\/?$/, method: 'POST', params: [], handler: watchCreateHandler },
  { pattern: /^\/v1\/watches\/([^/]+)\/events\/?$/, method: 'GET', params: ['id'], handler: watchEventsHandler },
  { pattern: /^\/v1\/watches\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: watchDeleteHandler },

  // Webhook notifications
  { pattern: /^\/v1\/webhooks\/?$/, method: 'GET', params: [], handler: withRouteCache(webhookListHandler, 60) },
  { pattern: /^\/v1\/webhooks\/?$/, method: 'POST', params: [], handler: webhookCreateHandler },
  { pattern: /^\/v1\/webhooks\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: withRouteCache(webhookGetHandler, 60) },
  { pattern: /^\/v1\/webhooks\/([^/]+)\/?$/, method: 'PATCH', params: ['id'], handler: webhookUpdateHandler },
  { pattern: /^\/v1\/webhooks\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: webhookDeleteHandler },
  { pattern: /^\/v1\/webhooks\/([^/]+)\/test\/?$/, method: 'POST', params: ['id'], handler: webhookTestHandler },
  { pattern: /^\/v1\/webhooks\/([^/]+)\/deliveries\/?$/, method: 'GET', params: ['id'], handler: withRouteCache(webhookDeliveriesHandler, 60) },
];

/**
 * Map route handler to a source name for freshness tracking.
 */
function getSourceName(handler: RouteHandler): string {
  if (handler === listReleasesHandler || handler === searchGovHandler) return 'open.canada.ca';
  // signals handler is dynamically loaded — not referenced here
  // Default source for freshness fallback
  return 'open.canada.ca';
}

function generateRequestId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return 'maplespike-' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Read a tenant's current monthly call count for the response envelope.
 *
 * Returns 0 when the storage read fails: a blocked request must still return
 * its 402 with the tier boundary intact, never a 500 caused by the
 * informational meta.usage summary.
 */
async function readPeriodCalls(db: QuillStorage, tenantId: string): Promise<number> {
  try {
    const yearMonth = new Date().toISOString().slice(0, 7);
    return await db.getMonthlyUsage(tenantId, yearMonth);
  } catch (err) {
    logger.warn(
      { errorType: err instanceof Error ? err.name : 'unknown' },
      'Usage read failed — meta.usage.periodCalls reported as 0',
    );
    return 0;
  }
}

// ── Pino structured logging for request lifecycle ──
// Logger already imported at line 40

// Signals route handler — lazy-loaded via eval to avoid tsc following cross-package imports
ROUTES.push({
  pattern: /^\/v1\/signals\/?$/,
  method: 'GET',
  params: [],
  handler: (async (req: Request, ctx: RouteContext, params: Record<string, string>) => {
    try {
      const mod = await import('./loaders/signals.js');
      return mod.signalsHandler(req, ctx, params);
    } catch {
      const bilingual = buildBilingualError('NOT_AVAILABLE');
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_AVAILABLE', message: bilingual.en, message_fr: bilingual.fr },
      }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
  }) as unknown as RouteHandler,
});

// Graph route handler — entity relationship graph from engine
ROUTES.push({
  pattern: /^\/v1\/graph\/?$/,
  method: 'GET',
  params: [],
  handler: (async (req: Request, ctx: RouteContext, params: Record<string, string>) => {
    try {
      const mod = await import('./loaders/graph.js');
      return mod.graphHandler(req, ctx, params);
    } catch {
      const bilingual = buildBilingualError('NOT_AVAILABLE');
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_AVAILABLE', message: bilingual.en, message_fr: bilingual.fr },
      }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
  }) as unknown as RouteHandler,
});

// Briefs route handler — daily intelligence briefs from engine
ROUTES.push({
  pattern: /^\/v1\/briefs\/?$/,
  method: 'GET',
  params: [],
  handler: (async (req: Request, ctx: RouteContext, params: Record<string, string>) => {
    try {
      const mod = await import('./loaders/briefs.js');
      return mod.briefsHandler(req, ctx, params);
    } catch {
      const bilingual = buildBilingualError('NOT_AVAILABLE');
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_AVAILABLE', message: bilingual.en, message_fr: bilingual.fr },
      }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
  }) as unknown as RouteHandler,
});

// Entities route handler — resolved persons + organizations
ROUTES.push({
  pattern: /^\/v1\/entities\/?$/,
  method: 'GET',
  params: [],
  handler: (async (req: Request, ctx: RouteContext, params: Record<string, string>) => {
    try {
      const mod = await import('./loaders/entities.js');
      return mod.entitiesHandler(req, ctx, params);
    } catch {
      const bilingual = buildBilingualError('NOT_AVAILABLE');
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_AVAILABLE', message: bilingual.en, message_fr: bilingual.fr },
      }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
  }) as unknown as RouteHandler,
});

// Engine status route — check if engine has run and data is available
import { engineStatusHandler } from './routes/engine-status.js';
ROUTES.push({
  pattern: /^\/v1\/engine\/status\/?$/,
  method: 'GET',
  params: [],
  handler: withRouteCache(engineStatusHandler, 300),
});

// Engine run route — trigger engine orchestrator
import { engineRunHandler } from './routes/engine-run.js';
ROUTES.push({
  pattern: /^\/v1\/engine\/run\/?$/,
  method: 'POST',
  params: [],
  handler: engineRunHandler,
});

// Export API — REST/JSON export for external clients
ROUTES.push(
  { pattern: /^\/v1\/export\/modules\/?$/, method: 'GET', params: [], handler: withRouteCache(listModulesHandler, 3600) },
  { pattern: /^\/v1\/export\/([^/]+)\/([^/]+)\/?$/, method: 'GET', params: ['module', 'id'], handler: withRouteCache(exportModuleHandler, 3600) },
  { pattern: /^\/v1\/export\/([^/]+)\/?$/, method: 'GET', params: ['module'], handler: withRouteCache(exportModuleHandler, 3600) },
);

// Data Quality Monitoring — feeds Grafana dashboard
ROUTES.push({
  // Internal: ingestion runs report outcomes for the freshness ledger (#889).
  pattern: /^\/v1\/internal\/ingest-report\/?$/,
  method: 'POST',
  params: [],
  handler: ingestReportHandler,
});

ROUTES.push({
  pattern: /^\/v1\/data\/quality\/?$/,
  method: 'GET',
  params: [],
  handler: withRouteCache(dataQualityHandler, 300),
});

// Ingest CronJob liveness — read by scripts/quill-health-check.sh so a stopped
// pipeline raises a stale-ingest alert instead of failing silently.
ROUTES.push({
  pattern: /^\/v1\/ingest\/status\/?$/,
  method: 'GET',
  params: [],
  handler: withRouteCache(ingestStatusHandler, 30),
});

function matchRoute(url: string, method: string): { route: Route; params: Record<string, string> } | null {
  const pathname = new URL(url, 'http://localhost').pathname;

  for (const route of ROUTES) {
    if (route.method !== method && method !== 'OPTIONS') continue;
    const match = pathname.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.params.forEach((name, i) => {
        params[name] = match[i + 1] || '';
      });
      return { route, params };
    }
  }

  return null;
}

/** Return a bounded route template for metrics, never a request path or ID. */
export function getMetricsRoute(pathname: string, method: string): string {
  const matched = matchRoute(pathname, method);
  if (!matched) return 'unmatched';

  let parameterIndex = 0;
  const template = matched.route.pattern.source
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replaceAll('\\/', '/')
    .replace(/\\\./g, '.')
    .replace(/\((?!\?)[^)]*\)/g, () => `:${matched.route.params[parameterIndex++] ?? 'param'}`)
    .replace(/\/\?$/, '');
  if (parameterIndex !== matched.route.params.length) return 'unmatched';
  return registerApiMetricRoute(template);
}

/**
 * Wrap a response with security headers and CORS headers.
 * Applied to ALL outgoing responses for defense-in-depth.
 */
function finalizeResponse(
  response: Response,
  environment?: string,
  requestOrigin: string | null | undefined = undefined,
): Response {
  const headers = new Headers(response.headers);
  applySecurityHeaders(headers, environment);
  applyCorsHeaders(headers, requestOrigin);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function handleRequest(
  request: Request,
  env: Record<string, string | undefined>,
  db: QuillStorage,
  cache: QuillCache,
): Promise<Response> {
  const config = loadConfig(env);
  const environment = config.environment || process.env.ENVIRONMENT;
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Initialise email config from env (SendGrid/console). Safe to call
  // multiple times — subsequent calls are idempotent.
  initEmailConfig(env);
  const url = new URL(request.url);
  const queryOptions = parseQueryOptions(url);
  const requestOrigin = request.headers.get('Origin');

  logger.info({ requestId, method: request.method }, 'Incoming request');

  // --- CORS preflight ---
  if (request.method === 'OPTIONS') {
    return finalizeResponse(corsPreflight(requestOrigin, environment), environment, requestOrigin);
  }

  // --- TLS redirect (defense-in-depth) ---
  // If Caddy/ingress sets X-Forwarded-Proto, verify it's HTTPS
  // 307 preserves the HTTP method and body through the redirect.
  const forwardedProto = request.headers.get('X-Forwarded-Proto');
  if (forwardedProto && forwardedProto !== 'https') {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = 'https:';
    return finalizeResponse(Response.redirect(httpsUrl.toString(), 307), environment, requestOrigin);
  }

  // --- Body size guard (P1#4) ---
  // Reject oversized bodies before they reach any handler. Content-Length
  // is the earliest signal; on Cloudflare Workers it reflects the actual
  // body size the runtime will stream. 1 MiB matches the portal proxy
  // (server.py:22) and the citation claim-verification route.
  const method = request.method;
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const cl = request.headers.get('content-length');
    if (cl !== null) {
      const bytes = parseInt(cl, 10);
      if (!isNaN(bytes) && bytes > 1_048_576) {
        logger.warn({ requestId, contentLength: bytes }, 'Payload too large — 413');
        return finalizeResponse(
          jsonResponse(buildError('PAYLOAD_TOO_LARGE', 'Request body exceeds the 1 MiB limit.', {
            tenant: { id: 'anon', name: 'Anonymous', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
            requestId,
            startTime,
            queryOptions,
            metaOverrides: { cacheStatus: 'miss', durationMs: Date.now() - startTime },
          }), 413, {}, requestOrigin, environment),
          environment, requestOrigin,
        );
      }
    }
  }

  // --- /health → /v1/health (308) ---
  // Kernel probes, k8s manifests, ops docs and third-party monitors cite
  // `/health`; the API's real liveness path is `/v1/health`, so `/health` used
  // to answer 404 NOT_FOUND (QUILL-AUDIT.md 2026-10-24, P2). 308 keeps the
  // method and the query string, and is cacheable — a redirect is a property
  // of the path, not of the request.
  if (url.pathname === '/health' || url.pathname === '/health/') {
    const target = new URL('/v1/health', url);
    target.search = url.search;
    return finalizeResponse(
      new Response(null, {
        status: 308,
        headers: { Location: target.toString(), 'Cache-Control': 'public, max-age=86400' },
      }),
      environment,
      requestOrigin,
    );
  }

  // --- /usage → /v1/usage (308) ---
  // Ops monitors and MCP tooling (system_health) reach for `/usage` first;
  // the real path is `/v1/usage`. Mirror the /health redirect so callers that
  // guess the short form never 404.
  if (url.pathname === '/usage' || url.pathname === '/usage/') {
    const target = new URL('/v1/usage', url);
    target.search = url.search;
    return finalizeResponse(
      new Response(null, {
        status: 308,
        headers: { Location: target.toString(), 'Cache-Control': 'public, max-age=86400' },
      }),
      environment,
      requestOrigin,
    );
  }

  const matched = matchRoute(request.url, request.method);
  if (!matched) {
    const durationMs = Date.now() - startTime;
    const ctx: BuildContext = {
      tenant: { id: 'anon', name: 'Anonymous', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
      requestId,
      startTime,
      queryOptions,
      metaOverrides: { cacheStatus: 'miss', durationMs },
    };
    logger.warn({ requestId, durationMs }, 'Route not found');
    return finalizeResponse(jsonResponse(buildError('NOT_FOUND', `No route matches ${request.method} ${new URL(request.url).pathname}`, ctx), 404, {}, undefined, environment), environment, requestOrigin);
  }

  const { route, params } = matched;

  // Authentication — exempt public routes by path (not handler identity,
  // because withRouteCache wraps handlers and breaks === comparison)
  const path = url.pathname;
  const authExempt =
    path.startsWith('/v1/health')
    || path.startsWith('/v1/version')
    || path.startsWith('/v1/status')
    // Upstream health is public observability: the site banner reads it before
    // sign-in. The payload carries host names and publisher copy only.
    || path.startsWith('/v1/upstream/status')
    || path.startsWith('/v1/compliance')
    || path.startsWith('/v1/onboarding')
    // gov/search is a PAID data route (a free tenant gets 402 by design), so it
    // must not be auth-exempt: an anonymous caller was being told to upgrade a
    // plan it does not have instead of being told to present a key.
    || path.startsWith('/v1/gov/releases')
    || path.startsWith('/v1/openapi')
    || path.startsWith('/v1/citation/')
    // Claim verification is a public trust primitive — anyone (journalists,
    // other MCP authors, downstream pipelines) must be able to re-verify a
    // SHA-256 without an API key. Same rationale as /v1/citation/ above.
    || path.startsWith('/v1/claims/verify')
    // Claim discovery is public too — the index of attested claims (hash +
    // provenance, no payloads) exists so the ecosystem can find something to
    // verify. Same trust-primitive rationale.
    || path.startsWith('/v1/claims/latest')
    || path.startsWith('/v1/llms')
    || path.startsWith('/v1/auth/')
    || path.startsWith('/v1/register')
    || path.startsWith('/v1/verify/')
    || path.startsWith('/v1/billing/plans')
    || path.startsWith('/v1/billing/stripe/webhook') // Stripe-signed events verified by HMAC; no bearer auth
    // stripe/status is intentionally NOT authExempt: configuration fingerprints
    // never leave authenticated contexts. Operators use dev tools / kubectl logs.
    || path.startsWith('/v1/contact')
    || path.startsWith('/v1/engine/status')
    || path.startsWith('/v1/data/quality')
    // Ingest liveness is public observability: the cluster health check reads
    // it without a key, and pipeline names + timestamps are not tenant data.
    || path.startsWith('/v1/ingest/status')
    || path.startsWith('/v1/security/') // currently only /v1/security/audit-summary (public observability); tighten if more routes added under /v1/security/ need auth
    || path.startsWith('/v1/ai/ask')
    || path.startsWith('/v1/ai_ask')
    || path.startsWith('/v1/astral/')
    // Internal service RPC (e.g. the ingest ledger). Guarded by its own signed
    // JWT check (X-Internal-Token, audience quill-internal) inside the handler —
    // never authorized by a customer key. Exempt from the public API-key gate so
    // the internal guard is what decides, not this one. A request without a valid
    // internal token still gets 401 from requireInternalAuth.
    || path.startsWith('/v1/internal/')
    ;

  // /v1/auth/me reports WHOSE credentials were presented, so it must resolve a
  // bearer key even though the rest of /v1/auth/* stays auth-exempt (login and
  // OAuth callbacks must be reachable with no credentials at all). Without
  // this, a caller holding a perfectly valid key was answered as the anon
  // tenant and saw no keys of its own.
  const identityRoute = path.startsWith('/v1/auth/me');
  const presentedBearer = /^Bearer\s+\S/i.test(request.headers.get('authorization') ?? '');
  const mustAuthenticate = !authExempt || (identityRoute && presentedBearer);

  const tenant = mustAuthenticate
    ? await authenticateRequest(request, db)
    : null;

  if (!tenant && mustAuthenticate) {
    const durationMs = Date.now() - startTime;
    const ctx: BuildContext = {
      tenant: { id: 'anon', name: 'Anonymous', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
      requestId,
      startTime,
      queryOptions,
      metaOverrides: { cacheStatus: 'miss', durationMs },
    };
    logger.warn({ requestId, durationMs }, 'Authentication failed');
    return finalizeResponse(jsonResponse(buildError('UNAUTHORIZED', 'Valid API key required. Get one at https://quill.maplespike.ca/signup', ctx), 401, {}, requestOrigin, environment), environment, requestOrigin);
  }

  const baseTenant = tenant?.tenant || { id: 'anon', name: 'Anonymous', emailVerified: false, tier: 'free', isActive: true, journalismMode: false };

  // ── Billing tier assignment ──
  // Override the DB tier with the most recent verified billing order, if any.
  // Phase 1 (DB persistence): the DB is the sole source of truth for tier.
  // The previous in-memory tenantTiers cache + getAssignedTier override is
  // removed. Both Stripe webhooks (routes/billing-stripe.ts) and the
  // e-Transfer verify path (routes/billing.ts) now persist tier via
  // ctx.db.updateTenantStripe, and authenticate() reads tenants.tier on
  // every request — no cache layer, no cross-channel override.
  const effectiveTenant = baseTenant;

  const ctx: RouteContext = {
    tenant: effectiveTenant,
    apiKeyId: tenant?.apiKeyId || '',
    requestId,
    startTime,
    env,
    db,
    cache,
  };

  // ── Free-tier boundary (decision #803) ──
  // Free = discovery/metadata only. Data queries + AI + tool execution are Pro+.
  // Single-place enforcement: anything not on the Free whitelist is blocked
  // for free tenants with UPGRADE_REQUIRED. (Pro+ gating per-route still
  // applies via canAccess for individual features.)
  if (ctx.tenant.tier === 'free' && !isFreeTierRoute(path) && !isOperatorRoute(path)) {
    // The 402 body is a Free tenant's window into its own consumption (#891).
    // Publish the tenant's real monthly count in meta.usage — a hardcoded
    // zero told every blocked customer they had used nothing.
    const periodCalls = await readPeriodCalls(db, ctx.tenant.id);
    const limits = TIER_LIMITS[ctx.tenant.tier] || TIER_LIMITS.free;
    const bc: BuildContext = {
      tenant: ctx.tenant,
      requestId,
      startTime,
      queryOptions,
      metaOverrides: {
        cacheStatus: 'miss',
        creditsCharged: 0,
        authMethod: tenant?.authMethod || 'api-key',
        durationMs: Date.now() - startTime,
        usage: {
          periodCalls,
          periodLimit: limits.monthly,
          tier: ctx.tenant.tier,
        },
      },
    };
    logger.warn({ requestId, tier: 'free' }, 'Free-tier route blocked (upgrade required)');
    await db.logAudit({
      tenantId: ctx.tenant.id,
      apiKeyId: ctx.apiKeyId,
      operation: 'free_tier_block',
      endpoint: path,
      outputSummary: 'Blocked: requires Pro+ (data query / AI / tools)',
      confidence: null,
      success: false,
      durationMs: Date.now() - startTime,
    });
    return finalizeResponse(
      jsonResponse(
        buildError(
          'UPGRADE_REQUIRED',
          'This endpoint requires a Pro or Business plan. The Free tier includes discovery & metadata only (catalog, citations, compliance). Upgrade at https://quill.maplespike.ca/pricing',
          bc,
        ),
        402,
        { 'Upgrade-Hint': 'pro' },
        requestOrigin,
        environment,
      ),
      environment,
      requestOrigin,
    );
  }

  // Determine auth method from the AuthResult
  const authMethod: string = tenant?.authMethod || 'api-key';
  const tier = ctx.tenant.tier;
  const creditsCharged = tier === 'free' ? 0 : 1;

  // Rate limit (skip for health, data quality, and spec)
  let rateCheck: { allowed: boolean; remaining: number; resetTime: number; reason?: 'burst' | 'daily' | 'monthly' } | null;
  if (!path.startsWith('/v1/health') && path !== '/v1/data/quality' && route.handler !== openApiHandler) {
    const isAuthenticated = tenant !== null;

    // Rate-limit key: authenticated → tenant ID; anonymous → IP-based for granularity
    let rateLimitKey: string;
    if (isAuthenticated) {
      rateLimitKey = ctx.tenant.id;
    } else {
      // Use client IP when available to prevent shared-throttle attacks on public endpoints.
      // Only trust proxy headers (X-Real-IP, X-Forwarded-For) when TRUST_PROXY is set,
      // because they are trivially spoofable by clients otherwise.
      const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';
      const cfIp = request.headers.get('CF-Connecting-IP');
      const realIp = request.headers.get('X-Real-IP');
      const forwardedFor = request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();

      let clientIp: string;
      if (cfIp) {
        clientIp = cfIp;
      } else if (realIp && trustProxy) {
        clientIp = realIp;
      } else if (forwardedFor && trustProxy) {
        clientIp = forwardedFor;
      } else {
        clientIp = 'anon';
      }
      rateLimitKey = `anon:${clientIp}`;
    }

    // Skip rate limiting for health endpoints to prevent kubelet probes from exhausting the burst budget
    if (url.pathname.startsWith('/v1/health') || url.pathname.startsWith('/v1/astral/health')) {
      // Health endpoints bypass all rate limiting
    } else {
    const check = await enforceRateLimit(db, ctx.tenant.id, ctx.tenant.tier, isAuthenticated, rateLimitKey);
    rateCheck = check;
    if (!check.allowed) {
      await db.logAudit({
        tenantId: ctx.tenant.id,
        apiKeyId: ctx.apiKeyId,
        operation: 'rate_limit',
        endpoint: route.pattern.source,
        outputSummary: `Rate limited (${check.reason})`,
        confidence: null,
        success: false,
        durationMs: Date.now() - startTime,
      });

      const bc: BuildContext = {
        tenant: ctx.tenant,
        requestId,
        startTime,
        queryOptions,
        metaOverrides: {
          cacheStatus: 'miss',
          creditsCharged,
          authMethod,
          durationMs: Date.now() - startTime,
        },
      };
      const retryAfter = rateCheck ? Math.ceil((rateCheck.resetTime - Date.now()) / 1000) : 60;
      let response = jsonResponse(buildError('RATE_LIMITED', `Rate limit exceeded (${check.reason}). Try again later.`, bc), 429, { 'Retry-After': String(Math.max(1, retryAfter)) }, undefined, environment);
      if (rateCheck) {
        response = addRateLimitHeaders(response, rateCheck);
      }
      addAttributionHeader(response);
      return finalizeResponse(response, environment, requestOrigin);
    }
    }
  }

  // ── Dispatch to matched route handler ──
  const response = await route.handler(request, ctx, params);
  return finalizeResponse(response, environment, requestOrigin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Support both Workers D1 and Node.js PG/SQLite backends
    const storageMode = (env.QUILL_STORAGE || process.env.QUILL_STORAGE || '').toLowerCase();
    const databaseUrl = env.DATABASE_URL || process.env.DATABASE_URL;

    let db: QuillStorage;
    let cache: QuillCache;

    if (storageMode === 'postgres' || databaseUrl || env.QUILL_DB_HOST || process.env.QUILL_DB_HOST) {
      // PostgreSQL mode — used in Node.js or when DATABASE_URL is provided
      const { PgStorage, PgCache } = await import('./pg-storage.js');
      const pgDb = new PgStorage(databaseUrl);
      await pgDb.init();
      db = pgDb;
      cache = new PgCache();
    } else if (storageMode === 'sqlite' || storageMode === 'node-sqlite' || process.env.QUILL_DB_PATH) {
      // Node built-in SQLite mode (no native compilation needed)
      const { NodeSqliteStorage, NodeSqliteCache } = await import('./node-sqlite-storage.js');
      db = new NodeSqliteStorage();
      cache = new NodeSqliteCache();
    } else if (env.DB) {
      // Cloudflare Workers D1 mode
      const d1 = new D1Storage(env.DB);
      await d1.applyLicenceMigrations();
      db = d1;
      cache = new KVCache(env.CACHE);
    } else {
      // Fallback to in-memory
      db = new MemoryStorage();
      cache = new MemoryCache();
    }

    initAnnotationStore(env.DB);
    const envVars: Record<string, string | undefined> = {
      ENVIRONMENT: env.ENVIRONMENT,
      QUILL_VERSION: env.QUILL_VERSION,
      MAPLESPIKE_NAME: env.QUILL_NAME,
      FREE_LIMIT: env.FREE_LIMIT,
      PRO_LIMIT: env.PRO_LIMIT,
      BUSINESS_LIMIT: env.BUSINESS_LIMIT,
      AI_ENDPOINT: env.AI_ENDPOINT,
      AI_MODEL: env.AI_MODEL,
      JWT_SECRET: env.JWT_SECRET,
      // Money mode and the key it must agree with (config.ts: validateStripeEnv).
      STRIPE_ENV: env.STRIPE_ENV,
      STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    };
    // Validate production config on every request (no startup lifecycle in Workers)
    try {
      validateConfig(envVars);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid configuration';
      const bilingual = buildBilingualError('CONFIG_ERROR');
      return finalizeResponse(new Response(JSON.stringify({ success: false, error: { code: 'CONFIG_ERROR', message: msg, message_fr: bilingual.fr } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }), env.ENVIRONMENT || process.env.ENVIRONMENT, request.headers.get('Origin'));
    }
    return handleRequest(request, envVars, db, cache);
  },
};
