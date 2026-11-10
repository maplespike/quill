// SPDX-License-Identifier: AGPL-3.0-only
export { computeHash, verifyHash, generateVerifyCommand } from './hashing.js';
export type { CitationRecord } from './hashing.js';
export { FifthGenerationWarfareDefense, defaultFiveGWResult } from './fifth-gen-warfare.js';
export type {
  FiveGWDefenseConfig,
  FiveGWThreatLevel,
  FiveGWPattern,
  TrackedActorMatch,
  FiveGWAnalysisResult,
} from './fifth-gen-warfare.js';

// ── Journalism Mode / Verification Badge System ─────────────────────
export {
  hasCapability,
  meetsMinimumLevel,
  badgeRank,
  badgeLabel,
  createBadgeState,
  isBadgeActive,
  getCapabilities,
  isModuleAccessible,
  DEFAULT_CAPABILITIES,
  BADGE_LABELS,
} from './journalism-mode.js';
export type {
  JournalismBadgeLevel,
  JournalismCapabilities,
  JournalismBadgeState,
} from './journalism-mode.js';
