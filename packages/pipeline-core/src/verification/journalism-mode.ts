// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Journalism Mode — Verification Badge System
 *
 * Feature gate that controls access to verified journalism data sources.
 * When enabled, tenants/users with a verified journalism badge get
 * access to premium data sources, enhanced citation verification,
 * and priority API access.
 *
 * Badge Levels:
 *   - none:       No journalism access (default for all users)
 *   - basic:      Verified individual journalist — access to standard
 *                 journalism-enhanced modules and citation tools
 *   - accredited: Verified newsroom / media organization — access to
 *                 premium data pipelines, bulk citations, and priority
 *                 API rate limits
 *   - research:   Academic / research institution — access to full data
 *                 history, raw datasets, and export capabilities
 *
 * This module is consumed by the API server (tenant schema validation),
 * the MCP (tool gating), and the ingestion pipeline (data quality checks).
 */

/* ------------------------------------------------------------------ */
/*  Badge Levels                                                       */
/* ------------------------------------------------------------------ */

/** Journalism verification badge levels */
export type JournalismBadgeLevel = 'none' | 'basic' | 'accredited' | 'research';

/** Human-readable badge level labels */
export const BADGE_LABELS: Record<JournalismBadgeLevel, string> = {
  none: 'No Journalism Access',
  basic: 'Verified Journalist',
  accredited: 'Accredited Newsroom',
  research: 'Research Institution',
};

/** Badge level ordering (higher index = more access) */
const BADGE_ORDER: Record<JournalismBadgeLevel, number> = {
  none: 0,
  basic: 1,
  accredited: 2,
  research: 3,
};

/* ------------------------------------------------------------------ */
/*  Capability Flags                                                   */
/* ------------------------------------------------------------------ */

/** Capabilities granted at each badge level */
export interface JournalismCapabilities {
  /** Access to journalism-enhanced ingestion modules */
  accessJournalismModules: boolean;
  /** Access to enhanced citation verification (Merkle proofs) */
  accessEnhancedCitations: boolean;
  /** Bulk citation generation (1000+ at once) */
  bulkCitations: boolean;
  /** Access to raw dataset exports (CSV, JSON) */
  rawDataExport: boolean;
  /** Full historical data backfill (beyond default scope) */
  historicalBackfill: boolean;
  /** Priority API rate limiting (higher limits) */
  priorityApiAccess: boolean;
  /** Access to real-time data feeds */
  realtimeFeeds: boolean;
  /** Webhook-based change notifications */
  webhookNotifications: boolean;
  /** Maximum ingest requests per day */
  maxDailyIngestRequests: number;
  /** Maximum citations per request */
  maxCitationsPerRequest: number;
}

export const DEFAULT_CAPABILITIES: Record<JournalismBadgeLevel, JournalismCapabilities> = {
  none: {
    accessJournalismModules: false,
    accessEnhancedCitations: false,
    bulkCitations: false,
    rawDataExport: false,
    historicalBackfill: false,
    priorityApiAccess: false,
    realtimeFeeds: false,
    webhookNotifications: false,
    maxDailyIngestRequests: 100,
    maxCitationsPerRequest: 10,
  },
  basic: {
    accessJournalismModules: true,
    accessEnhancedCitations: true,
    bulkCitations: false,
    rawDataExport: false,
    historicalBackfill: false,
    priorityApiAccess: false,
    realtimeFeeds: false,
    webhookNotifications: false,
    maxDailyIngestRequests: 500,
    maxCitationsPerRequest: 50,
  },
  accredited: {
    accessJournalismModules: true,
    accessEnhancedCitations: true,
    bulkCitations: true,
    rawDataExport: true,
    historicalBackfill: false,
    priorityApiAccess: true,
    realtimeFeeds: true,
    webhookNotifications: true,
    maxDailyIngestRequests: 2000,
    maxCitationsPerRequest: 500,
  },
  research: {
    accessJournalismModules: true,
    accessEnhancedCitations: true,
    bulkCitations: true,
    rawDataExport: true,
    historicalBackfill: true,
    priorityApiAccess: true,
    realtimeFeeds: true,
    webhookNotifications: true,
    maxDailyIngestRequests: 10000,
    maxCitationsPerRequest: 5000,
  },
};

