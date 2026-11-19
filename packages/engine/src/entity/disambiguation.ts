/**
 * Disambiguation Strategies
 *
 * Advanced disambiguation logic for resolving entity identity conflicts
 * when multiple candidates exist with similar confidence scores.
 */

import type { Charity } from "../types/charity";
import type { Committee } from "../types/committee";
import type { Donation } from "../types/donation";
import type { LobbyingFiling } from "../types/lobbying";
import type { Organization } from "../types/organization";
import type { Person } from "../types/person";
import { EntityResolver } from "./resolver";

export interface DisambiguationContext {
  entityType: "person" | "organization";
  query: string;
  candidates: Array<{
    entity: Person | Organization;
    confidence: number;
    reasons: string[];
  }>;
  auxiliaryData?: {
    donations?: Donation[];
    filings?: LobbyingFiling[];
    committees?: Committee[];
    charities?: Charity[];
  };
}

export interface DisambiguationResult {
  chosen: Person | Organization | null;
  confidence: number;
  method: string;
  reasoning: string[];
  rejected: Array<{
    entity: Person | Organization;
    reason: string;
  }>;
}

/**
 * Disambiguation Rule Engine
 *
 * Applies rule-based logic to resolve ambiguous entity matches.
 */
export class DisambiguationEngine {
  private resolver: EntityResolver;

  constructor(resolver: EntityResolver) {
    this.resolver = resolver;
  }

  /**
   * Main entry point for disambiguation.
   * Applies multiple strategies and returns the best match.
   */
  disambiguate(context: DisambiguationContext): DisambiguationResult {
    if (context.candidates.length === 0) {
      return {
        chosen: null,
        confidence: 0,
        method: "no_candidates",
        reasoning: ["No candidates provided"],
        rejected: [],
      };
    }

    if (context.candidates.length === 1) {
      return {
        chosen: context.candidates[0].entity,
        confidence: context.candidates[0].confidence,
        method: "single_candidate",
        reasoning: ["Only one candidate, no disambiguation needed"],
        rejected: [],
      };
    }

    // Apply disambiguation strategies in priority order
    const result = this.applyStrategies(context);

    return result;
  }

  /**
   * Apply disambiguation strategies in priority order.
   */
  private applyStrategies(
    context: DisambiguationContext,
  ): DisambiguationResult {
    const candidates = context.candidates;

    // Strategy 1: Exact match with multiple aliases takes precedence
    const exactMatch = this.findExactMatch(context);
    if (exactMatch) {
      return this.buildResult(
        exactMatch.entity,
        exactMatch.confidence,
        "exact_match_with_aliases",
        [`Found exact match for "${context.query}" in aliases`],
        candidates.filter((c) => c.entity.id !== exactMatch.entity.id),
      );
    }

    // Strategy 2: Auxiliary data correlation (donations, lobbying, etc.)
    const auxMatch = this.correlateWithAuxiliaryData(context);
    if (auxMatch) {
      return this.buildResult(
        auxMatch.entity,
        auxMatch.confidence * 0.95, // Slight penalty for indirect match
        "auxiliary_data_correlation",
        auxMatch.reasoning,
        candidates.filter((c) => c.entity.id !== auxMatch.entity.id),
      );
    }

    // Strategy 3: Geographic proximity
    const geoMatch = this.findGeographicMatch(context);
    if (geoMatch) {
      return this.buildResult(
        geoMatch.entity,
        geoMatch.confidence * 0.9, // Penalty for geographic inference
        "geographic_proximity",
        geoMatch.reasoning,
        candidates.filter((c) => c.entity.id !== geoMatch.entity.id),
      );
    }

    // Strategy 4: Temporal consistency
    const temporalMatch = this.findTemporalMatch(context);
    if (temporalMatch) {
      return this.buildResult(
        temporalMatch.entity,
        temporalMatch.confidence * 0.88,
        "temporal_consistency",
        temporalMatch.reasoning,
        candidates.filter((c) => c.entity.id !== temporalMatch.entity.id),
      );
    }

    // Strategy 5: Choose highest confidence if gap is significant
    const highest = candidates[0];
    const second = candidates[1];
    const gap = highest.confidence - second.confidence;

    if (gap >= 0.15) {
      return this.buildResult(
        highest.entity,
        highest.confidence,
        "confidence_gap",
        [
          `Highest confidence candidate (${highest.confidence.toFixed(2)}) exceeds second by ${(gap * 100).toFixed(0)}%`,
        ],
        candidates.slice(1),
      );
    }

    // Strategy 6: Ambiguous - return null for manual review
    return {
      chosen: null,
      confidence: Math.max(...candidates.map((c) => c.confidence)),
      method: "ambiguous_requires_review",
      reasoning: [
        `Multiple candidates with similar confidence: ${candidates
          .map((c) => `${c.entity.names[0]} (${c.confidence.toFixed(2)})`)
          .join(", ")}`,
        "Confidence gaps too small for automatic disambiguation",
      ],
      rejected: candidates.map((c) => ({
        entity: c.entity,
        reason: "Ambiguous - similar confidence to other candidates",
      })),
    };
  }

