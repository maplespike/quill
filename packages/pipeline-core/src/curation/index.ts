// SPDX-License-Identifier: AGPL-3.0-only
export { CurationService, evaluateThresholds, calculateTrustScore, defaultCurationResult, defaultInsights, defaultBiasAnalysis } from './ai-gateway.js';
export { CURATION_PROMPT, INSIGHTS_PROMPT, BIAS_ANALYSIS_PROMPT } from './prompts.js';
export type { CurationResult, ArticleInsights, BiasAnalysis, CurationThresholds } from './scoring.js';
export type { AIGatewayConfig } from './ai-gateway.js';
export {
  ProviderRouter,
  getDefaultRouter,
  ProviderHealthChecker,
  CircuitBreaker,
  routeWithFallback,
  logProviderEvent,
} from './provider-router.js';
export type {
  ProviderHealth,
  ModelInfo,
  ProviderDefinition,
  ProviderState,
  ProviderRouterConfig,
  RouterStatus,
} from './provider-router.js';
