/**
 * Cross-Module Entity Linker
 *
 * Links entities across different data modules using a combination of:
 * - Name resolution (via EntityResolver)
 * - Disambiguation (via DisambiguationEngine)
 * - Contextual correlation (temporal, geographic, functional)
 *
 * Supports the linking patterns:
 * - person → committee (membership, testimony)
 * - person → charity (board membership, executive roles)
 * - person → lobbying (registrant, communication participant)
 * - organization → charity (donor, partner)
 * - organization → lobbying (client, registrant firm)
 * - organization → contract (vendor)
 * - committee → lobbying (oversight, subject matter)
 */

import type { Charity } from "../types/charity";
import type { Committee } from "../types/committee";
import type { Contract } from "../types/contract";
import type { Disclosure } from "../types/disclosure";
import type { Donation } from "../types/donation";
import type { GACProject } from "../types/gac";
import type { Edge, EdgeType, Node, NodeType } from "../types/graph";
import type { LobbyingFiling } from "../types/lobbying";
import type { Organization } from "../types/organization";
import type { Person } from "../types/person";
import { DisambiguationEngine } from "./disambiguation";
import { EntityResolver } from "./resolver";

export interface LinkCandidate {
  entity: Person | Organization;
  confidence: number;
  reasons: string[];
}

export interface LinkResult {
  sourceId: string;
  targetId: string;
  edgeType: EdgeType;
  confidence: number;
  reasoning: string[];
  method: string;
}

export interface LinkingRule {
  name: string;
  sourceType: NodeType;
  targetType: NodeType;
  edgeType: EdgeType;
  weight: number;
  requiredConfidence: number;
}

/**
 * Predefined cross-module linking rules.
 */
export const LINKING_RULES: LinkingRule[] = [
  // Person → Committee
  {
    name: "person_committee_membership",
    sourceType: "person",
    targetType: "committee",
    edgeType: "member_of",
    weight: 0.95,
    requiredConfidence: 0.75,
  },
  {
    name: "person_committee_chair",
    sourceType: "person",
    targetType: "committee",
    edgeType: "chairs",
    weight: 0.98,
    requiredConfidence: 0.8,
  },
  {
    name: "person_committee_testimony",
    sourceType: "person",
    targetType: "committee",
    edgeType: "testified_before",
    weight: 0.85,
    requiredConfidence: 0.7,
  },

  // Person → Charity
  {
    name: "person_charity_board",
    sourceType: "person",
    targetType: "charity",
    edgeType: "board_member_of",
    weight: 0.97,
    requiredConfidence: 0.8,
  },
  {
    name: "person_charity_executive",
    sourceType: "person",
    targetType: "charity",
    edgeType: "executive_director_of",
    weight: 0.96,
    requiredConfidence: 0.8,
  },

  // Person → Lobbying
  {
    name: "person_lobbying_registrant",
    sourceType: "person",
    targetType: "lobbying_filing",
    edgeType: "filed_by",
    weight: 0.9,
    requiredConfidence: 0.75,
  },

  // Organization → Charity
  {
    name: "org_charity_funding",
    sourceType: "organization",
    targetType: "charity",
    edgeType: "funds",
    weight: 0.92,
    requiredConfidence: 0.75,
  },
  {
    name: "org_charity_affiliated",
    sourceType: "organization",
    targetType: "charity",
    edgeType: "affiliated_with",
    weight: 0.8,
    requiredConfidence: 0.7,
  },

  // Organization → Lobbying
  {
    name: "org_lobbying_client",
    sourceType: "organization",
    targetType: "lobbying_filing",
    edgeType: "lobbied_by",
    weight: 0.9,
    requiredConfidence: 0.75,
  },

  // Organization → Contract
  {
    name: "org_contract_vendor",
    sourceType: "organization",
    targetType: "contract",
    edgeType: "awarded_to",
    weight: 0.95,
    requiredConfidence: 0.8,
  },

  // Committee → Lobbying
  {
    name: "committee_lobbying_oversight",
    sourceType: "committee",
    targetType: "lobbying_filing",
    edgeType: "communicated_with",
    weight: 0.85,
    requiredConfidence: 0.7,
  },
];

/**
 * Cross-Module Entity Linker
 *
 * Orchestrates entity linking across modules based on predefined rules
 * and disambiguation strategies.
 */
