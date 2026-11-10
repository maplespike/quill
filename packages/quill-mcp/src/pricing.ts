// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill MCP tool pricing configuration for x402 (Solana USDC) micropayments.
 *
 * Defines a static pricing map for all ~175+ tools, categorized into tiers:
 *   free — $0.00  (discovery, metadata, health)
 *   micro — $0.001 (single lookups)
 *   standard — $0.01 (searches and queries)
 *   premium — $0.10 (complex operations, AI)
 *   enterprise — $1.00 (bulk / pipeline)
 *
 * Gated behind X402_ENABLED env var in the middleware layer.
 */

export type PriceTier = 'free' | 'micro' | 'standard' | 'premium' | 'enterprise';

export interface ToolPrice {
  tier: PriceTier;
  priceUsd: number;
}

/**
 * Static pricing map. Keys are exact tool names or trailing-glob patterns
 * (e.g. 'search-*' matches any tool starting with 'search-').
 * Exact match wins over glob; first glob match wins among globs.
 */
const PRICE_MAP: Record<string, ToolPrice> = {
  // ── Free tools — discovery, metadata, health ─────────────────────
  'list_tools':           { tier: 'free', priceUsd: 0 },
  'explore-catalog':      { tier: 'free', priceUsd: 0 },
  'verify-claim':         { tier: 'free', priceUsd: 0 }, // trust primitive — always free
  'verify_claim':         { tier: 'free', priceUsd: 0 }, // underscore-named variant (tool registry names)
  'cache-status':         { tier: 'free', priceUsd: 0 },
  'system-health':        { tier: 'free', priceUsd: 0 },
  'get-module-health':    { tier: 'free', priceUsd: 0 },
  'get-pipeline-health':  { tier: 'free', priceUsd: 0 },
  'searxng-health':       { tier: 'free', priceUsd: 0 },
  'qa-schema':            { tier: 'free', priceUsd: 0 },
  'qa-validate-module':   { tier: 'free', priceUsd: 0 },

  // ── Micro ($0.001) — single entity lookups ─────────────────────
  'get-entity-profile':   { tier: 'micro', priceUsd: 0.001 },
  'get-citation':         { tier: 'micro', priceUsd: 0.001 },
  'resolve-entity':       { tier: 'micro', priceUsd: 0.001 },
  // Composition hub — cross-registry evidence. Registry names are
  // underscore-kebab (linked_entities); price both spellings so the paid
  // tier actually applies (getToolPrice falls back to DEFAULT_PRICE on miss).
  'linked-entities':      { tier: 'premium', priceUsd: 0.10 },
  'linked_entities':      { tier: 'premium', priceUsd: 0.10 },
  'get-annotations':      { tier: 'micro', priceUsd: 0.001 },
  'get-member-info':      { tier: 'micro', priceUsd: 0.001 },
  'get-politician-influence': { tier: 'micro', priceUsd: 0.001 },

  // ── Standard ($0.01) — searches and queries ────────────────────
  'query-gov-data':       { tier: 'standard', priceUsd: 0.01 },
  'search-canlii':        { tier: 'standard', priceUsd: 0.01 },
  'search-gazette':       { tier: 'standard', priceUsd: 0.01 },
  'search-legislation':   { tier: 'standard', priceUsd: 0.01 },
  'search-statcan':       { tier: 'standard', priceUsd: 0.01 },
  'search-debates':       { tier: 'standard', priceUsd: 0.01 },
  'search-committees':    { tier: 'standard', priceUsd: 0.01 },
  'search-corporate':     { tier: 'standard', priceUsd: 0.01 },
  'search-influence':     { tier: 'standard', priceUsd: 0.01 },
  'search-gic':           { tier: 'standard', priceUsd: 0.01 },
  'search-elections':     { tier: 'standard', priceUsd: 0.01 },
  'search-oversight':     { tier: 'standard', priceUsd: 0.01 },
  'search-lmia':          { tier: 'standard', priceUsd: 0.01 },
  'search-immigration':   { tier: 'standard', priceUsd: 0.01 },
  'search-indigenous':    { tier: 'standard', priceUsd: 0.01 },
  'search-criminal-justice': { tier: 'standard', priceUsd: 0.01 },
  'search-transport':     { tier: 'standard', priceUsd: 0.01 },
  'search-defence':       { tier: 'standard', priceUsd: 0.01 },
  'search-science':       { tier: 'standard', priceUsd: 0.01 },
  'search-tribunals':     { tier: 'standard', priceUsd: 0.01 },
  'search-lode':          { tier: 'standard', priceUsd: 0.01 },
  'search-veterans':      { tier: 'standard', priceUsd: 0.01 },
  'search-ngo-rss':       { tier: 'standard', priceUsd: 0.01 },
  'search-narrative-tracker': { tier: 'standard', priceUsd: 0.01 },
  'search-health':        { tier: 'standard', priceUsd: 0.01 },
  'search-ilo':           { tier: 'standard', priceUsd: 0.01 },
  'search-proactive-disclosure': { tier: 'standard', priceUsd: 0.01 },
  'search-ati':           { tier: 'standard', priceUsd: 0.01 },
  'search-federal-budget': { tier: 'standard', priceUsd: 0.01 },
  'search-goc-spending':  { tier: 'standard', priceUsd: 0.01 },
  'search-municipal':     { tier: 'standard', priceUsd: 0.01 },
  'search-global-canada': { tier: 'standard', priceUsd: 0.01 },
  'search-health-canada': { tier: 'standard', priceUsd: 0.01 },
  'search-impact-assessment': { tier: 'standard', priceUsd: 0.01 },
  'search-species-at-risk': { tier: 'standard', priceUsd: 0.01 },
  'search-fisheries':     { tier: 'standard', priceUsd: 0.01 },
  'search-agriculture':   { tier: 'standard', priceUsd: 0.01 },
  'search-crown-corporations': { tier: 'standard', priceUsd: 0.01 },
  'search-charity-t3010': { tier: 'standard', priceUsd: 0.01 },
  'search-bank-of-canada': { tier: 'standard', priceUsd: 0.01 },
  'search-housing-cmhc':  { tier: 'standard', priceUsd: 0.01 },
  'search-crtc-decisions': { tier: 'standard', priceUsd: 0.01 },
  'search-social-programs': { tier: 'standard', priceUsd: 0.01 },
  'search-education-research': { tier: 'standard', priceUsd: 0.01 },
  'search-a2aj':          { tier: 'standard', priceUsd: 0.01 },
  'search-ab-data':       { tier: 'standard', priceUsd: 0.01 },
  'search-arcgis-layers': { tier: 'standard', priceUsd: 0.01 },
  'search-bc-data':       { tier: 'standard', priceUsd: 0.01 },
  'search-bills':         { tier: 'standard', priceUsd: 0.01 },
  'search-cipo':          { tier: 'standard', priceUsd: 0.01 },
  'search-cmhc':          { tier: 'standard', priceUsd: 0.01 },
  'search-committees-op': { tier: 'standard', priceUsd: 0.01 },
  'search-corporate-filings': { tier: 'standard', priceUsd: 0.01 },
  'search-cra-charity':   { tier: 'standard', priceUsd: 0.01 },
  'search-crtc':          { tier: 'standard', priceUsd: 0.01 },
  'search-culture':       { tier: 'standard', priceUsd: 0.01 },
  'search-geospatial':    { tier: 'standard', priceUsd: 0.01 },
  'search-ircc-citizenship': { tier: 'standard', priceUsd: 0.01 },
  'search-ircc-entry-exit': { tier: 'standard', priceUsd: 0.01 },
  'search-ircc-express-entry': { tier: 'standard', priceUsd: 0.01 },
  'search-ircc-family-sponsorship': { tier: 'standard', priceUsd: 0.01 },
  'search-ircc-pr-admissions': { tier: 'standard', priceUsd: 0.01 },
  'search-ircc-processing-times': { tier: 'standard', priceUsd: 0.01 },
  'search-ircc-study-permits': { tier: 'standard', priceUsd: 0.01 },
  'search-ircc-work-permits': { tier: 'standard', priceUsd: 0.01 },
  'search-knowledge-fabric': { tier: 'standard', priceUsd: 0.01 },
  'search-libraries':     { tier: 'standard', priceUsd: 0.01 },
  'search-municipal-data': { tier: 'standard', priceUsd: 0.01 },
  'search-npri':          { tier: 'standard', priceUsd: 0.01 },
  'search-nrcan':         { tier: 'standard', priceUsd: 0.01 },
  'search-nunavut-data':  { tier: 'standard', priceUsd: 0.01 },
  'search-on-data':       { tier: 'standard', priceUsd: 0.01 },
  'search-yukon-data':    { tier: 'standard', priceUsd: 0.01 },
  'search-parks':         { tier: 'standard', priceUsd: 0.01 },
  'search-provincial-data': { tier: 'standard', priceUsd: 0.01 },
  'search-provincial-legislatures': { tier: 'standard', priceUsd: 0.01 },
  'search-provincial-regulators': { tier: 'standard', priceUsd: 0.01 },
  'search-qc-data':       { tier: 'standard', priceUsd: 0.01 },
  'search-real-time-feeds': { tier: 'standard', priceUsd: 0.01 },
  'search-regional-authorities': { tier: 'standard', priceUsd: 0.01 },
  'search-sedi':          { tier: 'standard', priceUsd: 0.01 },
  'search-un':            { tier: 'standard', priceUsd: 0.01 },
  'search-unions':        { tier: 'standard', priceUsd: 0.01 },
  'search-universities':  { tier: 'standard', priceUsd: 0.01 },
  'search-provincial-lobbying': { tier: 'standard', priceUsd: 0.01 },
  'search-pharmaceuticals': { tier: 'standard', priceUsd: 0.01 },
  'search-telecommunications': { tier: 'standard', priceUsd: 0.01 },
  'search-real-estate':   { tier: 'standard', priceUsd: 0.01 },
  'search-emergency-management': { tier: 'standard', priceUsd: 0.01 },
  'search-indigenous-services-directory': { tier: 'standard', priceUsd: 0.01 },
  'search-policing-security': { tier: 'standard', priceUsd: 0.01 },
  'search-financial-regulation': { tier: 'standard', priceUsd: 0.01 },
  'search-media-broadcasting': { tier: 'standard', priceUsd: 0.01 },
  'search-municipal-long-tail': { tier: 'standard', priceUsd: 0.01 },
  'search-provincial-orgs': { tier: 'standard', priceUsd: 0.01 },
  'search-cross-reference': { tier: 'standard', priceUsd: 0.01 },
  'search-nrcan-renewable': { tier: 'standard', priceUsd: 0.01 },
  'search-nrcan-fires':   { tier: 'standard', priceUsd: 0.01 },
  'search-nrcan-forests': { tier: 'standard', priceUsd: 0.01 },
  'search-nrcan-minerals': { tier: 'standard', priceUsd: 0.01 },
  'search-oecd-stat':     { tier: 'standard', priceUsd: 0.01 },
  'search-undp-hdi':      { tier: 'standard', priceUsd: 0.01 },
  'search-unhcr-refugees': { tier: 'standard', priceUsd: 0.01 },
  'search-us-cia':        { tier: 'standard', priceUsd: 0.01 },
  'search-au-abs':        { tier: 'standard', priceUsd: 0.01 },
  'search-nz-stats':      { tier: 'standard', priceUsd: 0.01 },
  'search-uk-ons':        { tier: 'standard', priceUsd: 0.01 },
  'search-who-gho':       { tier: 'standard', priceUsd: 0.01 },
  'search-eurostat':      { tier: 'standard', priceUsd: 0.01 },
  'search-utilities':     { tier: 'standard', priceUsd: 0.01 },
  'search-votes':         { tier: 'standard', priceUsd: 0.01 },
  'query-bridges':        { tier: 'standard', priceUsd: 0.01 },
  'query-cpi':            { tier: 'standard', priceUsd: 0.01 },
  'query-gdp':            { tier: 'standard', priceUsd: 0.01 },
  'query-labour':         { tier: 'standard', priceUsd: 0.01 },
  'query-population':     { tier: 'standard', priceUsd: 0.01 },
  'query-trade':          { tier: 'standard', priceUsd: 0.01 },
  'latest-releases':      { tier: 'standard', priceUsd: 0.01 },

  // Underscore-named legacy search tools
  'search_energy_data':       { tier: 'standard', priceUsd: 0.01 },
  'search_climate_data':      { tier: 'standard', priceUsd: 0.01 },
  'search_public_safety':     { tier: 'standard', priceUsd: 0.01 },
  'search_federal_contracts': { tier: 'standard', priceUsd: 0.01 },
  'search_federal_grants':    { tier: 'standard', priceUsd: 0.01 },
  'search_gender_stats':      { tier: 'standard', priceUsd: 0.01 },
  'search_housing_data':      { tier: 'standard', priceUsd: 0.01 },
  'search_mining_data':       { tier: 'standard', priceUsd: 0.01 },
  'search_official_languages': { tier: 'standard', priceUsd: 0.01 },
  'search_technology_data':   { tier: 'standard', priceUsd: 0.01 },
  'search_patents':           { tier: 'standard', priceUsd: 0.01 },
  'search_trademarks':        { tier: 'standard', priceUsd: 0.01 },
  'search_agriculture_data':  { tier: 'standard', priceUsd: 0.01 },
  'search_citizenship_data':  { tier: 'standard', priceUsd: 0.01 },
  'search_corporate_registry': { tier: 'standard', priceUsd: 0.01 },
  'search_culture_data':      { tier: 'standard', priceUsd: 0.01 },
  'search_education_stats':   { tier: 'standard', priceUsd: 0.01 },
  'search_gazette_part1':     { tier: 'standard', priceUsd: 0.01 },
  'search_gazette_part2':     { tier: 'standard', priceUsd: 0.01 },
  'search_gazette_part3':     { tier: 'standard', priceUsd: 0.01 },
  'search_immigration_refugees': { tier: 'standard', priceUsd: 0.01 },
  'search_indigenous_stats':  { tier: 'standard', priceUsd: 0.01 },
  'search_transportation_data': { tier: 'standard', priceUsd: 0.01 },

  // WDI adapter tools
  'wdi-indicator':            { tier: 'standard', priceUsd: 0.01 },
  'wdi-compare-countries':    { tier: 'standard', priceUsd: 0.01 },
  'wdi-country-profile':      { tier: 'standard', priceUsd: 0.01 },
  'wdi-trend':                { tier: 'standard', priceUsd: 0.01 },
  'wdi-topic':                { tier: 'standard', priceUsd: 0.01 },
  'wdi-metadata':             { tier: 'standard', priceUsd: 0.01 },

  // Comtrade adapter tools
  'comtrade-by-partner':      { tier: 'standard', priceUsd: 0.01 },
  'comtrade-by-commodity':    { tier: 'standard', priceUsd: 0.01 },
  'comtrade-trends':          { tier: 'standard', priceUsd: 0.01 },

  // ── Premium ($0.10) — complex operations, AI ────────────────────
  'smart-search':         { tier: 'premium', priceUsd: 0.10 },
  'fact-check':           { tier: 'premium', priceUsd: 0.10 },
  'find-connections':     { tier: 'premium', priceUsd: 0.10 },
  'ai-analyze':           { tier: 'premium', priceUsd: 0.10 },
  'ai-ask':               { tier: 'premium', priceUsd: 0.10 },
  'ai-search-semantic':   { tier: 'premium', priceUsd: 0.10 },
  'compare-regions':      { tier: 'premium', priceUsd: 0.10 },
  'cache-clear':          { tier: 'premium', priceUsd: 0.10 },

  // ── Enterprise ($1.00) — bulk / pipeline ────────────────────────
  'track-bill':           { tier: 'enterprise', priceUsd: 1.00 },
  'signal-check':         { tier: 'enterprise', priceUsd: 1.00 },
};

/**
 * Default price for tools not explicitly listed (standard).
 */
const DEFAULT_PRICE: ToolPrice = { tier: 'standard', priceUsd: 0.01 };

/**
 * Resolve the price for a given tool name.
 *
 * MCP tool registry names are underscore-kebab (resolve_entity, fact_check,
 * track_bill) while PRICE_MAP keys are kebab-case (resolve-entity,
 * fact-check, track-bill). Normalize the lookup so the intended tier
 * actually applies — otherwise underscore-named tools silently fall back
 * to DEFAULT_PRICE. Exact match wins; normalized match second.
 */
export function getToolPrice(toolName: string): ToolPrice {
  // 1. Exact match
  const exact = PRICE_MAP[toolName];
  if (exact) return exact;

  // 2. Normalized match: resolve_entity → resolve-entity
  const normalized = PRICE_MAP[toolName.replace(/_/g, '-')];
  if (normalized) return normalized;

  // 3. No match — return default
  return DEFAULT_PRICE;
}

/**
 * Export the full pricing map for inspection / admin UIs.
 */
export function getAllPrices(): Record<string, ToolPrice> {
  return { ...PRICE_MAP };
}
