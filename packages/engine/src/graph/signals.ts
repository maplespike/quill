/**
 * Signal Detectors
 *
 * Seven signal detectors that cross-reference parsed government data
 * to identify intelligence threads — patterns of potential concern.
 */

import { AliasManager } from "../entity/aliases";
import { EntityResolver } from "../entity/resolver";
import type { Contract } from "../types/contract";
import type { Disclosure } from "../types/disclosure";
import type { Donation } from "../types/donation";
import type { GACProject } from "../types/gac";
import type { IntelligenceThread, SignalType } from "../types/graph";
import type { LobbyingFiling } from "../types/lobbying";
import type { Organization } from "../types/organization";
import type { Person } from "../types/person";

let threadCounter = 0;

function nextThreadId(): string {
  return `thread-${++threadCounter}`;
}

function resetThreadCounter(): void {
  threadCounter = 0;
}

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Find matching organization by name using fuzzy resolution.
 */
function findOrg(
  organizations: Organization[],
  name: string,
  resolver: EntityResolver,
): Organization | undefined {
  for (const org of organizations) {
    if (!org?.names) continue;
    for (const orgName of org.names) {
      if (!orgName) continue;
      if (resolver.resolveOrgNames(orgName, name) >= 0.7) {
        return org;
      }
    }
  }
  return undefined;
}

/**
 * Find matching person by name using fuzzy resolution.
 */
function findPerson(
  persons: Person[],
  name: string,
  resolver: EntityResolver,
): Person | undefined {
  for (const person of persons) {
    for (const pName of person.names) {
      if (resolver.resolvePersonNames(pName, name) >= 0.7) {
        return person;
      }
    }
  }
  return undefined;
}

/**
 * 1. Procurement–Lobbying Overlap
 *
 * Detects vendors who received a government contract AND lobbied
 * the same department that awarded the contract.
 */
export function detectProcurementLobbyingOverlap(
  contracts: Contract[],
  filings: LobbyingFiling[],
  organizations: Organization[],
  _resolver?: EntityResolver,
  _aliasManager?: AliasManager,
): IntelligenceThread[] {
  const resolver =
    _resolver ??
    new EntityResolver(_aliasManager ?? new AliasManager({} as never));
   const threads: IntelligenceThread[] = [];

  for (const contract of contracts) {
    for (const filing of filings) {
      // Check if the vendor name matches the lobbying client
      const nameScore = resolver.resolveOrgNames(
        contract.vendorName,
        filing.clientName,
      );
      if (nameScore < 0.7) continue;

      // Check if the department matches the lobbying institution
      const deptScore = resolver.resolveOrgNames(
        contract.department,
        filing.institution,
      );
      if (deptScore < 0.7) continue;

      const confidence = Math.min(nameScore, deptScore) * 0.95;
      const org = findOrg(organizations, contract.vendorName, resolver);

      threads.push({
        id: nextThreadId(),
        title: `${contract.vendorName}: contract + lobbying of ${contract.department}`,
        description: `${contract.vendorName} received a $${contract.value.toLocaleString()} contract from ${contract.department} while also lobbying the same department regarding "${filing.subjectMatter}".`,
        signalType: "procurement_lobbying_overlap",
        confidence,
        nodes: [contract.id, filing.id, ...(org ? [org.id] : [])],
        edges: [],
        sources: [contract.source, filing.source],
        createdAt: isoNow(),
        updatedAt: isoNow(),
      });
    }
  }

  return threads;
}

/**
 * 2. Revolving Door
 *
 * Detects former Designated Public Office Holders (DPOH) who are now
 * lobbying their former department.
 */
export function detectRevolvingDoor(
  persons: Person[],
  filings: LobbyingFiling[],
  _resolver?: EntityResolver,
  _aliasManager?: AliasManager,
): IntelligenceThread[] {
  const resolver =
    _resolver ??
    new EntityResolver(_aliasManager ?? new AliasManager({} as never));
   const threads: IntelligenceThread[] = [];

  for (const person of persons) {
    // Find government roles
    const govRoles = person.roles.filter(
      (r) =>
        r.category === "elected" ||
        r.category === "appointed" ||
        r.category === "political_staff" ||
        r.category === "civil_service",
    );
    if (govRoles.length === 0) continue;

    // Check if this person is a lobbyist in any filing
    for (const filing of filings) {
      const registrantName = filing.registrant.name;
      let isMatch = false;
      for (const pName of person.names) {
        if (resolver.resolvePersonNames(pName, registrantName) >= 0.7) {
          isMatch = true;
          break;
        }
      }
      if (!isMatch) continue;

      // Check if they're lobbying their former department
      for (const role of govRoles) {
        const deptMatch = resolver.resolveOrgNames(
          role.organization,
          filing.institution,
        );
        if (deptMatch >= 0.7) {
          threads.push({
            id: nextThreadId(),
            title: `Revolving door: ${person.names[0]} lobbying ${filing.institution}`,
            description: `${person.names[0]} previously served as ${role.title} at ${role.organization} and is now lobbying ${filing.institution} regarding "${filing.subjectMatter}".`,
            signalType: "revolving_door",
            confidence: 0.85 * deptMatch,
            nodes: [person.id, filing.id],
            edges: [],
            sources: [filing.source],
            createdAt: isoNow(),
            updatedAt: isoNow(),
          });
        }
      }
    }
  }

  return threads;
}