export class CrossModuleLinker {
  private resolver: EntityResolver;
  private disambiguator: DisambiguationEngine;
  private rules: LinkingRule[];

  constructor(
    resolver: EntityResolver,
    rules: LinkingRule[] = LINKING_RULES,
  ) {
    this.resolver = resolver;
    this.disambiguator = new DisambiguationEngine(resolver);
    this.rules = rules;
  }

  /**
   * Main entry point: Find all cross-module links.
   */
  findLinks(
    persons: Person[],
    organizations: Organization[],
    contracts: Contract[],
    filings: LobbyingFiling[],
    donations: Donation[],
    disclosures: Disclosure[],
    gacProjects: GACProject[],
    committees: Committee[],
    charities: Charity[],
  ): LinkResult[] {
    const links: LinkResult[] = [];

    // Apply each linking rule
    for (const rule of this.rules) {
      const ruleLinks = this.applyRule(
        rule,
        persons,
        organizations,
        contracts,
        filings,
        donations,
        disclosures,
        gacProjects,
        committees,
        charities,
      );
      links.push(...ruleLinks);
    }

    // Deduplicate links (same source/target/edgeType)
    return this.deduplicateLinks(links);
  }

  /**
   * Apply a single linking rule to find matches.
   */
  private applyRule(
    rule: LinkingRule,
    persons: Person[],
    organizations: Organization[],
    contracts: Contract[],
    filings: LobbyingFiling[],
    donations: Donation[],
    disclosures: Disclosure[],
    gacProjects: GACProject[],
    committees: Committee[],
    charities: Charity[],
  ): LinkResult[] {
    const links: LinkResult[] = [];

    switch (rule.name) {
      case "person_committee_membership":
        links.push(...this.linkPersonCommitteeMembership(rule, persons, committees));
        break;
      case "person_committee_chair":
        links.push(...this.linkPersonCommitteeChair(rule, persons, committees));
        break;
      case "person_committee_testimony":
        links.push(...this.linkPersonCommitteeTestimony(rule, persons, committees, filings));
        break;
      case "person_charity_board":
        links.push(...this.linkPersonCharityBoard(rule, persons, charities));
        break;
      case "person_charity_executive":
        links.push(...this.linkPersonCharityExecutive(rule, persons, charities));
        break;
      case "person_lobbying_registrant":
        links.push(...this.linkPersonLobbyingRegistrant(rule, persons, filings));
        break;
      case "org_charity_funding":
        links.push(...this.linkOrgCharityFunding(rule, organizations, charities, donations));
        break;
      case "org_charity_affiliated":
        links.push(...this.linkOrgCharityAffiliated(rule, organizations, charities));
        break;
      case "org_lobbying_client":
        links.push(...this.linkOrgLobbyingClient(rule, organizations, filings));
        break;
      case "org_contract_vendor":
        links.push(...this.linkOrgContractVendor(rule, organizations, contracts));
        break;
      case "committee_lobbying_oversight":
        links.push(...this.linkCommitteeLobbyingOversight(rule, committees, filings));
        break;
    }

    return links.filter((link) => link.confidence >= rule.requiredConfidence);
  }

  // Person → Committee Links

  private linkPersonCommitteeMembership(
    rule: LinkingRule,
    persons: Person[],
    committees: Committee[],
  ): LinkResult[] {
    const links: LinkResult[] = [];

    for (const committee of committees) {
      for (const member of committee.members) {
        const candidates = this.findPersonCandidates(persons, member.personName);

        if (candidates.length > 0) {
          const result = this.disambiguator.disambiguate({
            entityType: "person",
            query: member.personName,
            candidates,
            auxiliaryData: { committees },
          });

          if (result.chosen) {
            links.push({
              sourceId: result.chosen.id,
              targetId: committee.id,
              edgeType: rule.edgeType,
              confidence: result.confidence * rule.weight,
              reasoning: [
                `Member of committee "${committee.names[0]}"`,
                `Role: ${member.role}`,
                `From ${member.startDate}${member.endDate ? ` to ${member.endDate}` : ""}`,
                ...result.reasoning,
              ],
              method: `rule:${rule.name}+disambiguation:${result.method}`,
            });
          }
        }
      }
    }

    return links;
  }

