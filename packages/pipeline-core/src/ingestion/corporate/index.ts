/**
 * Corporate Ingestion — Frostbite Data Pipeline
 *
 * Orchestrates corporate/business data ingestion across all sources:
 *   1. Lobbying Registry — who's influencing government
 *   2. Procurement — who's getting taxpayer contracts
 *   3. Executive Statements — what CEOs are saying publicly
 *   4. Committee cross-reference — connect executive testimony to lobbying
 *
 * Designed to run as a cron job alongside the committee pipeline.
 * All data sources are public-domain and freely accessible.
 *
 * Each function:
 *   - When db is provided: persists parsed records to the database
 *   - When db is null: returns parsed records as structured data in the result
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import { fetchMonthlyCommunicationReports } from './lobbying.js';
import { fetchTendersRss, fetchProactiveDisclosureContracts, isSoleSource } from './procurement.js';
import { fetchCompanyPressReleases, extractExecutiveStatements } from './statements.js';
import { TRACKED_EXECUTIVES } from './constants.js';
import { upsertLobbyingRecords, upsertContractAwards, upsertExecutiveStatements } from './db.js';
import type { D1Database } from '../committees/db.js';
import type {
  CorporateIngestionResult,
  LobbyingRecord,
  ContractAward,
  ExecutiveStatement,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  CSV Parsing Helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * Simple CSV line parser that handles quoted fields.
 * Splits a single CSV line into an array of field values.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse CSV text (with header row) into an array of row objects.
 */
function parseCsvToObjects(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length === 0) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < fields.length; j++) {
      row[headers[j]] = fields[j];
    }
    rows.push(row);
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/*  Lobbying Ingestion                                                 */
/* ------------------------------------------------------------------ */

/**
 * Parse a lobbying CSV row into a LobbyingRecord.
 */
async function csvRowToLobbyingRecord(row: Record<string, string>, sourceUrl: string): Promise<LobbyingRecord | null> {
  const registrantName = (row['Registrant Name'] || row['registrant_name'] || row['RegistrantName'] || '').trim();
  const clientName = (row['Client Name'] || row['client_name'] || row['ClientName'] || '').trim();
  const communicationDate = (row['Communication Date'] || row['communication_date'] || row['CommunicationDate'] || '').trim();

  // Both registrant name and communication date are required
  if (!registrantName || !communicationDate) return null;

  const subjectMatterRaw = (row['Subject Matter'] || row['subject_matter'] || row['SubjectMatter'] || '').trim();
  const subjectMatter = subjectMatterRaw
    ? subjectMatterRaw.split(';').map(s => s.trim()).filter(Boolean)
    : [];

  const content = `${registrantName}|${clientName || registrantName}|${communicationDate}|${subjectMatterRaw}|${sourceUrl}`;
  const id = await computeHash(content, 'sha256');

  return {
    id,
    registrantName,
    registrantClient: (row['Registrant Client'] || row['registrant_client'] || null) || null,
    registrantAddress: (row['Registrant Address'] || row['registrant_address'] || null) || null,
    clientName: clientName || registrantName,
    clientBusiness: (row['Client Business'] || row['client_business'] || null) || null,
    subjectMatter,
    governmentInstitution: (row['Government Institution'] || row['government_institution'] || row['GovernmentInstitution'] || null) || null,
    publicOfficeHolder: (row['Public Office Holder'] || row['public_office_holder'] || row['PublicOfficeHolder'] || null) || null,
    communicationDate,
    startDate: (row['Start Date'] || row['start_date'] || null) || null,
    endDate: (row['End Date'] || row['end_date'] || null) || null,
    lobbyingCostCad: parseFloat(row['Lobbying Cost'] || row['lobbying_cost_cad'] || row['LobbyingCost'] || '') || null,
    lobbyistType: 'consultant',
    sourceUrl,
    ingestedAt: new Date().toISOString(),
  };
}

/**
 * Ingest lobbying data into the database.
 * Downloads the latest monthly communication CSV, parses it,
 * and either persists records or returns them as structured data.
 */