/**
 * 3. Spousal Interest Proximity
 *
 * Detects cases where a public office holder's spouse has financial interests
 * in a vendor that received contracts from that office holder's department.
 */
export function detectSpousalInterestProximity(
  disclosures: Disclosure[],
  contracts: Contract[],
  persons: Person[],
  organizations: Organization[],
  _resolver?: EntityResolver,
  _aliasManager?: AliasManager,
): IntelligenceThread[] {
  const resolver =
    _resolver ??
    new EntityResolver(_aliasManager ?? new AliasManager({} as never));
   const threads: IntelligenceThread[] = [];

  // Find persons with spousal relationships
  for (const person of persons) {
    const spousalRels = person.relationships.filter(
      (r) => r.type === "spousal" || r.type === "familial",
    );
    if (spousalRels.length === 0) continue;

    // Find disclosures for this person
    const personDisclosures = disclosures.filter((d) => {
      if (d.personId === person.id) return true;
      for (const pName of person.names) {
        if (resolver.resolvePersonNames(pName, d.personName) >= 0.7)
          return true;
      }
      return false;
    });

    for (const disclosure of personDisclosures) {
      // Check each interest against contract vendors
      for (const interest of disclosure.interests) {
        for (const contract of contracts) {
          if (
            resolver.resolveOrgNames(
              interest.description,
              contract.vendorName,
            ) >= 0.7 &&
            resolver.resolveOrgNames(
              disclosure.department,
              contract.department,
            ) >= 0.7
          ) {
            threads.push({
              id: nextThreadId(),
              title: `Spousal interest: ${person.names[0]} — ${interest.description}`,
              description: `${person.names[0]} disclosed spousal interest in "${interest.description}" (${interest.category}), and ${contract.vendorName} received a $${contract.value.toLocaleString()} contract from ${contract.department}.`,
              signalType: "spousal_interest_proximity",
              confidence: 0.75,
              nodes: [person.id, disclosure.id, contract.id],
              edges: [],
              sources: [disclosure.source, contract.source],
              createdAt: isoNow(),
              updatedAt: isoNow(),
            });
          }
        }
      }
    }
  }

  return threads;
}

/**
 * 4. Sole-Source Heavy Lobbying
 *
 * Detects sole-source contracts awarded to vendors that heavily lobbied
 * the awarding department.
 */