  private linkPersonCommitteeChair(
    rule: LinkingRule,
    persons: Person[],
    committees: Committee[],
  ): LinkResult[] {
    const links: LinkResult[] = [];

    for (const committee of committees) {
      const chairs = committee.members.filter((m) => m.role === "chair");

      for (const chair of chairs) {
        const candidates = this.findPersonCandidates(persons, chair.personName);

        if (candidates.length > 0) {
          const result = this.disambiguator.disambiguate({
            entityType: "person",
            query: chair.personName,
            candidates,
            auxiliaryData: { committees },
          });

          if (result.chosen) {
            links.push({
              sourceId: result.chosen.id,
              targetId: committee.id,
              edgeType: rule.edgeType,
              confidence: result.confidence * rule.weight,
              reasoning: [
                `Chairs committee "${committee.names[0]}"`,
                `From ${chair.startDate}${chair.endDate ? ` to ${chair.endDate}` : ""}`,
                ...result.reasoning,
              ],
              method: `rule:${rule.name}+disambiguation:${result.method}`,
            });
          }
        }
      }
    }

    return links;
  }

  private linkPersonCommitteeTestimony(
    rule: LinkingRule,
    persons: Person[],
    committees: Committee[],
    filings: LobbyingFiling[],
  ): LinkResult[] {
    const links: LinkResult[] = [];

    // Find persons who communicated in lobbying filings
    for (const filing of filings) {
      for (const comm of filing.communications) {
        for (const official of comm.officials) {
          const candidates = this.findPersonCandidates(persons, official);

          if (candidates.length > 0) {
            const result = this.disambiguator.disambiguate({
              entityType: "person",
              query: official,
              candidates,
              auxiliaryData: { committees, filings },
            });

            if (result.chosen) {
              // Find related committee based on institution
              const relatedCommittee = committees.find((c) =>
                c.chamber?.toLowerCase().includes(filing.institution.toLowerCase()) ||
                c.names.some((n) => filing.institution.includes(n)),
              );

              if (relatedCommittee) {
                links.push({
                  sourceId: result.chosen.id,
                  targetId: relatedCommittee.id,
                  edgeType: rule.edgeType,
                  confidence: result.confidence * rule.weight,
                  reasoning: [
                    `Testified/communicated regarding "${filing.subjectMatter}"`,
                    `Communication date: ${comm.date}`,
                    `Institution: ${filing.institution}`,
                    `Related to committee: ${relatedCommittee.names[0]}`,
                    ...result.reasoning,
                  ],
                  method: `rule:${rule.name}+disambiguation:${result.method}`,
                });
              }
            }
          }
        }
      }
    }

    return links;
  }

  // Person → Charity Links

  private linkPersonCharityBoard(
    rule: LinkingRule,
    persons: Person[],
    charities: Charity[],
  ): LinkResult[] {
    const links: LinkResult[] = [];

    for (const charity of charities) {
      for (const boardMember of charity.boardMembers) {
        const candidates = this.findPersonCandidates(persons, boardMember.personName);

        if (candidates.length > 0) {
          const result = this.disambiguator.disambiguate({
            entityType: "person",
            query: boardMember.personName,
            candidates,
            auxiliaryData: { charities },
          });

          if (result.chosen) {
            links.push({
              sourceId: result.chosen.id,
              targetId: charity.id,
              edgeType: rule.edgeType,
              confidence: result.confidence * rule.weight,
              reasoning: [
                `Board member of charity "${charity.names[0]}"`,
                `Title: ${boardMember.title}`,
                `From ${boardMember.startDate}${boardMember.endDate ? ` to ${boardMember.endDate}` : ""}`,
                `Compensated: ${boardMember.isCompensated}`,
                ...result.reasoning,
              ],
              method: `rule:${rule.name}+disambiguation:${result.method}`,
            });
          }
        }
      }
    }

    return links;
  }

