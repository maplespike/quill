/**
 * Elections Canada Third-Party Advertiser Registry Ingestion — Quill
 *
 * Orchestrates third-party advertiser data ingestion from Elections Canada
 * and open.canada.ca.  This is the "dark money in elections" data source —
 * tracking unions, corporations, issue groups, and individuals who spend
 * money on Canadian federal election advertising outside of political parties.
 *
 * Pipeline:
 *   1. Fetch third-party registry records from CKAN and/or Elections Canada
 *   2. Parse raw records into structured ThirdPartyAd objects
 *   3. Categorize by registrant type (union/corporation/issue-group/individual)
 *   4. Persist to D1 database
 *   5. Enable search and cross-referencing with influence + corporate modules
 *
 * Designed for cron-based ingestion and ad-hoc queries.
 */

import { fetchThirdPartyRegistry, fetchFinancialReports } from './fetcher.js';
import {
  parseThirdPartyAds,
  parseThirdPartySpendings,
  parseThirdPartyCSV,
  categorizeByType,
} from './parser.js';
import { ELECTIONS_SOURCES } from './constants.js';
import type {
  ThirdPartyAd,
  ThirdPartySpending,
  ThirdPartyType,
  ElectionsIngestionResult,
  RawThirdPartyRecord,
  RawThirdPartySpendingRecord,
} from './types.js';
import type { D1Database } from '../committees/db.js';
import { upsertOrganization, upsertDonationAggregate } from '../../shared-db.js';


/**
 * Ingest Elections Canada third-party advertiser records into the database.
 *
 * @param db — D1 database instance (null for dry-run / parse-only mode)
 * @param options — Configuration options
 */