  /**
   * Strategy 1: Find exact match in entity aliases.
   */
  private findExactMatch(
    context: DisambiguationContext,
  ): { entity: Person | Organization; confidence: number } | null {
    const query = context.query.toLowerCase();

    for (const candidate of context.candidates) {
      const entity = candidate.entity;
      for (const name of entity.names) {
        if (name.toLowerCase() === query) {
          return { entity, confidence: 1.0 };
        }
      }
    }

    return null;
  }

  /**
   * Strategy 2: Correlate with auxiliary data (donations, filings, etc.).
   */
  private correlateWithAuxiliaryData(
    context: DisambiguationContext,
  ):
    | { entity: Person | Organization; confidence: number; reasoning: string[] }
    | null {
    if (!context.auxiliaryData) return null;

    const { donations, filings, committees, charities } =
      context.auxiliaryData;

    // Check for donation correlations
    if (donations && donations.length > 0) {
      const match = this.findDonationCorrelation(context, donations);
      if (match) return match;
    }

    // Check for lobbying correlations
    if (filings && filings.length > 0) {
      const match = this.findLobbyingCorrelation(context, filings);
      if (match) return match;
    }

    // Check for committee membership correlations
    if (committees && committees.length > 0) {
      const match = this.findCommitteeCorrelation(context, committees);
      if (match) return match;
    }

    // Check for charity board membership correlations
    if (charities && charities.length > 0) {
      const match = this.findCharityCorrelation(context, charities);
      if (match) return match;
    }

    return null;
  }

  private findDonationCorrelation(
    _context: DisambiguationContext,
    _donations: Donation[],
  ):
    | { entity: Person | Organization; confidence: number; reasoning: string[] }
    | null {
    // Donation rows do not name a donor, so they cannot disambiguate a person.
    return null;
  }

  private findLobbyingCorrelation(
    context: DisambiguationContext,
    filings: LobbyingFiling[],
  ):
    | { entity: Person | Organization; confidence: number; reasoning: string[] }
    | null {
    for (const candidate of context.candidates) {
      const entity = candidate.entity;
      const matches = filings.filter((f) => {
        if (entity.names[0].includes(f.registrant.name)) return true;
        if (f.clientName.includes(entity.names[0])) return true;
        return false;
      });

      if (matches.length >= 1) {
        return {
          entity,
          confidence: candidate.confidence,
          reasoning: [
            `Found lobbying filing for "${matches[0].subjectMatter}"`,
            `Institution: ${matches[0].institution}`,
          ],
        };
      }
    }

    return null;
  }