  private linkPersonCharityExecutive(
    rule: LinkingRule,
    persons: Person[],
    charities: Charity[],
  ): LinkResult[] {
    const links: LinkResult[] = [];

    for (const charity of charities) {
      for (const boardMember of charity.boardMembers) {
        // Look for executive titles (Executive Director, CEO, etc.)
        if (
          boardMember.title.toLowerCase().includes("executive") ||
          boardMember.title.toLowerCase().includes("director") ||
          boardMember.title.toLowerCase().includes("ceo") ||
          boardMember.title.toLowerCase().includes("president")
        ) {
          const candidates = this.findPersonCandidates(persons, boardMember.personName);

          if (candidates.length > 0) {
            const result = this.disambiguator.disambiguate({
              entityType: "person",
              query: boardMember.personName,
              candidates,
              auxiliaryData: { charities },
            });

            if (result.chosen) {
              links.push({
                sourceId: result.chosen.id,
                targetId: charity.id,
                edgeType: rule.edgeType,
                confidence: result.confidence * rule.weight,
                reasoning: [
                  `Executive (${boardMember.title}) of charity "${charity.names[0]}"`,
                  `From ${boardMember.startDate}${boardMember.endDate ? ` to ${boardMember.endDate}` : ""}`,
                  ...result.reasoning,
                ],
                method: `rule:${rule.name}+disambiguation:${result.method}`,
              });
            }
          }
        }
      }
    }

    return links;
  }

  // Person → Lobbying Links

  private linkPersonLobbyingRegistrant(
    rule: LinkingRule,
    persons: Person[],
    filings: LobbyingFiling[],
  ): LinkResult[] {
    const links: LinkResult[] = [];

    for (const filing of filings) {
      const registrantName = filing.registrant.name;
      const candidates = this.findPersonCandidates(persons, registrantName);

      if (candidates.length > 0) {
        const result = this.disambiguator.disambiguate({
          entityType: "person",
          query: registrantName,
          candidates,
          auxiliaryData: { filings },
        });

        if (result.chosen) {
          links.push({
            sourceId: result.chosen.id,
            targetId: filing.id,
            edgeType: rule.edgeType,
            confidence: result.confidence * rule.weight,
            reasoning: [
              `Registrant for lobbying filing "${filing.filingNumber}"`,
              `Client: ${filing.clientName}`,
              `Institution: ${filing.institution}`,
              `Subject: ${filing.subjectMatter}`,
              ...result.reasoning,
            ],
            method: `rule:${rule.name}+disambiguation:${result.method}`,
          });
        }
      }
    }

    return links;
  }

  // Organization → Charity Links

  private linkOrgCharityFunding(
    _rule: LinkingRule,
    _organizations: Organization[],
    _charities: Charity[],
    _donations: Donation[],
  ): LinkResult[] {
    // Donation rows are aggregates and do not name a donor.
    return [];
  }

  private linkOrgCharityAffiliated(
    rule: LinkingRule,
    organizations: Organization[],
    charities: Charity[],
  ): LinkResult[] {
    const links: LinkResult[] = [];

    // Check for organization names in charity activities or mandate
    for (const charity of charities) {
      const combinedText = `${charity.mandate} ${charity.activities.map((a) => a.description).join(" ")}`;

      for (const org of organizations) {
        for (const orgName of org.names) {
          if (combinedText.toLowerCase().includes(orgName.toLowerCase())) {
            const score = this.resolver.resolveOrgNames(orgName, org.names[0]);
            if (score >= 0.7) {
              links.push({
                sourceId: org.id,
                targetId: charity.id,
                edgeType: rule.edgeType,
                confidence: score * rule.weight,
                reasoning: [
                  `Organization name "${orgName}" appears in charity mandate/activities`,
                  `Charity: ${charity.names[0]}`,
                  `Mandate: ${charity.mandate.substring(0, 100)}...`,
                ],
                method: `rule:${rule.name}`,
              });
            }
          }
        }
      }
    }

    return links;
  }

  // Organization → Lobbying Links

  private linkOrgLobbyingClient(
    rule: LinkingRule,
    organizations: Organization[],
    filings: LobbyingFiling[],
  ): LinkResult[] {
    const links: LinkResult[] = [];

    for (const filing of filings) {
      const clientName = filing.clientName;
      const candidates = this.findOrgCandidates(organizations, clientName);

      if (candidates.length > 0) {
        const result = this.disambiguator.disambiguate({
          entityType: "organization",
          query: clientName,
          candidates,
          auxiliaryData: { filings },
        });

        if (result.chosen) {
          links.push({
            sourceId: result.chosen.id,
            targetId: filing.id,
            edgeType: rule.edgeType,
            confidence: result.confidence * rule.weight,
            reasoning: [
              `Client in lobbying filing "${filing.filingNumber}"`,
              `Registrant: ${filing.registrant.name}`,
              `Institution: ${filing.institution}`,
              `Subject: ${filing.subjectMatter}`,
              ...result.reasoning,
            ],
            method: `rule:${rule.name}+disambiguation:${result.method}`,
          });
        }
      }
    }

    return links;
  }