export async function ingestThirdPartyAds(
  db: D1Database | null,
  options: {
    /** Limit records per source */
    limit?: number;
    /** Force re-ingestion of existing records */
    force?: boolean;
    /** Only specific CKAN package IDs */
    ckanPackageIds?: string[];
    /** Also fetch financial spending breakdowns */
    includeSpending?: boolean;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<ElectionsIngestionResult> {
  const startTime = Date.now();
  const result: ElectionsIngestionResult = {
    source: 'elections-third-party-ads',
    recordsFound: 0,
    recordsIngested: 0,
    categoriesFound: {
      union: 0,
      corporation: 0,
      'issue-group': 0,
      individual: 0,
      other: 0,
    },
    totalSpending: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Phase 1: Fetch registry records
    log('[Elections] Fetching third-party advertiser registry...');
    const fetched = await fetchThirdPartyRegistry({
      limit: options.limit,
      ckanPackageIds: options.ckanPackageIds,
    });

    result.recordsFound = fetched.records.length;
    log(`[Elections] Found ${fetched.records.length} raw records from ${fetched.source}`);

    for (const err of fetched.errors) {
      result.errors.push(`Fetch: ${err}`);
    }

    if (fetched.records.length === 0) {
      log('[Elections] No records found from any source');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Phase 2: Parse — try CSV first, then structured records
    log('[Elections] Parsing raw records...');
    let ads: ThirdPartyAd[] = [];

    // Check if we have CSV data embedded in raw records
    const csvRecords = fetched.records.filter(r => r.rawCsvData);
    if (csvRecords.length > 0) {
      const allCsvData = csvRecords.map(r => r.rawCsvData as string).join('\n');
      const parsedCsv = parseThirdPartyCSV(allCsvData);
      ads = await parseThirdPartyAds(parsedCsv, {
        sourceSystem: fetched.source,
      });
    } else {
      ads = await parseThirdPartyAds(fetched.records, {
        sourceSystem: fetched.source,
      });
    }

    log(`[Elections] Parsed ${ads.length} structured advertiser records`);

    // Phase 3: Persist to database
    if (db) {
      log('[Elections] Persisting to database...');
      for (const ad of ads) {
        try {
          // Check for existing record unless force flag
          if (!options.force) {
            const existing = await db.prepare(
              'SELECT 1 FROM third_party_ads WHERE id = ? LIMIT 1',
            ).bind(ad.id).first();

            if (existing) {
              continue;
            }
          }

          // Upsert advertiser record
          await db.prepare(`
            INSERT OR REPLACE INTO third_party_ads
              (id, registrant_name, registrant_type,
               address, city, province, postal_code, telephone,
               officer_name, officer_title,
               targeted_ridings, issue_focus, platforms,
               election_period_type, election_name, election_period_start, election_period_end,
               total_spending, spending_limit,
               registration_number, registration_date,
               is_tracked_influence_actor, influence_actor_id,
               is_tracked_corporate_entity, corporate_entity_number,
               source_url, source_system,
               ckan_package_id, ckan_resource_id,
               ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?)
          `).bind(
            ad.id,
            ad.registrantName,
            ad.registrantType,
            ad.address,
            ad.city,
            ad.province,
            ad.postalCode,
            ad.telephone,
            ad.officerName,
            ad.officerTitle,
            JSON.stringify(ad.targetedRidings),
            JSON.stringify(ad.issueFocus),
            JSON.stringify(ad.platforms),
            ad.electionPeriod.type,
            ad.electionPeriod.electionName,
            ad.electionPeriod.startDate,
            ad.electionPeriod.endDate,
            ad.totalSpending,
            ad.spendingLimit,
            ad.registrationNumber,
            ad.registrationDate,
            ad.isTrackedInfluenceActor ? 1 : 0,
            ad.influenceActorId,
            ad.isTrackedCorporateEntity ? 1 : 0,
            ad.corporateEntityNumber,
            ad.sourceUrl,
            ad.sourceSystem,
            ad.ckanPackageId,
            ad.ckanResourceId,
            ad.ingestedAt,
          ).run();

          result.recordsIngested++;

          // Track categories
          const cat = ad.registrantType;
          if (cat in result.categoriesFound) {
            result.categoriesFound[cat]++;
          }

          // Aggregate total spending
          if (ad.totalSpending !== null) {
            result.totalSpending += ad.totalSpending;
          }

          // Also upsert to shared tables
          if (ad.registrantType !== 'individual') {
            try {
              upsertOrganization(ad.registrantName, {
                type: ad.registrantType,
                province: ad.province ?? undefined,
                city: ad.city ?? undefined,
                source: "elections",
                rawData: {
                  influenceActorId: ad.influenceActorId,
                  corporateEntityNumber: ad.corporateEntityNumber,
                },
              });
            } catch { /* non-fatal */ }
          }
          if (ad.totalSpending !== null && ad.totalSpending > 0) {
            try {
              upsertDonationAggregate({
                party: 'unspecified',
                riding: ad.targetedRidings?.[0],
                amount: ad.totalSpending,
                jurisdiction: ad.province ?? undefined,
                source: 'elections',
              });
            } catch { /* non-fatal */ }
          }

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${ad.registrantName}: ${msg}`);
        }
      }

      log(`[Elections] Persisted ${result.recordsIngested} advertiser records`);
    } else {
      // No DB — just return the counts
      result.recordsIngested = ads.length;
      for (const ad of ads) {
        const cat = ad.registrantType;
        if (cat in result.categoriesFound) {
          result.categoriesFound[cat]++;
        }
        if (ad.totalSpending !== null) {
          result.totalSpending += ad.totalSpending;
        }
      }
    }

    // Phase 4: Optionally fetch and persist spending detail
    if (options.includeSpending && db) {
      log('[Elections] Fetching financial spending reports...');
      try {
        const spendingFetched = await fetchFinancialReports({
          limit: options.limit,
          ckanPackageIds: options.ckanPackageIds,
        });

        if (spendingFetched.records.length > 0) {
          const csvSpendRecords = spendingFetched.records.filter(r => r.rawCsvData);
          let spendings: ThirdPartySpending[] = [];

          if (csvSpendRecords.length > 0) {
            const allCsvData = csvSpendRecords.map(r => r.rawCsvData as string).join('\n');
            const parsedCsv = parseThirdPartyCSV(allCsvData);
            spendings = await parseThirdPartySpendings(parsedCsv as unknown as RawThirdPartySpendingRecord[], {
              sourceSystem: spendingFetched.source,
            });
          } else {
            spendings = await parseThirdPartySpendings(spendingFetched.records, {
              sourceSystem: spendingFetched.source,
            });
          }

          // Link spending records to advertiser records
          for (const spending of spendings) {
            try {
              // Find the matching advertiser by name
              const matchingAd = await db.prepare(
                'SELECT id FROM third_party_ads WHERE registrant_name = ? LIMIT 1',
              ).bind(spending.registrantName).first<{ id: string }>();

              if (matchingAd) {
                spending.thirdPartyAdId = matchingAd.id;
              }

              // Upsert spending record
              await db.prepare(`
                INSERT OR REPLACE INTO third_party_spending
                  (id, third_party_ad_id, registrant_name,
                   reporting_period, platform, amount,
                   spending_category, vendor_name, targeted_riding,
                   expense_date, source_url, source_system,
                   ingested_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                spending.id,
                spending.thirdPartyAdId,
                spending.registrantName,
                spending.reportingPeriod,
                spending.platform,
                spending.amount,
                spending.spendingCategory,
                spending.vendorName,
                spending.targetedRiding,
                spending.expenseDate,
                spending.sourceUrl,
                spending.sourceSystem,
                spending.ingestedAt,
              ).run();
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              result.errors.push(`Spending insert ${spending.registrantName}: ${msg}`);
            }
          }

          log(`[Elections] Persisted ${spendings.length} spending records`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Financial reports: ${msg}`);
      }
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fatal: ${msg}`);
    log(`[Elections] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;

  const catSummary = Object.entries(result.categoriesFound)
    .filter(([_, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');

  log(`[Elections] Done in ${result.durationMs}ms: ${result.recordsIngested} ingested` +
    ` (${catSummary})` +
    `, $${result.totalSpending.toFixed(2)} total spending tracked` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));

  return result;
}


/**
 * Get the top spending third-party advertisers.
 */
export async function getTopSpenders(
  db: D1Database,
  limit: number = 20,
  options: {
    /** Filter by registrant type */
    registrantType?: ThirdPartyType;
    /** Filter by election period type */
    electionPeriod?: string;
    /** Minimum spending threshold */
    minSpending?: number;
  } = {},
): Promise<ThirdPartyAd[]> {
  let sql = `
    SELECT * FROM third_party_ads
    WHERE total_spending IS NOT NULL
  `;
  const params: unknown[] = [];

  if (options.registrantType) {
    sql += ' AND registrant_type = ?';
    params.push(options.registrantType);
  }

  if (options.electionPeriod) {
    sql += ' AND election_period_type = ?';
    params.push(options.electionPeriod);
  }

  if (options.minSpending !== undefined) {
    sql += ' AND total_spending >= ?';
    params.push(options.minSpending);
  }

  sql += ` ORDER BY total_spending DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<ThirdPartyAd>();
  return result.results ?? [];
}


/**
 * Search third-party advertisers by name, type, location, or issue focus.
 */
export async function searchThirdParty(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    /** Filter by registrant type */
    registrantType?: ThirdPartyType;
    /** Filter by province */
    province?: string;
    /** Filter by election period type */
    electionPeriod?: string;
    /** Include spending detail records */
    includeSpending?: boolean;
  } = {},
): Promise<ThirdPartyAd[]> {
  let sql = `
    SELECT * FROM third_party_ads
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      registrant_name LIKE ? OR
      issue_focus LIKE ? OR
      targeted_ridings LIKE ? OR
      officer_name LIKE ? OR
      city LIKE ? OR
      address LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q, q, q);
  }

  if (options.registrantType) {
    sql += ' AND registrant_type = ?';
    params.push(options.registrantType);
  }

  if (options.province) {
    sql += ' AND province = ?';
    params.push(options.province);
  }

  if (options.electionPeriod) {
    sql += ' AND election_period_type = ?';
    params.push(options.electionPeriod);
  }

  sql += ` ORDER BY total_spending DESC NULLS LAST, registrant_name ASC LIMIT ?`;
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<ThirdPartyAd>();
  return result.results ?? [];
}


/**
 * Find third-party advertisers who are also tracked in the influence module.
 * This reveals which IOs/NGOs/think tanks are spending on election advertising.
 */
export async function findInfluenceCrossReferences(
  db: D1Database,
  options: {
    limit?: number;
    showOnlyTracked?: boolean;
  } = {},
): Promise<Array<{
  advertiser: ThirdPartyAd;
  influenceActorName: string | null;
  influenceCategory: string | null;
}>> {
  let sql = `
    SELECT
      t.*,
      ia.name as influence_actor_name,
      ia.category as influence_category
    FROM third_party_ads t
    LEFT JOIN influence_actors ia ON t.influence_actor_id = ia.id
    WHERE 1=1
  `;

  const params: unknown[] = [];

  if (options.showOnlyTracked) {
    sql += ' AND t.is_tracked_influence_actor = 1';
  }

  sql += ` ORDER BY t.total_spending DESC NULLS LAST LIMIT ?`;
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<any>();
  return (result.results ?? []).map((r: any) => ({
    advertiser: r,
    influenceActorName: r.influence_actor_name ?? null,
    influenceCategory: r.influence_category ?? null,
  }));
}


/**
 * Find third-party advertisers who are also tracked corporate entities.
 * This reveals which corporations are spending on election advertising.
 */
export async function findCorporateCrossReferences(
  db: D1Database,
  options: {
    limit?: number;
    showOnlyTracked?: boolean;
  } = {},
): Promise<Array<{
  advertiser: ThirdPartyAd;
  corporateName: string | null;
  corporateStatus: string | null;
}>> {
  let sql = `
    SELECT
      t.*,
      ce.legal_name as corporate_name,
      ce.status as corporate_status
    FROM third_party_ads t
    LEFT JOIN corporate_entities ce ON t.corporate_entity_number = ce.corporation_number
    WHERE 1=1
  `;

  const params: unknown[] = [];

  if (options.showOnlyTracked) {
    sql += ' AND t.is_tracked_corporate_entity = 1';
  }

  sql += ` ORDER BY t.total_spending DESC NULLS LAST LIMIT ?`;
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<any>();
  return (result.results ?? []).map((r: any) => ({
    advertiser: r,
    corporateName: r.corporate_name ?? null,
    corporateStatus: r.corporate_status ?? null,
  }));
}


export type {
  ThirdPartyAd,
  ThirdPartySpending,
  ThirdPartyType,
  ElectionPeriod,
  ElectionPeriodType,
  AdvertisingPlatform,
  ElectionsIngestionResult,
  RawThirdPartyRecord,
  RawThirdPartySpendingRecord,
} from './types.js';

export {
  ELECTIONS_SOURCES,
  ckanPackageUrl,
  ckanSearchUrl,
  registryDetailUrl,
} from './constants.js';

export {
  fetchThirdPartyRegistry,
  fetchFinancialReports,
} from './fetcher.js';

export {
  parseThirdPartyAd,
  parseThirdPartyAds,
  parseThirdPartyCSV,
  parseThirdPartySpending,
  parseThirdPartySpendings,
  categorizeByType,
} from './parser.js';
