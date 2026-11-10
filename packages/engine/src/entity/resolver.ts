// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Entity Resolver
 *
 * Core fuzzy entity resolution engine. Uses Fuse.js for fuzzy matching
 * and an AliasManager for pre-seeded known variants.
 */

import Fuse from "fuse.js";
import type { Organization, Person } from "../types/index";
import type { AliasManager } from "./aliases";
import type {
  ConfidenceLevel,
  ResolutionMap,
  ResolutionResult,
  ResolvedEntity,
} from "./types";

/** Classify a confidence score into a level */
function classifyConfidence(score: number): ConfidenceLevel {
  if (score >= 0.99) return "exact";
  if (score >= 0.9) return "high";
  if (score >= 0.7) return "medium";
  if (score >= 0.5) return "low";
  return "none";
}

/** Normalize a string for comparison: lowercase, trim, collapse whitespace, remove accents */
function normalize(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Extract initials from a name. "Sarah J. Mitchell" → "SJM", "S. Mitchell" → "SM"
 */
function getInitials(name: string): string {
  const parts = name.split(/\s+/);
  return parts
    .map((p) => {
      const cleaned = p.replace(/\.$/, "");
      return cleaned.charAt(0).toUpperCase();
    })
    .join("");
}

/**
 * Check if one name looks like an initial-based abbreviation of another.
 * E.g. "S. Mitchell" matches "Sarah Mitchell"
 */
function isInitialMatch(short: string, long: string): boolean {
  const shortParts = short.split(/\s+/);
  const longParts = long.split(/\s+/);
  if (shortParts.length !== longParts.length) return false;

  for (let i = 0; i < shortParts.length; i++) {
    const sp = shortParts[i].replace(/\.$/, "");
    const lp = longParts[i];
    // If short part is a single letter (initial)
    if (sp.length === 1) {
      if (lp.charAt(0).toUpperCase() !== sp.toUpperCase()) return false;
    } else {
      if (normalize(sp) !== normalize(lp)) return false;
    }
  }
  return true;
}

/**
 * Check if two names share the same last name and at least one given name initial.
 */
function isHyphenatedOrMaidenName(name1: string, name2: string): boolean {
  const parts1 = name1.split(/\s+/);
  const parts2 = name2.split(/\s+/);
  const last1 = parts1[parts1.length - 1];
  const last2 = parts2[parts2.length - 1];

  // Check if last names share a hyphenated component
  const last1Comps = last1.split("-");
  const last2Comps = last2.split("-");
  if (last1Comps.some((c) => last2Comps.includes(c)) && last1 !== last2) {
    // Same last name component via hyphenation — check first name initial
    if (
      parts1[0].charAt(0).toUpperCase() === parts2[0].charAt(0).toUpperCase()
    ) {
      return true;
    }
  }
  return false;
}

export class EntityResolver {
  private aliasManager: AliasManager;

  constructor(aliasManager: AliasManager) {
    this.aliasManager = aliasManager;
  }

  /**
   * Fuzzy person name matching.
   * Handles: case variations, accents, initials ("S. Mitchell" = "Sarah Mitchell"),
   * hyphenated names ("Sarah Mitchell-Patel" ≈ "Sarah Mitchell"),
   * middle names, diminutives.
   */
  resolvePersonNames(name1: string, name2: string): number {
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    // Exact match after normalization
    if (n1 === n2) return 1.0;

    // Check alias table for exact mapping
    const canon1 = this.aliasManager.getCanonicalName(name1, "person");
    const canon2 = this.aliasManager.getCanonicalName(name2, "person");
    if (canon1 === canon2 && canon1 !== name1 && canon1 !== name2) {
      // Both resolve to same canonical
      return 0.98;
    }
    if (normalize(canon1) === normalize(canon2)) return 0.98;

    // Initial matching: "S. Mitchell" vs "Sarah Mitchell"
    if (isInitialMatch(name1, name2) || isInitialMatch(name2, name1)) {
      return 0.95;
    }

    // Hyphenated/maiden name check
    if (isHyphenatedOrMaidenName(name1, name2)) {
      return 0.88;
    }

    // Fuse.js fuzzy matching as fallback
    const fuse = new Fuse([{ name: n2 }], {
      keys: ["name"],
      threshold: 0.4,
      includeScore: true,
    });

    const result = fuse.search(n1);
    if (result.length > 0 && result[0].score !== undefined) {
      // Fuse.js score is distance (0=exact, 1=no match), invert to confidence
      const confidence = 1 - result[0].score;
      if (confidence >= 0.7) return confidence;
    }

    // Check if one name is a substring of another (e.g. middle name difference)
    const parts1 = n1.split(" ");
    const parts2 = n2.split(" ");
    if (parts1.length >= 2 && parts2.length >= 2) {
      // Compare first and last only
      const fl1 = `${parts1[0]} ${parts1[parts1.length - 1]}`;
      const fl2 = `${parts2[0]} ${parts2[parts2.length - 1]}`;
      if (fl1 === fl2) return 0.92;
    }

    return 0;
  }

  /**
   * Fuzzy organization name matching.
   * Handles: abbreviations, "Canada" suffix, subsidiary names,
   * legal suffixes (Corp, Inc, Ltd), French/English variants.
   */
  resolveOrgNames(name1: string, name2: string): number {
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    // Exact match after normalization
    if (n1 === n2) return 1.0;

    // Check alias table
    const canon1 = this.aliasManager.getCanonicalName(name1, "org");
    const canon2 = this.aliasManager.getCanonicalName(name2, "org");
    if (normalize(canon1) === normalize(canon2)) return 0.98;

    // Check if alias table directly maps one to the other
    const aliases1 = this.aliasManager.getAliases(canon1, "org");
    for (const alias of aliases1) {
      if (normalize(alias) === n2) return 0.97;
    }
    const aliases2 = this.aliasManager.getAliases(canon2, "org");
    for (const alias of aliases2) {
      if (normalize(alias) === n1) return 0.97;
    }

    // Strip common legal suffixes and retry
    const stripSuffixes = (s: string): string =>
      s
        .replace(
          /\b(inc|corp|ltd|llc|co|limited|corporation|company)\b\.?/gi,
          "",
        )
        .replace(/\bcanada\b/gi, "")
        .trim();

    const stripped1 = stripSuffixes(n1);
    const stripped2 = stripSuffixes(n2);
    if (stripped1 && stripped2 && stripped1 === stripped2) return 0.93;

    // Subsidiary detection: if one name is a subset of the other
    // e.g. "Lockheed Martin Canada" contains "Lockheed Martin"
    const words1 = n1.split(/\s+/);
    const words2 = n2.split(/\s+/);
    const shorter = words1.length <= words2.length ? words1 : words2;
    const longer = words1.length <= words2.length ? words2 : words1;

    if (shorter.length >= 2) {
      const allPresent = shorter.every((w) =>
        longer.some((lw) => lw === w || lw.startsWith(w) || w.startsWith(lw)),
      );
      if (allPresent && shorter.length >= longer.length * 0.6) {
        return 0.85;
      }
    }

    // Fuse.js fallback
    const fuse = new Fuse([{ name: n2 }], {
      keys: ["name"],
      threshold: 0.35,
      includeScore: true,
    });

    const result = fuse.search(n1);
    if (result.length > 0 && result[0].score !== undefined) {
      const confidence = 1 - result[0].score;
      if (confidence >= 0.7) return confidence;
    }

    return 0;
  }

  /**
   * Batch resolution: merge persons and organizations into canonical entities.
   * Produces a ResolutionMap of canonical → aliases.
   */
  resolveEntities(
    persons: Person[],
    organizations: Organization[],
  ): ResolutionMap {
    const entities = new Map<string, ResolvedEntity>();

    // Process persons: group by fuzzy name similarity
    const personGroups: Array<{ canonical: string; members: Person[] }> = [];

    for (const person of persons) {
      let matched = false;
      for (const group of personGroups) {
        for (const member of group.members) {
          for (const nameA of person.names) {
            for (const nameB of member.names) {
              const score = this.resolvePersonNames(nameA, nameB);
              if (score >= 0.7) {
                group.members.push(person);
                matched = true;
                break;
              }
            }
            if (matched) break;
          }
          if (matched) break;
        }
        if (matched) break;
      }
      if (!matched) {
        personGroups.push({
          canonical: person.names[0] ?? person.id,
          members: [person],
        });
      }
    }

    for (const group of personGroups) {
      const allNames = group.members.flatMap((m) => m.names);
      const canonicalName = this.aliasManager.getCanonicalName(
        group.canonical,
        "person",
      );
      const id = `person-${canonicalName.toLowerCase().replace(/\s+/g, "-")}`;
      entities.set(id, {
        id,
        canonicalName,
        aliases: [...new Set(allNames)],
        type: "person",
        confidence: 0.9,
      });

      // Register discovered aliases
      for (const name of allNames) {
        if (normalize(name) !== normalize(canonicalName)) {
          this.aliasManager.addAlias(
            canonicalName,
            name,
            "person",
            "resolution",
          );
        }
      }
    }

    // Process organizations
    const orgGroups: Array<{ canonical: string; members: Organization[] }> = [];

    for (const org of organizations) {
      let matched = false;
      for (const group of orgGroups) {
        for (const nameA of org.names) {
          for (const nameB of group.members.flatMap((m) => m.names)) {
            const score = this.resolveOrgNames(nameA, nameB);
            if (score >= 0.7) {
              group.members.push(org);
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
        if (matched) break;
      }
      if (!matched) {
        orgGroups.push({
          canonical: org.names[0] ?? org.id,
          members: [org],
        });
      }
    }

    for (const group of orgGroups) {
      const allNames = group.members.flatMap((m) => m.names);
      const canonicalName = this.aliasManager.getCanonicalName(
        group.canonical,
        "org",
      );
      const id = `org-${canonicalName.toLowerCase().replace(/\s+/g, "-")}`;
      entities.set(id, {
        id,
        canonicalName,
        aliases: [...new Set(allNames)],
        type: "org",
        confidence: 0.9,
      });

      for (const name of allNames) {
        if (normalize(name) !== normalize(canonicalName)) {
          this.aliasManager.addAlias(canonicalName, name, "org", "resolution");
        }
      }
    }

    return { entities };
  }

  /**
   * Create a ResolutionResult from a score.
   */
  makeResult(
    name1: string,
    name2: string,
    confidence: number,
    method: string,
  ): ResolutionResult {
    return {
      name1,
      name2,
      confidence,
      level: classifyConfidence(confidence),
      isMatch: confidence >= 0.7,
      method,
    };
  }
}