export async function ingestLobbying(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<CorporateIngestionResult> {
  const startTime = Date.now();
  const result: CorporateIngestionResult = {
    source: 'lobbying-registry',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Step 1: Get monthly communication reports
    const reports = await fetchMonthlyCommunicationReports();
    result.recordsFound = reports.length;
    log(`[Lobbying] Found ${reports.length} monthly reports`);

    if (reports.length === 0) {
      log('[Lobbying] No reports found');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Step 2: Sort reports by year/month descending, pick the latest
    const sorted = [...reports].sort((a, b) => (b.year - a.year) || (b.month - a.month));
    const latest = sorted.slice(0, options.limit ?? 3);

    // Step 3: Download and parse CSVs
    const allRecords: LobbyingRecord[] = [];

    for (const report of latest) {
      log(`[Lobbying] Downloading ${report.year}-${String(report.month).padStart(2, '0')} CSV...`);
      try {
        const resp = await httpGet(report.csvUrl, {
          headers: { Accept: 'text/csv,*/*' },
          timeoutMs: 30_000,
        });

        if (resp.statusCode >= 400) {
          log(`[Lobbying] HTTP ${resp.statusCode} for ${report.csvUrl}`);
          continue;
        }

        const csvText = resp.body;
        const rows = parseCsvToObjects(csvText);
        log(`[Lobbying] Parsed ${rows.length} rows from ${report.year}-${String(report.month).padStart(2, '0')}`);

        for (const row of rows) {
          const record = await csvRowToLobbyingRecord(row, report.csvUrl);
          if (record) {
            allRecords.push(record);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`[Lobbying] Error downloading CSV ${report.csvUrl}: ${msg}`);
        result.errors.push(`CSV (${report.year}-${report.month}): ${msg}`);
      }
    }

    // Step 4: Deduplicate by ID
    const seen = new Set<string>();
    const uniqueRecords = allRecords.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    result.recordsFound = uniqueRecords.length;
    log(`[Lobbying] ${uniqueRecords.length} unique records parsed`);

    // Step 5: Persist or return
    if (db) {
      const ingested = await upsertLobbyingRecords(db, uniqueRecords);
      result.recordsIngested = ingested;
      log(`[Lobbying] Persisted ${ingested} lobbying records`);
    } else {
      // Dry-run mode — return records as structured data
      result.recordsIngested = uniqueRecords.length;
      result.records = uniqueRecords;
      log(`[Lobbying] Dry-run — ${uniqueRecords.length} records available`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[Lobbying] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Procurement Ingestion                                              */
/* ------------------------------------------------------------------ */

/**
 * Convert a TenderNotice from the RSS feed into a ContractAward record.
 */
async function tenderNoticeToContractAward(tender: {
  id: string;
  title: string;
  description: string | null;
  publicationDate: string;
  closingDate: string | null;
  organization: string;
  procurementMethod: string | null;
  estimatedValue: number | null;
  tradeAgreement: string | null;
  gsin: string | null;
  url: string;
  status: string;
}): Promise<ContractAward> {
  return {
    id: tender.id,
    vendorName: tender.organization || 'Unknown Vendor',
    vendorAddress: null,
    contractValue: tender.estimatedValue ?? 0,
    currency: 'CAD',
    awardDate: tender.publicationDate,
    startDate: null,
    endDate: tender.closingDate,
    description: tender.description || tender.title,
    department: tender.organization || 'Unknown Department',
    departmentAcronym: null,
    procurementMethod: tender.procurementMethod,
    gsin: tender.gsin,
    tradeAgreement: tender.tradeAgreement,
    bidsReceived: null,
    sourceUrl: tender.url,
    isSoleSource: isSoleSource(tender.description, tender.procurementMethod),
    ingestedAt: new Date().toISOString(),
  };
}

/**
 * Ingest government procurement data.
 * Fetches tender notices from CanadaBuys RSS, converts to ContractAward
 * records, and persists them to the database.
 */
export async function ingestProcurement(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<CorporateIngestionResult> {
  const startTime = Date.now();
  const result: CorporateIngestionResult = {
    source: 'procurement',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Fetch recent tenders from CanadaBuys RSS
    log(`[Procurement] Fetching CanadaBuys tenders...`);
    const tenders = await fetchTendersRss();
    result.recordsFound = tenders.length;
    log(`[Procurement] Found ${tenders.length} tender notices`);

    if (tenders.length === 0) {
      log('[Procurement] No tenders found');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Apply limit if specified
    const limitedTenders = options.limit ? tenders.slice(0, options.limit) : tenders;

    // Check for sole-source contracts
    const soleSource = limitedTenders.filter(t => isSoleSource(t.description, t.procurementMethod));
    log(`[Procurement] ${soleSource.length} sole-source indicators`);

    // Fetch proactive disclosure metadata
    log(`[Procurement] Checking proactive disclosure...`);
    const disclosure = await fetchProactiveDisclosureContracts();
    log(`[Procurement] ${disclosure.total} proactive disclosure contracts in index`);

    // Convert tenders to ContractAward records
    const awards: ContractAward[] = [];
    for (const tender of limitedTenders) {
      try {
        const award = await tenderNoticeToContractAward(tender);
        awards.push(award);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Convert tender ${tender.id}: ${msg}`);
      }
    }

    log(`[Procurement] ${awards.length} contract award records prepared`);

    // Also create records from proactive disclosure contracts if available
    for (const dContract of disclosure.contracts) {
      if (!dContract.department) continue;
      const content = `${dContract.department}|${dContract.description ?? ''}|${dContract.sourceUrl}`;
      const id = await computeHash(content, 'sha256');

      // Check if already in awards list by source URL
      const exists = awards.some(a => a.sourceUrl === dContract.sourceUrl);
      if (exists) continue;

      awards.push({
        id,
        vendorName: dContract.department,
        vendorAddress: null,
        contractValue: 0,
        currency: 'CAD',
        awardDate: new Date().toISOString().split('T')[0],
        startDate: null,
        endDate: null,
        description: dContract.description ?? null,
        department: dContract.department,
        departmentAcronym: null,
        procurementMethod: null,
        gsin: null,
        tradeAgreement: null,
        bidsReceived: null,
        sourceUrl: dContract.sourceUrl ?? disclosure.sourceUrl,
        isSoleSource: false,
        ingestedAt: new Date().toISOString(),
      });
    }

    // Persist or return
    if (db) {
      const ingested = await upsertContractAwards(db, awards);
      result.recordsIngested = ingested;
      log(`[Procurement] Persisted ${ingested} contract award records`);
    } else {
      result.recordsIngested = awards.length;
      result.records = awards;
      log(`[Procurement] Dry-run — ${awards.length} contract award records available`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[Procurement] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Executive Statements Ingestion                                     */
/* ------------------------------------------------------------------ */

/**
 * Collect recent public statements from tracked high-impact executives.
 * Fetches press releases, extracts executive statements, and persists them.
 */
export async function ingestExecutiveStatements(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<CorporateIngestionResult> {
  const startTime = Date.now();
  const result: CorporateIngestionResult = {
    source: 'executive-statements',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Fetch press releases for each tracked organization
    const orgs = Array.from(new Set(TRACKED_EXECUTIVES.map(e => e.organization)));
    log(`[ExecStatements] Tracking ${TRACKED_EXECUTIVES.length} execs across ${orgs.length} orgs`);

    const allStatements: ExecutiveStatement[] = [];

    for (const org of orgs) {
      log(`[ExecStatements] Fetching press releases for ${org}...`);
      try {
        const releases = await fetchCompanyPressReleases(org);
        const statements = extractExecutiveStatements(releases);
        log(`[ExecStatements] Found ${statements.length} statements from ${org}`);

        // Apply limit per organization
        const limited = options.limit ? statements.slice(0, options.limit) : statements;
        allStatements.push(...limited);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`[ExecStatements] Error fetching ${org}: ${msg}`);
        result.errors.push(`${org}: ${msg}`);
      }
    }

    result.recordsFound = allStatements.length;
    log(`[ExecStatements] Found ${allStatements.length} executive statements total`);

    // Log first few for progress visibility
    for (const stmt of allStatements.slice(0, 3)) {
      log(`[ExecStatements] ${stmt.executiveName} (${stmt.organization}): "${stmt.title.substring(0, 80)}"`);
    }

    // Persist or return
    if (db) {
      const ingested = await upsertExecutiveStatements(db, allStatements);
      result.recordsIngested = ingested;
      log(`[ExecStatements] Persisted ${ingested} executive statements`);
    } else {
      result.recordsIngested = allStatements.length;
      result.records = allStatements;
      log(`[ExecStatements] Dry-run — ${allStatements.length} statements available`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[ExecStatements] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Bulk Ingestion                                                     */
/* ------------------------------------------------------------------ */

/**
 * Run all corporate data ingestion pipelines.
 */
export async function ingestAllCorporate(
  db: D1Database | null,
  options: {
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<string, CorporateIngestionResult>> {
  const log = options.onProgress ?? (() => {});

  log('=== Corporate Data Ingestion ===');

  const [lobbying, procurement, statements] = await Promise.all([
    ingestLobbying(db, options),
    ingestProcurement(db, options),
    ingestExecutiveStatements(db, options),
  ]);

  const results: Record<string, CorporateIngestionResult> = {
    'lobbying': lobbying,
    'procurement': procurement,
    'executive-statements': statements,
  };

  log(`\n=== Corporate Summary ===`);
  log(`Lobbying: ${lobbying.recordsFound} records, ${lobbying.recordsIngested} ingested`);
  log(`Procurement: ${procurement.recordsFound} records, ${procurement.recordsIngested} ingested`);
  log(`Exec Statements: ${statements.recordsFound} records, ${statements.recordsIngested} ingested`);

  const totalErrors = lobbying.errors.length + procurement.errors.length + statements.errors.length;
  if (totalErrors > 0) {
    log(`Errors: ${totalErrors}`);
  }

  return results;
}