export function detectSoleSourceHeavyLobbying(
  contracts: Contract[],
  filings: LobbyingFiling[],
  organizations: Organization[],
  _resolver?: EntityResolver,
  _aliasManager?: AliasManager,
): IntelligenceThread[] {
  const resolver =
    _resolver ??
    new EntityResolver(_aliasManager ?? new AliasManager({} as never));
   const threads: IntelligenceThread[] = [];

  for (const contract of contracts) {
    if (!contract.isSoleSource) continue;

    // Find filings where the client matches the vendor and institution matches the department
    const relatedFilings = filings.filter((f) => {
      const nameMatch = resolver.resolveOrgNames(
        contract.vendorName,
        f.clientName,
      );
      const deptMatch = resolver.resolveOrgNames(
        contract.department,
        f.institution,
      );
      return nameMatch >= 0.7 && deptMatch >= 0.7;
    });

    // "Heavy" lobbying = 3+ communications
    const totalCommunications = relatedFilings.reduce(
      (sum, f) => sum + f.communications.length,
      0,
    );
    if (totalCommunications < 3) continue;

    const org = findOrg(organizations, contract.vendorName, resolver);
    const confidence = Math.min(0.9, 0.6 + totalCommunications * 0.05);

    threads.push({
      id: nextThreadId(),
      title: `Sole-source + heavy lobbying: ${contract.vendorName} → ${contract.department}`,
      description: `${contract.vendorName} received a sole-source $${contract.value.toLocaleString()} contract from ${contract.department} after ${totalCommunications} lobbying communications with the same department.`,
      signalType: "sole_source_heavy_lobbying",
      confidence,
      nodes: [
        contract.id,
        ...relatedFilings.map((f) => f.id),
        ...(org ? [org.id] : []),
      ],
      edges: [],
      sources: [contract.source, ...relatedFilings.map((f) => f.source)],
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
  }

  return threads;
}

/**
 * 5. Donation Proximity Correlation
 *
 * Detects donors who are also vendors or lobbyists near a recipient's portfolio.
 */
export function detectDonationProximityCorrelation(
  donations: Donation[],
  contracts: Contract[],
  filings: LobbyingFiling[],
  persons: Person[],
  organizations: Organization[],
  _resolver?: EntityResolver,
  _aliasManager?: AliasManager,
): IntelligenceThread[] {
  const resolver =
    _resolver ??
    new EntityResolver(_aliasManager ?? new AliasManager({} as never));
   const threads: IntelligenceThread[] = [];

  for (const donation of donations) {
    // Check if donor is also a contract vendor
    for (const contract of contracts) {
      const donorIsVendor =
        resolver.resolveOrgNames(donation.donorName, contract.vendorName) >=
        0.7;

      // Check if donor org matches lobbying client
      const donorIsLobbyist = filings.some(
        (f) =>
          resolver.resolveOrgNames(donation.donorName, f.clientName) >= 0.7,
      );

      if (!donorIsVendor && !donorIsLobbyist) continue;

      // Check temporal proximity (within 2 years)
      const donationDate = new Date(donation.date);
      const contractDate = new Date(contract.startDate);
      const diffMonths =
        Math.abs(donationDate.getTime() - contractDate.getTime()) /
        (1000 * 60 * 60 * 24 * 30);

      if (diffMonths > 24) continue;

      const org = findOrg(organizations, donation.donorName, resolver);
      const confidence = donorIsVendor && donorIsLobbyist ? 0.85 : 0.7;

      threads.push({
        id: nextThreadId(),
        title: `Donation–contract proximity: ${donation.donorName}`,
        description: `${donation.donorName} donated $${donation.amount.toLocaleString()} to ${donation.recipientName} and ${donorIsVendor ? `received a $${contract.value.toLocaleString()} contract from ${contract.department}` : "lobbied the same department"} within ${Math.round(diffMonths)} months.`,
        signalType: "donation_proximity_correlation",
        confidence,
        nodes: [donation.id, contract.id, ...(org ? [org.id] : [])],
        edges: [],
        sources: [donation.source, contract.source],
        createdAt: isoNow(),
        updatedAt: isoNow(),
      });
    }
  }

  return threads;
}

/**
 * 6. Mandate Divergence
 *
 * Detects government spending that contradicts mandate letter promises.
 * Uses simplified promise tracking.
 */
export interface MandatePromise {
  id: string;
  department: string;
  promise: string;
  category: string;
  amount?: number; // expected spending
  direction: "increase" | "decrease" | "maintain";
}

export function detectMandateDivergence(
  contracts: Contract[],
  promises: MandatePromise[],
  _resolver?: EntityResolver,
  _aliasManager?: AliasManager,
): IntelligenceThread[] {
  const resolver =
    _resolver ??
    new EntityResolver(_aliasManager ?? new AliasManager({} as never));
   const threads: IntelligenceThread[] = [];

  // Group contracts by department
  const deptContracts = new Map<string, Contract[]>();
  for (const contract of contracts) {
    const key = contract.department;
    if (!deptContracts.has(key)) deptContracts.set(key, []);
    deptContracts.get(key)!.push(contract);
  }

  for (const promise of promises) {
    // Find contracts matching the department
    for (const [dept, deptCons] of deptContracts) {
      const deptMatch = resolver.resolveOrgNames(dept, promise.department);
      if (deptMatch < 0.7) continue;

      const totalSpending = deptCons.reduce((sum, c) => sum + c.value, 0);

      if (
        promise.direction === "decrease" &&
        totalSpending > (promise.amount ?? 0)
      ) {
        threads.push({
          id: nextThreadId(),
          title: `Mandate divergence: ${promise.department} spending vs. promise`,
          description: `${promise.department} was directed to "${promise.promise}" (expected decrease to $${(promise.amount ?? 0).toLocaleString()}), but total contract spending is $${totalSpending.toLocaleString()}.`,
          signalType: "mandate_divergence",
          confidence: 0.7,
          nodes: deptCons.map((c) => c.id),
          edges: [],
          sources: deptCons.map((c) => c.source),
          createdAt: isoNow(),
          updatedAt: isoNow(),
        });
      }

      if (
        promise.direction === "increase" &&
        totalSpending < (promise.amount ?? Infinity)
      ) {
        threads.push({
          id: nextThreadId(),
          title: `Mandate underfunding: ${promise.department} vs. promise`,
          description: `${promise.department} was directed to "${promise.promise}" (expected $${(promise.amount ?? 0).toLocaleString()} spending), but only $${totalSpending.toLocaleString()} in contracts found.`,
          signalType: "mandate_divergence",
          confidence: 0.6,
          nodes: deptCons.map((c) => c.id),
          edges: [],
          sources: deptCons.map((c) => c.source),
          createdAt: isoNow(),
          updatedAt: isoNow(),
        });
      }
    }
  }

  return threads;
}

/**
 * 7. International Layering
 *
 * Detects organizations that appear simultaneously in:
 * - Domestic procurement (contracts)
 * - International development (GAC projects)
 * - Lobbying
 */
export function detectInternationalLayering(
  contracts: Contract[],
  gacProjects: GACProject[],
  filings: LobbyingFiling[],
  organizations: Organization[],
  _resolver?: EntityResolver,
  _aliasManager?: AliasManager,
): IntelligenceThread[] {
  const resolver =
    _resolver ??
    new EntityResolver(_aliasManager ?? new AliasManager({} as never));
   const threads: IntelligenceThread[] = [];

  for (const org of organizations) {
    const orgName = org.names[0];
    if (!orgName) continue;

    // Find domestic contracts
    const matchingContracts = contracts.filter(
      (c) => resolver.resolveOrgNames(c.vendorName, orgName) >= 0.7,
    );
    if (matchingContracts.length === 0) continue;

    // Find GAC projects where this org is an implementing partner
    const matchingGacProjects = gacProjects.filter((p) =>
      p.implementingPartners.some(
        (ip) => resolver.resolveOrgNames(ip.name, orgName) >= 0.7,
      ),
    );
    if (matchingGacProjects.length === 0) continue;

    // Find lobbying filings
    const matchingFilings = filings.filter(
      (f) => resolver.resolveOrgNames(f.clientName, orgName) >= 0.7,
    );

    if (matchingFilings.length === 0) continue;

    // All three present → international layering signal
    const totalDomestic = matchingContracts.reduce(
      (sum, c) => sum + c.value,
      0,
    );
    const totalInternational = matchingGacProjects.reduce(
      (sum, p) => sum + p.budget,
      0,
    );

    threads.push({
      id: nextThreadId(),
      title: `International layering: ${orgName}`,
      description: `${orgName} has $${totalDomestic.toLocaleString()} in domestic contracts, $${totalInternational.toLocaleString()} in GAC international projects, and ${matchingFilings.length} lobbying filing(s). This multi-role presence across domestic procurement, international development, and lobbying deserves scrutiny.`,
      signalType: "international_layering",
      confidence: 0.8,
      nodes: [
        org.id,
        ...matchingContracts.map((c) => c.id),
        ...matchingGacProjects.map((p) => p.id),
        ...matchingFilings.map((f) => f.id),
      ],
      edges: [],
      sources: [
        ...matchingContracts.map((c) => c.source),
        ...matchingGacProjects.map((p) => p.source),
        ...matchingFilings.map((f) => f.source),
      ],
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
  }

  return threads;
}

/**
 * Run all 7 signal detectors and return combined results.
 */
export function runAllDetectors(
  contracts: Contract[],
  filings: LobbyingFiling[],
  donations: Donation[],
  disclosures: Disclosure[],
  gacProjects: GACProject[],
  persons: Person[],
  organizations: Organization[],
  promises: MandatePromise[],
  aliasManager: AliasManager,
): IntelligenceThread[] {
  // Each detector used to restart the id counter, so two detectors both
  // emitted `thread-1` and the brief insert failed the unique constraint.
  resetThreadCounter();
  const resolver = new EntityResolver(aliasManager);

  return [
    ...detectProcurementLobbyingOverlap(
      contracts,
      filings,
      organizations,
      resolver,
      aliasManager,
    ),
    ...detectRevolvingDoor(persons, filings, resolver, aliasManager),
    ...detectSpousalInterestProximity(
      disclosures,
      contracts,
      persons,
      organizations,
      resolver,
      aliasManager,
    ),
    ...detectSoleSourceHeavyLobbying(
      contracts,
      filings,
      organizations,
      resolver,
      aliasManager,
    ),
    ...detectDonationProximityCorrelation(
      donations,
      contracts,
      filings,
      persons,
      organizations,
      resolver,
      aliasManager,
    ),
    ...detectMandateDivergence(contracts, promises, resolver, aliasManager),
    ...detectInternationalLayering(
      contracts,
      gacProjects,
      filings,
      organizations,
      resolver,
      aliasManager,
    ),
  ];
}

export { isoNow };
