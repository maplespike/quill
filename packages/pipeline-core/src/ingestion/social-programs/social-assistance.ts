/**
 * Social Assistance (Provincial Welfare) Ingestion — Quill
 *
 * Collects provincial/territorial social assistance and welfare rates
 * from provincial government websites. These are HTML scraped since
 * there is no centralized federal CKAN dataset for provincial welfare rates.
 *
 * Programs covered:
 *   - Ontario Works (ON)
 *   - BC Employment and Assistance (BC)
 *   - Alberta Supports / Income Support (AB)
 *   - Social Solidarity Program / Last Resort Financial Assistance (QC)
 *   - Saskatchewan Income Support (SK)
 *   - Employment and Income Assistance (MB)
 *   - Nova Scotia Employment Support / Income Assistance (NS)
 *   - New Brunswick Social Assistance (NB)
 *   - PEI Social Assistance (PE)
 *   - Newfoundland and Labrador Income Support (NL)
 *   - Yukon Social Assistance (YT)
 *   - Northwest Territories Income Assistance (NT)
 *   - Nunavut Social Assistance (NU)
 *
 * Sources:
 *   - Maytree Welfare Report: https://maytree.com/welfare-reports/
 *   - Provincial government websites (HTML scraped)
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { SocialAssistanceRecord } from './types.js';

const SOCIAL_UA = 'MapleSpike/0.1 (social-programs; mailto:j_kroeker@reverb256.ca)';

/**
 * Known social assistance programs by province/territory.
 * Source: Maytree Welfare Reports + provincial government websites.
 */
export const PROVINCIAL_ASSISTANCE_PROGRAMS: Record<string, { program: string; url: string }> = {
  AB: { program: 'Alberta Income Support / Alberta Supports', url: 'https://www.alberta.ca/income-support' },
  BC: { program: 'BC Employment and Assistance', url: 'https://www2.gov.bc.ca/gov/content/family-social-supports/employment-and-assistance' },
  MB: { program: 'Employment and Income Assistance (EIA)', url: 'https://www.gov.mb.ca/fs/eia/' },
  NB: { program: 'Social Assistance / Transitional Assistance', url: 'https://www2.gnb.ca/content/gnb/en/departments/social_development/social_assistance.html' },
  NL: { program: 'Income Support', url: 'https://www.gov.nl.ca/cssd/income-support/' },
  NS: { program: 'Income Assistance', url: 'https://novascotia.ca/coms/employment/income_assistance/' },
  NT: { program: 'Income Assistance', url: 'https://www.ece.gov.nt.ca/en/services/income-assistance' },
  NU: { program: 'Social Assistance', url: 'https://www.gov.nu.ca/family-services/information/social-assistance' },
  ON: { program: 'Ontario Works', url: 'https://www.ontario.ca/page/ontario-works' },
  PE: { program: 'Social Assistance Program', url: 'https://www.princeedwardisland.ca/en/information/social-development-and-housing/social-assistance-program' },
  QC: { program: 'Social Solidarity Program / Last Resort Financial Assistance', url: 'https://www.quebec.ca/familie-et-soutien-aux-personnes/aide-financiere-dernier-recours' },
  SK: { program: 'Saskatchewan Income Support (SIS)', url: 'https://www.saskatchewan.ca/residents/food-and-emergency-support/saskatchewan-income-support' },
  YT: { program: 'Social Assistance', url: 'https://yukon.ca/en/social-assistance' },
};

/**
 * Reference rates from the Maytree Welfare Report (latest known).
 * These serve as fallback data when HTML scraping fails.
 * Units: CAD/month for maximum total assistance (basic needs + shelter).
 *
 * Household types: 'single_employable', 'single_disabled', 'lone_parent', 'couple_2children'
 *
 * Source: Maytree Welfare in Canada reports (https://maytree.com/welfare-reports/)
 */
export const KNOWN_WELFARE_RATES_2024: Record<string, Partial<Record<string, number>>> = {
  AB: { single_employable: 869, single_disabled: 1746, lone_parent: 1756, couple_2children: 2576 },
  BC: { single_employable: 935, single_disabled: 1526, lone_parent: 1861, couple_2children: 2449 },
  MB: { single_employable: 741, single_disabled: 1282, lone_parent: 1554, couple_2children: 2122 },
  NB: { single_employable: 691, single_disabled: 1057, lone_parent: 1213, couple_2children: 1583 },
  NL: { single_employable: 748, single_disabled: 1132, lone_parent: 1299, couple_2children: 1826 },
  NS: { single_employable: 746, single_disabled: 1193, lone_parent: 1458, couple_2children: 1955 },
  NT: { single_employable: 1473, single_disabled: 2037, lone_parent: 2492, couple_2children: 3381 },
  NU: { single_employable: 1542, single_disabled: 2150, lone_parent: 2597, couple_2children: 3508 },
  ON: { single_employable: 733, single_disabled: 1364, lone_parent: 1597, couple_2children: 2159 },
  PE: { single_employable: 740, single_disabled: 1147, lone_parent: 1409, couple_2children: 1926 },
  QC: { single_employable: 793, single_disabled: 1320, lone_parent: 1446, couple_2children: 1944 },
  SK: { single_employable: 789, single_disabled: 1375, lone_parent: 1575, couple_2children: 2042 },
  YT: { single_employable: 1187, single_disabled: 1822, lone_parent: 2254, couple_2children: 3005 },
};

