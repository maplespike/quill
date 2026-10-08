// SPDX-License-Identifier: Apache-2.0
/**
 * Quill — Route Registry
 *
 * Owns the route table and the mapping from an incoming request to one entry:
 * pattern, method, handler, and the auth the route requires (`Route.auth`).
 * Listed routes are the API's shape; the gateway (index.ts) orchestrates
 * requests and request-policy.ts decides what a request must present.
 */

import type { RouteContext, RouteHandler } from './types.js';
import { buildBilingualError } from './error-codes.js';
import { registerApiMetricRoute } from './metrics.js';
import { healthHandler } from './routes/health.js';
import { versionHandler } from './routes/version.js';
import { statusHandler } from './routes/status.js';
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
import { aiAskHandler, aiAnalyzeHandler } from './routes/ai.js';
import { aiSettingsGetHandler, aiSettingsUpdateHandler } from './routes/ai-settings.js';
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
  githubLoginHandler,
  githubCallbackHandler,
  refreshTokenHandler,
  logoutHandler,
  meHandler as authMeHandler,
} from './auth/github.js';
import {
  extractionTasksHandler,
  extractionResultsHandler,
  extractionCachedHandler,
} from './routes/extraction.js';


export interface Route {
  pattern: RegExp;
  method: string;
  params: string[];
  handler: RouteHandler;
  /**
   * Who must authenticate a request to this route. Omitted means 'key': the
   * gateway requires a tenant API key and answers 401 without a valid one.
   *
   * - 'public'  — no credentials at all (health, docs, signup, public data).
   * - 'handler' — the handler enforces its own credential (signed event, signed
   *               internal token, operator shared secret), so the key gate never
   *               runs and the handler is the one that rejects.
   *
   * Declared with the route, never inferred from handler identity, so wrapping a
   * handler cannot change a route's auth.
   */
  auth?: 'key' | 'public' | 'handler';
}
export const ROUTES: Route[] = [
  { pattern: /^\/v1\/health\/?$/, method: 'GET', params: [], handler: withRouteCache(healthHandler, 30), auth: 'public' },
  { pattern: /^\/v1\/version\/?$/, method: 'GET', params: [], handler: withRouteCache(versionHandler, 30), auth: 'public' },
  { pattern: /^\/v1\/status\/?$/, method: 'GET', params: [], handler: withRouteCache(statusHandler, 30), auth: 'public' },
  { pattern: /^\/v1\/compliance\/?$/, method: 'GET', params: [], handler: withRouteCache(complianceHandler, 3600), auth: 'public' },
  { pattern: /^\/v1\/onboarding\/?$/, method: 'GET', params: [], handler: withRouteCache(onboardingHandler, 3600), auth: 'public' },
  { pattern: /^\/v1\/contact\/?$/, method: 'POST', params: [], handler: contactHandler, auth: 'public' },
  { pattern: /^\/v1\/register\/?$/, method: 'POST', params: [], handler: registerHandler, auth: 'public' },
  { pattern: /^\/v1\/verify\/([^/]+)\/?$/, method: 'GET', params: ['token'], handler: verifyHandler, auth: 'public' },
  // NOTE: intentionally NOT wrapped in withRouteCache — /v1/me is tenant-scoped
  // (tenant identity + that tenant's usage) and the route cache keys on
  // method:path:search WITHOUT a tenant dimension, so the first caller's body
  // would be replayed to every other tenant for the whole TTL. Same reasoning
  // as /v1/entities/{id} below and /v1/usage.
  { pattern: /^\/v1\/me\/?$/, method: 'GET', params: [], handler: meHandler },
  { pattern: /^\/v1\/gov\/releases\/?$/, method: 'GET', params: [], handler: withRouteCache(listReleasesHandler, 3600), auth: 'public' },
  // Deliberately key-gated: an anonymous caller must be told to present a key,
  // not told to upgrade a plan it does not have.
  { pattern: /^\/v1\/gov\/search\/?$/, method: 'GET', params: [], handler: withRouteCache(searchGovHandler, 300) },

  { pattern: /^\/v1\/citation\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: withRouteCache(getCitationHandler, 3600), auth: 'public' },
  // Claim Stack WS-1f: independent claim verification
  { pattern: /^\/v1\/claims\/verify\/([^/]+)\/?$/, method: 'GET', params: ['hash'], handler: withRouteCache(getVerifyClaimHandler, 60), auth: 'public' },
  { pattern: /^\/v1\/claims\/verify\/?$/, method: 'POST', params: [], handler: postVerifyClaimHandler, auth: 'public' },
  // Claims discovery (public): what has Quill attested recently?
  { pattern: /^\/v1\/claims\/latest\/?$/, method: 'GET', params: [], handler: withRouteCache(getLatestClaimsHandler, 60), auth: 'public' },
  { pattern: /^\/v1\/audit\/query\/?$/, method: 'POST', params: [], handler: auditQueryHandler },
  { pattern: /^\/v1\/audit\/?$/, method: 'GET', params: [], handler: withRouteCache(auditGetHandler, 60) },
  // Live dependency security — runs pnpm audit server-side, falls back to static snapshot
  { pattern: /^\/v1\/security\/audit-summary\/?$/, method: 'GET', params: [], handler: withRouteCache(securityAuditSummaryHandler, 60), auth: 'public' },
  // NOTE: intentionally NOT wrapped in withRouteCache — the body is the
  // calling key's OWN counters (#891) and the route cache keys on
  // method:path:search WITHOUT a tenant dimension, so tenant A's numbers
  // would be served to tenant B for the whole TTL. Self-scoped reads must be
  // computed per request.
  { pattern: /^\/v1\/usage\/?$/, method: 'GET', params: [], handler: usageHandler },
  // Billing
  { pattern: /^\/v1\/billing\/plans\/?$/, method: 'GET', params: [], handler: withRouteCache(billingPlansHandler, 3600), auth: 'public' },
  { pattern: /^\/v1\/billing\/seed-plans\/?$/, method: 'POST', params: [], handler: billingSeedPlansHandler },
  { pattern: /^\/v1\/billing\/orders\/?$/, method: 'POST', params: [], handler: billingOrderHandler },
  { pattern: /^\/v1\/billing\/orders\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: billingOrderStatusHandler },
  { pattern: /^\/v1\/billing\/reconcile\/?$/, method: 'POST', params: [], handler: billingReconcileHandler },
  { pattern: /^\/v1\/billing\/verify\/?$/, method: 'POST', params: [], handler: billingVerifyHandler },
  // Stripe — Checkout / Webhook / Customer Portal (the webhook verifies its own
  // HMAC signature, so it is auth: 'handler' below)
  { pattern: /^\/v1\/billing\/stripe\/checkout\/?$/, method: 'POST', params: [], handler: stripeCheckoutHandler },
  { pattern: /^\/v1\/billing\/stripe\/webhook\/?$/, method: 'POST', params: [], handler: stripeWebhookHandler, auth: 'handler' },
  { pattern: /^\/v1\/billing\/stripe\/portal\/?$/, method: 'POST', params: [], handler: stripePortalHandler },
  { pattern: /^\/v1\/billing\/stripe\/order\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: stripeOrderStatusHandler },
  // Deliberately key-gated: configuration fingerprints never leave authenticated
  // contexts. Operators use dev tools / kubectl logs.
  { pattern: /^\/v1\/billing\/stripe\/status\/?$/, method: 'GET', params: [], handler: stripeStatusHandler },
  // STRIPE-1: cron reconciler — shared-secret auth (X-Billing-Secret) enforced in-handler.
  { pattern: /^\/v1\/billing\/reconcile-expiry\/?$/, method: 'POST', params: [], handler: reconcileExpiryHandler, auth: 'handler' },

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
  { pattern: /^\/v1\/ai_ask\/?$/, method: 'POST', params: [], handler: aiAskHandler, auth: 'public' }, // DEPRECATED: use /v1/ai/ask
  { pattern: /^\/v1\/ai\/ask\/?$/, method: 'POST', params: [], handler: aiAskHandler, auth: 'public' },
  { pattern: /^\/v1\/ai\/analyze\/?$/, method: 'POST', params: [], handler: aiAnalyzeHandler },
  { pattern: /^\/v1\/ai\/settings\/?$/, method: 'GET', params: [], handler: aiSettingsGetHandler },
  { pattern: /^\/v1\/ai\/settings\/?$/, method: 'PUT', params: [], handler: aiSettingsUpdateHandler },
  // Astral Key proxy — Web3 + FIDO2 via Astral Key microservice
  { pattern: /^\/v1\/astral\/health\/?$/, method: 'GET', params: [], handler: astralHealthHandler, auth: 'public' },
  { pattern: /^\/v1\/astral\/web3\/chains\/?$/, method: 'GET', params: [], handler: astralWeb3ChainsHandler, auth: 'public' },
  { pattern: /^\/v1\/astral\/web3\/nonce\/?$/, method: 'POST', params: [], handler: astralWeb3NonceHandler, auth: 'public' },
  { pattern: /^\/v1\/astral\/web3\/verify\/?$/, method: 'POST', params: [], handler: astralWeb3VerifyHandler, auth: 'public' },
  { pattern: /^\/v1\/astral\/fido2\/register\/options\/?$/, method: 'POST', params: [], handler: astralFido2RegisterOptionsHandler, auth: 'public' },
  { pattern: /^\/v1\/astral\/fido2\/register\/verify\/?$/, method: 'POST', params: [], handler: astralFido2RegisterVerifyHandler, auth: 'public' },
  { pattern: /^\/v1\/astral\/fido2\/authenticate\/options\/?$/, method: 'POST', params: [], handler: astralFido2AuthOptionsHandler, auth: 'public' },
  { pattern: /^\/v1\/astral\/fido2\/authenticate\/verify\/?$/, method: 'POST', params: [], handler: astralFido2AuthVerifyHandler, auth: 'public' },
  // Solana Web3 — direct Ed25519 signature verification (not proxied to Astral Key)
  { pattern: /^\/v1\/astral\/web3\/solana\/nonce\/?$/, method: 'POST', params: [], handler: astralSolanaNonceHandler, auth: 'public' },
  { pattern: /^\/v1\/astral\/web3\/solana\/verify\/?$/, method: 'POST', params: [], handler: astralSolanaVerifyHandler, auth: 'public' },
  { pattern: /^\/v1\/keys\/?$/, method: 'POST', params: [], handler: createKeyHandler },
  { pattern: /^\/v1\/keys\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: deleteKeyHandler },
  { pattern: /^\/v1\/keys\/([^/]+)\/rotate\/?$/, method: 'POST', params: ['id'], handler: rotateKeyHandler },
  { pattern: /^\/v1\/openapi\.json\/?$/, method: 'GET', params: [], handler: withRouteCache(openApiHandler, 3600), auth: 'public' },
  { pattern: /^\/v1\/?$/, method: 'GET', params: [], handler: withRouteCache(openApiHandler, 3600) }, // Root redirect to spec
  // AI-visibility discovery surfaces (llms.txt standard) — public, machine-consumed
  { pattern: /^\/v1\/llms\.txt\/?$/, method: 'GET', params: [], handler: withRouteCache(llmsTxtHandler, 3600), auth: 'public' },
  { pattern: /^\/v1\/llms-full\.txt\/?$/, method: 'GET', params: [], handler: withRouteCache(llmsFullTxtHandler, 3600), auth: 'public' },

  // --- Auth routes ---
  // Generic OAuth
  { pattern: /^\/v1\/auth\/oauth\/providers\/?$/, method: 'GET', params: [], handler: withRouteCache(oauthProvidersHandler, 3600), auth: 'public' },
  // NOTE: /exchange MUST precede the /:provider wildcard — the router takes
  // the first match, so the wildcard would otherwise swallow "exchange" as
  // a provider name (found live 2026-09-21: every browser OAuth login died
  // at redemption with OAUTH_PROVIDER_NOT_FOUND).
  { pattern: /^\/v1\/auth\/oauth\/exchange\/?$/, method: 'GET', params: [], handler: oauthExchangeHandler, auth: 'public' },
  // OAuth login/callback redirects — no cache (user-specific redirects)
  { pattern: /^\/v1\/auth\/oauth\/([^/]+)\/?$/, method: 'GET', params: ['provider'], handler: oauthLoginHandler, auth: 'public' },
  { pattern: /^\/v1\/auth\/oauth\/([^/]+)\/callback\/?$/, method: 'GET', params: ['provider'], handler: oauthCallbackHandler, auth: 'public' },
  // Legacy GitHub-specific (kept for backward compat)
  { pattern: /^\/v1\/auth\/github\/?$/, method: 'GET', params: [], handler: githubLoginHandler, auth: 'public' },
  { pattern: /^\/v1\/auth\/github\/callback\/?$/, method: 'GET', params: [], handler: githubCallbackHandler, auth: 'public' },
  { pattern: /^\/v1\/auth\/refresh\/?$/, method: 'POST', params: [], handler: refreshTokenHandler, auth: 'public' },
  { pattern: /^\/v1\/auth\/logout\/?$/, method: 'POST', params: [], handler: logoutHandler, auth: 'public' },
  { pattern: /^\/v1\/auth\/me\/?$/, method: 'GET', params: [], handler: withRouteCache(authMeHandler, 60), auth: 'public' },
  // Web3 wallet auth
  { pattern: /^\/v1\/auth\/web3\/challenge\/?$/, method: 'POST', params: [], handler: web3ChallengeHandler, auth: 'public' },
  { pattern: /^\/v1\/auth\/web3\/login\/?$/, method: 'POST', params: [], handler: web3LoginHandler, auth: 'public' },
  // Passkey / WebAuthn auth
  { pattern: /^\/v1\/auth\/passkey\/register\/begin\/?$/, method: 'POST', params: [], handler: passkeyRegisterBeginHandler, auth: 'public' },
  { pattern: /^\/v1\/auth\/passkey\/register\/complete\/?$/, method: 'POST', params: [], handler: passkeyRegisterCompleteHandler, auth: 'public' },
  { pattern: /^\/v1\/auth\/passkey\/login\/begin\/?$/, method: 'POST', params: [], handler: passkeyLoginBeginHandler, auth: 'public' },
  { pattern: /^\/v1\/auth\/passkey\/login\/complete\/?$/, method: 'POST', params: [], handler: passkeyLoginCompleteHandler, auth: 'public' },
  { pattern: /^\/v1\/auth\/passkey\/credentials\/?$/, method: 'GET', params: [], handler: withRouteCache(passkeyListHandler, 60), auth: 'public' },
  { pattern: /^\/v1\/auth\/passkey\/credentials\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: passkeyDeleteHandler, auth: 'public' },

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
  auth: 'public',
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
  // The handler verifies a signed JWT (X-Internal-Token, audience quill-internal).
  pattern: /^\/v1\/internal\/ingest-report\/?$/,
  method: 'POST',
  params: [],
  handler: ingestReportHandler,
  auth: 'handler',
});

ROUTES.push({
  pattern: /^\/v1\/data\/quality\/?$/,
  method: 'GET',
  params: [],
  handler: withRouteCache(dataQualityHandler, 300),
  auth: 'public',
});

// Ingest CronJob liveness — read by scripts/quill-health-check.sh so a stopped
// pipeline raises a stale-ingest alert instead of failing silently.
ROUTES.push({
  pattern: /^\/v1\/ingest\/status\/?$/,
  method: 'GET',
  params: [],
  handler: withRouteCache(ingestStatusHandler, 30),
  auth: 'public',
});


export function matchRoute(url: string, method: string): { route: Route; params: Record<string, string> } | null {
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
