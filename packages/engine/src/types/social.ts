// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CivicIntel — Social Feature Types
 *
 * Types for: Connection Verification, Annotations, Investigations,
 * Shareable Briefs, Riding Networks, Expertise & Reputation, Watch Parties.
 */

// ── Connection Verification (Feature 18) ──────────────────

export type VerificationType = "verify" | "challenge" | "extend";

export interface Verification {
  id: string;
  threadId: string;
  type: VerificationType;
  citizenId: string;
  citizenName: string;
  sourceUrl: string;
  description: string;
  confidenceVote: number; // 0-1, how confident the citizen is
  createdAt: string;
  upvotes: number;
  downvotes: number;
}

// ── Citizen Annotations (Feature 20) ──────────────────────

export interface Annotation {
  id: string;
  entityId: string;
  citizenId: string;
  citizenName: string;
  content: string;
  sourceUrl: string;
  tags: string[];
  createdAt: string;
  upvotes: number;
  downvotes: number;
  replies: Annotation[];
  parentId: string | null;
}

// ── Collaborative Investigations (Feature 19) ─────────────

export type InvestigationStatus = "open" | "completed" | "archived";
export type InvestigationVisibility = "public" | "invited";

export interface Evidence {
  id: string;
  title: string;
  sourceUrl: string;
  description: string;
  entityTags: string[];
  addedBy: string;
  addedAt: string;
}

export interface Investigation {
  id: string;
  title: string;
  description: string;
  status: InvestigationStatus;
  visibility: InvestigationVisibility;
  createdBy: string;
  contributors: string[];
  entityIds: string[];
  threadIds: string[];
  evidence: Evidence[];
  findings: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Shareable Reality Briefs (Feature 21) ─────────────────

export interface ShareableBrief {
  id: string;
  threadIds: string[];
  sections: string[]; // which sections to include
  commentary: string; // citizen's commentary
  authorId: string;
  authorName: string;
  shareUrl: string;
  viewCount: number;
  createdAt: string;
}

// ── Riding & Community Networks (Feature 22) ──────────────

export interface RidingNetwork {
  ridingId: string;
  name: string;
  province: string;
  memberCount: number;
  totalSpending: number;
  lobbyingCount: number;
  mpName: string;
  mpParty: string;
}

// ── Expertise & Reputation (Feature 23) ───────────────────

export type TrustLevel = "newcomer" | "contributor" | "analyst" | "expert";

export interface CitizenProfile {
  id: string;
  name: string;
  handle: string;
  trustLevel: TrustLevel;
  verificationScore: number;
  domainTags: string[];
  badges: Badge[];
  contributions: number;
  joinedAt: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

// ── Live Analysis Sessions / Watch Parties (Feature 24) ───

export type SessionStatus = "scheduled" | "live" | "completed";

export interface AnalysisSession {
  id: string;
  title: string;
  description: string;
  status: SessionStatus;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  participants: number;
  signals: string[]; // signal IDs detected during session
  annotations: string[]; // annotation IDs created during session
  recordingUrl?: string;
}