  // Organization → Contract Links

  private linkOrgContractVendor(
    rule: LinkingRule,
    organizations: Organization[],
    contracts: Contract[],
  ): LinkResult[] {
    const links: LinkResult[] = [];

    for (const contract of contracts) {
      const vendorName = contract.vendorName;
      const candidates = this.findOrgCandidates(organizations, vendorName);

      if (candidates.length > 0) {
        const result = this.disambiguator.disambiguate({
          entityType: "organization",
          query: vendorName,
          candidates,
          auxiliaryData: { donations: [] }, // Could use contracts as auxiliary data
        });

        if (result.chosen) {
          links.push({
            sourceId: result.chosen.id,
            targetId: contract.id,
            edgeType: rule.edgeType,
            confidence: result.confidence * rule.weight,
            reasoning: [
              `Vendor for contract "${contract.contractNumber}"`,
              `Value: $${contract.value.toLocaleString()}`,
              `Department: ${contract.department}`,
              `Sole-source: ${contract.isSoleSource}`,
              ...result.reasoning,
            ],
            method: `rule:${rule.name}+disambiguation:${result.method}`,
          });
        }
      }
    }

    return links;
  }

  // Committee → Lobbying Links

  private linkCommitteeLobbyingOversight(
    rule: LinkingRule,
    committees: Committee[],
    filings: LobbyingFiling[],
  ): LinkResult[] {
    const links: LinkResult[] = [];

    for (const committee of committees) {
      for (const filing of filings) {
        // Check if committee chamber matches filing institution
        if (committee.chamber && filing.institution) {
          const match = this.resolver.resolveOrgNames(
            committee.chamber,
            filing.institution,
          );

          if (match >= 0.7) {
            links.push({
              sourceId: committee.id,
              targetId: filing.id,
              edgeType: rule.edgeType,
              confidence: match * rule.weight,
              reasoning: [
                `Committee chamber "${committee.chamber}" matches lobbying institution "${filing.institution}"`,
                `Committee mandate: ${committee.mandate.substring(0, 80)}...`,
                `Filing subject: ${filing.subjectMatter.substring(0, 80)}...`,
              ],
              method: `rule:${rule.name}`,
            });
          }
        }
      }
    }

    return links;
  }

  // Helper Methods

  private findPersonCandidates(
    persons: Person[],
    query: string,
  ): LinkCandidate[] {
    const candidates: LinkCandidate[] = [];

    for (const person of persons) {
      let bestScore = 0;
      for (const name of person.names) {
        const score = this.resolver.resolvePersonNames(name, query);
        if (score > bestScore) bestScore = score;
      }

      if (bestScore >= 0.7) {
        candidates.push({
          entity: person,
          confidence: bestScore,
          reasons: [`Name match score: ${bestScore.toFixed(2)}`],
        });
      }
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  private findOrgCandidates(
    organizations: Organization[],
    query: string,
  ): LinkCandidate[] {
    const candidates: LinkCandidate[] = [];

    for (const org of organizations) {
      let bestScore = 0;
      for (const name of org.names) {
        const score = this.resolver.resolveOrgNames(name, query);
        if (score > bestScore) bestScore = score;
      }

      if (bestScore >= 0.7) {
        candidates.push({
          entity: org,
          confidence: bestScore,
          reasons: [`Name match score: ${bestScore.toFixed(2)}`],
        });
      }
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  private deduplicateLinks(links: LinkResult[]): LinkResult[] {
    const seen = new Set<string>();
    const unique: LinkResult[] = [];

    for (const link of links) {
      const key = `${link.sourceId}:${link.targetId}:${link.edgeType}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(link);
      }
    }

    return unique;
  }

  /**
   * Convert LinkResults to Edge objects for the graph.
   */
  linkResultsToEdges(links: LinkResult[]): Edge[] {
    let edgeCounter = 0;

    return links.map((link) => ({
      id: `edge-${++edgeCounter}`,
      source: link.sourceId,
      target: link.targetId,
      type: link.edgeType,
      weight: link.confidence,
      properties: {
        linkingMethod: link.method,
        reasoning: link.reasoning,
      },
      sourceRef: "cross_module_linker",
    }));
  }
}