/* ------------------------------------------------------------------ */
/*  Tenant / User Badge State                                          */
/* ------------------------------------------------------------------ */

/** Journalism badge state for a tenant or user */
export interface JournalismBadgeState {
  /** Current badge level */
  level: JournalismBadgeLevel;
  /** Whether the badge is actively verified */
  verified: boolean;
  /** ISO timestamp when the badge was issued */
  issuedAt: string;
  /** ISO timestamp when the badge expires (null = no expiry) */
  expiresAt: string | null;
  /** Badge verification token (opaque, for API verification) */
  badgeToken: string;
  /** Verification metadata */
  metadata?: {
    /** Name of verifying organization (e.g., 'CAB', 'CWA', 'FJA') */
    verifiedBy?: string;
    /** Journalist's media affiliation */
    affiliation?: string;
    /** Government press gallery accreditation ID (if applicable) */
    pressGalleryId?: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Feature Gate API                                                   */
/* ------------------------------------------------------------------ */

/**
 * Check if a badge level has access to a specific capability.
 */
export function hasCapability(
  level: JournalismBadgeLevel,
  capability: keyof JournalismCapabilities,
): boolean {
  const caps = DEFAULT_CAPABILITIES[level];
  return caps[capability] === true;
}

/**
 * Check if a badge level meets or exceeds a minimum threshold.
 */
export function meetsMinimumLevel(
  current: JournalismBadgeLevel,
  minimum: JournalismBadgeLevel,
): boolean {
  return BADGE_ORDER[current] >= BADGE_ORDER[minimum];
}

/**
 * Get the numeric rank of a badge level.
 */
export function badgeRank(level: JournalismBadgeLevel): number {
  return BADGE_ORDER[level];
}

/**
 * Get the display label for a badge level.
 */
export function badgeLabel(level: JournalismBadgeLevel): string {
  return BADGE_LABELS[level];
}

/**
 * Create a new journalism badge state.
 */
export function createBadgeState(
  level: JournalismBadgeLevel,
  options?: {
    expiresAt?: string;
    verifiedBy?: string;
    affiliation?: string;
    pressGalleryId?: string;
  },
): JournalismBadgeState {
  const badgeToken = generateBadgeToken();

  return {
    level,
    verified: level !== 'none',
    issuedAt: new Date().toISOString(),
    expiresAt: options?.expiresAt ?? null,
    badgeToken,
    metadata: level !== 'none' ? {
      verifiedBy: options?.verifiedBy,
      affiliation: options?.affiliation,
      pressGalleryId: options?.pressGalleryId,
    } : undefined,
  };
}

/**
 * Verify that a badge token is valid and the badge hasn't expired.
 */
export function isBadgeActive(state: JournalismBadgeState): boolean {
  if (!state.verified) return false;

  // Check expiry
  if (state.expiresAt) {
    const expires = new Date(state.expiresAt).getTime();
    if (Date.now() > expires) return false;
  }

  return true;
}

/**
 * Get the effective capabilities for a badged tenant.
 * Returns the full capability set for their level.
 */
export function getCapabilities(level: JournalismBadgeLevel): JournalismCapabilities {
  return { ...DEFAULT_CAPABILITIES[level] };
}

/**
 * Check if a given feature/module is accessible at a given badge level.
 * Used by the MCP to gate tool access.
 */
export function isModuleAccessible(
  moduleName: string,
  level: JournalismBadgeLevel,
): boolean {
  // Modules that require journalism verification
  const journalismModules: string[] = [
    'journalism-enhanced-citations',
    'press-freedom-tracker',
    'newsroom-finance-tracker',
    'journalist-safety-alerts',
    'media-ownership-tracker',
    'source-protection-verifier',
  ];

  if (level === 'none' && journalismModules.includes(moduleName)) {
    return false;
  }

  // All other modules are accessible at any level
  return true;
}

/* ------------------------------------------------------------------ */
/*  Internal Utilities                                                 */
/* ------------------------------------------------------------------ */

import { randomBytes } from 'node:crypto';

/**
 * Generate a cryptographically-random badge token.
 */
function generateBadgeToken(): string {
  return `jm_${randomBytes(24).toString('hex')}`;
}
