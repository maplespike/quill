/**
 * Entity extraction from GAC international project data.
 * Maps implementing partners to organizations for network analysis.
 */

import type { GACProject, ImplementingPartner } from "../../types";
import { normalizeName } from "../types";

export interface PartnerSummary {
  name: string;
  projectCount: number;
  totalBudget: number;
  countries: Set<string>;
  sectors: Set<string>;
  roles: Set<string>;
}

export interface CountrySummary {
  name: string;
  region: string;
  projectCount: number;
  totalBudget: number;
  partnerCount: number;
}

/**
 * Extract unique implementing partners across all projects.
 */
export function extractPartners(
  projects: GACProject[],
): Map<string, PartnerSummary> {
  const map = new Map<string, PartnerSummary>();

  for (const project of projects) {
    for (const partner of project.implementingPartners) {
      const name = normalizeName(partner.name);
      if (!name) continue;

      const existing = map.get(name);
      if (existing) {
        existing.projectCount++;
        existing.totalBudget += project.budget;
        existing.countries.add(partner.country);
        existing.countries.add(project.country);
        if (project.sector) existing.sectors.add(project.sector);
        existing.roles.add(partner.role);
      } else {
        const sectors = new Set<string>();
        if (project.sector) sectors.add(project.sector);
        map.set(name, {
          name,
          projectCount: 1,
          totalBudget: project.budget,
          countries: new Set([partner.country, project.country]),
          sectors,
          roles: new Set([partner.role]),
        });
      }
    }
  }

  return map;
}

/**
 * Extract country-level project summaries.
 */
export function extractCountries(
  projects: GACProject[],
): Map<string, CountrySummary> {
  const map = new Map<string, CountrySummary>();
  const countryPartners = new Map<string, Set<string>>();

  for (const project of projects) {
    const name = project.country.trim();
    if (!name) continue;

    const partnerSet = countryPartners.get(name) ?? new Set<string>();
    for (const p of project.implementingPartners) {
      partnerSet.add(normalizeName(p.name));
    }
    countryPartners.set(name, partnerSet);

    const existing = map.get(name);
    if (existing) {
      existing.projectCount++;
      existing.totalBudget += project.budget;
      existing.partnerCount = partnerSet.size;
    } else {
      map.set(name, {
        name,
        region: project.region,
        projectCount: 1,
        totalBudget: project.budget,
        partnerCount: partnerSet.size,
      });
    }
  }

  return map;
}

/**
 * Categorize partners by type (NGO, UN Agency, Corporate, Government, Academic).
 */
export function categorizePartners(
  partners: ImplementingPartner[],
): Map<string, ImplementingPartner[]> {
  const categories = new Map<string, ImplementingPartner[]>();

  const UN_KEYWORDS = [
    "united nations",
    "unicef",
    "unhcr",
    "who ",
    "world health",
    "undp",
    "wfp",
    "fao",
    "unesco",
    "unfpa",
    "un women",
    "world food programme",
    "world food program",
  ];
  const NGO_KEYWORDS = [
    "save the children",
    "oxfam",
    "care ",
    "plan international",
    "world vision",
    "doctors without",
    "red cross",
    "médecins",
    "brac",
    "action against hunger",
    "crcs",
    "norwegian refugee",
  ];
  const ACADEMIC_KEYWORDS = [
    "university",
    "institute of",
    "research",
    "college",
  ];
  const GOV_KEYWORDS = [
    "ministry of",
    "government of",
    "department of",
    "national ",
  ];

  for (const partner of partners) {
    const name = normalizeName(partner.name).toLowerCase();
    let category = "Corporate";

    if (UN_KEYWORDS.some((kw) => name.includes(kw))) {
      category = "UN Agency";
    } else if (NGO_KEYWORDS.some((kw) => name.includes(kw))) {
      category = "NGO";
    } else if (ACADEMIC_KEYWORDS.some((kw) => name.includes(kw))) {
      category = "Academic";
    } else if (GOV_KEYWORDS.some((kw) => name.includes(kw))) {
      category = "Government";
    }

    const list = categories.get(category) ?? [];
    list.push(partner);
    categories.set(category, list);
  }

  return categories;
}

/**
 * Group projects by implementing partner.
 */
export function groupByPartner(
  projects: GACProject[],
): Map<string, GACProject[]> {
  const groups = new Map<string, GACProject[]>();
  for (const project of projects) {
    for (const partner of project.implementingPartners) {
      const name = normalizeName(partner.name);
      if (!name) continue;
      const list = groups.get(name) ?? [];
      list.push(project);
      groups.set(name, list);
    }
  }
  return groups;
}