/**
 * Household type labels used in CSV parsing.
 */
const HOUSEHOLD_TYPES = ['single_employable', 'single_disabled', 'lone_parent', 'couple_2children'] as const;

// ─── HTML Scraping ──────────────────────────────────────────────────────

/**
 * Attempt to scrape social assistance rates from a provincial website.
 * Returns a structured record if successful, null otherwise.
 */
export async function scrapeProvincialAssistance(
  province: string,
): Promise<{ records: SocialAssistanceRecord[]; errors: string[] }> {
  const config = PROVINCIAL_ASSISTANCE_PROGRAMS[province];
  const records: SocialAssistanceRecord[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  if (!config) {
    errors.push(`Unknown province: ${province}`);
    return { records, errors };
  }

  try {
    const resp = await httpGet(config.url, {
      headers: {
        'User-Agent': SOCIAL_UA,
        Accept: 'text/html',
      },
      timeoutMs: 20_000,
    });

    if (resp.statusCode !== 200) {
      errors.push(`HTTP ${resp.statusCode} for ${province} at ${config.url}`);
      return { records, errors };
    }

    const body = resp.body;
    const year = new Date().getFullYear().toString();

    // Try to extract rate data from tables or structured text
    // Look for patterns like "$xxx per month" near welfare/assistance keywords
    const dollarMatches = body.match(/\$[\d,]+(?:\.\d{2})?\s*(?:\/|per)\s*month/gi);
    if (dollarMatches && dollarMatches.length > 0) {
      const rates = dollarMatches.map(m => parseFloat(m.replace(/[$,]/g, ''))).filter(v => !isNaN(v) && v > 0);

      // Deduplicate and assign to household types
      const uniqueRates = [...new Set(rates)].sort((a, b) => a - b);
      const assignedTypes = HOUSEHOLD_TYPES.filter((_, idx) => idx < uniqueRates.length);

      for (let i = 0; i < assignedTypes.length; i++) {
        const id = await computeHash(`sa:${province}:${year}:${assignedTypes[i]}:scraped`, 'sha256');
        records.push({
          id,
          year,
          province,
          program: config.program,
          householdType: assignedTypes[i],
          monthlyBenefit: uniqueRates[i],
          shelterAllowance: null,
          totalAssistance: uniqueRates[i],
          sourceUrl: config.url,
          ingestedAt: now,
        });
      }
    }
  } catch (err) {
    errors.push(`Scrape failed for ${province}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { records, errors };
}

// ─── Fallback Data ──────────────────────────────────────────────────────

/**
 * Generate records from known welfare rates (Maytree data).
 * This serves as the primary data source when CKAN/HTML scraping is unavailable.
 */
export async function generateKnownAssistanceRecords(
  year: string = '2024',
): Promise<SocialAssistanceRecord[]> {
  const records: SocialAssistanceRecord[] = [];
  const now = new Date().toISOString();

  for (const [province, rates] of Object.entries(KNOWN_WELFARE_RATES_2024)) {
    const config = PROVINCIAL_ASSISTANCE_PROGRAMS[province];
    if (!config) continue;

    for (const [householdType, total] of Object.entries(rates)) {
      if (total === undefined) continue;
      const id = await computeHash(`sa:${province}:${year}:${householdType}:known`, 'sha256');
      records.push({
        id,
        year,
        province,
        program: config.program,
        householdType,
        monthlyBenefit: null,
        shelterAllowance: null,
        totalAssistance: total,
        sourceUrl: config.url,
        ingestedAt: now,
      });
    }
  }

  return records;
}

// ─── Combined Ingest ────────────────────────────────────────────────────

/**
 * Ingest all provincial social assistance data.
 * Tries HTML scraping first, falls back to known Maytree rates.
 */
export async function ingestSocialAssistance(): Promise<{
  records: SocialAssistanceRecord[];
  errors: string[];
}> {
  const errors: string[] = [];
  const allRecords: SocialAssistanceRecord[] = [];

  // Try scraping each province
  const scrapeResults = await Promise.all(
    Object.keys(PROVINCIAL_ASSISTANCE_PROGRAMS).map(province => scrapeProvincialAssistance(province)),
  );

  for (const result of scrapeResults) {
    allRecords.push(...result.records);
    errors.push(...result.errors);
  }

  // If no data scraped, use known rates
  if (allRecords.length === 0) {
    const known = await generateKnownAssistanceRecords();
    allRecords.push(...known);
  }

  return { records: allRecords, errors };
}