  private findCommitteeCorrelation(
    context: DisambiguationContext,
    committees: Committee[],
  ):
    | { entity: Person | Organization; confidence: number; reasoning: string[] }
    | null {
    for (const candidate of context.candidates) {
      const entity = candidate.entity;
      for (const committee of committees) {
        for (const member of committee.members) {
          if (
            this.resolver.resolvePersonNames(
              member.personName,
              entity.names[0],
            ) >= 0.85
          ) {
            return {
              entity,
              confidence: candidate.confidence,
              reasoning: [
                `Confirmed as ${member.role} of committee "${committee.names[0]}"`,
                `Member from ${member.startDate}${member.endDate ? ` to ${member.endDate}` : ""}`,
              ],
            };
          }
        }
      }
    }

    return null;
  }

  private findCharityCorrelation(
    context: DisambiguationContext,
    charities: Charity[],
  ):
    | { entity: Person | Organization; confidence: number; reasoning: string[] }
    | null {
    for (const candidate of context.candidates) {
      const entity = candidate.entity;
      for (const charity of charities) {
        for (const boardMember of charity.boardMembers) {
          if (
            this.resolver.resolvePersonNames(
              boardMember.personName,
              entity.names[0],
            ) >= 0.85
          ) {
            return {
              entity,
              confidence: candidate.confidence,
              reasoning: [
                `Confirmed as ${boardMember.title} on board of "${charity.names[0]}"`,
                `Board member from ${boardMember.startDate}${boardMember.endDate ? ` to ${boardMember.endDate}` : ""}`,
              ],
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Strategy 3: Find geographic match (province/city).
   */
  private findGeographicMatch(
    context: DisambiguationContext,
  ):
    | { entity: Person | Organization; confidence: number; reasoning: string[] }
    | null {
    for (const candidate of context.candidates) {
      const entity = candidate.entity as Person | Organization;
      const hasProvince =
        "province" in entity && entity.province !== undefined;

      if (hasProvince) {
        // Prefer entities in the same geographic region
        return {
          entity,
          confidence: candidate.confidence,
          reasoning: [`Located in ${(entity as Person | Organization).province}`],
        };
      }
    }

    return null;
  }

  /**
   * Strategy 4: Find temporal consistency.
   */
  private findTemporalMatch(
    context: DisambiguationContext,
  ):
    | { entity: Person | Organization; confidence: number; reasoning: string[] }
    | null {
    const now = new Date();

    for (const candidate of context.candidates) {
      const entity = candidate.entity as Person | Organization;

      // Check for active roles
      if ("roles" in entity && entity.roles.length > 0) {
        const activeRoles = entity.roles.filter((r) => {
          const end = r.endDate ? new Date(r.endDate) : now;
          return end >= now;
        });

        if (activeRoles.length > 0) {
          return {
            entity,
            confidence: candidate.confidence,
            reasoning: [
              `Has ${activeRoles.length} active role(s)`,
              `Latest: ${activeRoles[0].title} at ${activeRoles[0].organization}`,
            ],
          };
        }
      }

      // Check for active registrations
      if ("registrations" in entity && entity.registrations.length > 0) {
        const activeRegs = entity.registrations.filter(
          (r) => r.status === "active",
        );

        if (activeRegs.length > 0) {
          return {
            entity,
            confidence: candidate.confidence,
            reasoning: [`Has ${activeRegs.length} active registration(s)`],
          };
        }
      }
    }

    return null;
  }

  /**
   * Build a disambiguation result.
   */
  private buildResult(
    chosen: Person | Organization,
    confidence: number,
    method: string,
    reasoning: string[],
    rejected: Array<{ entity: Person | Organization; confidence: number; reasons: string[] }>,
  ): DisambiguationResult {
    return {
      chosen,
      confidence,
      method,
      reasoning,
      rejected: rejected.map((r) => ({
        entity: r.entity,
        reason: r.reasons.join(", "),
      })),
    };
  }
}