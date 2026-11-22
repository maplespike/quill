/**
 * Shared DB helpers — bridges pipeline-core ingestion modules
 * to the @maplespike/database shared entity tables.
 *
 * Pipeline-core modules write raw data to their own D1Database-backed tables.
 * This module upserts resolved entities into the shared tables so the engine
 * can read from them via loadFromDb().
 */
import { donationAmountBand, getRawDb } from "@maplespike/database";

const now = (): string => new Date().toISOString();

/**
 * Upsert a person into the shared `persons` table.
 * Returns the person ID (existing or new).
 */
export function upsertPerson(
  name: string,
  opts?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    province?: string;
    city?: string;
    source: string;
    rawData?: Record<string, unknown>;
  },
): string {
  const db = getRawDb();
  const rawSource = opts?.source ?? "manual";
  const rawData = opts?.rawData ?? {};
  const names = [name];
  const id = `person-${Buffer.from(name).toString("hex").slice(0, 16)}`;

  db.prepare(
    `INSERT OR IGNORE INTO persons (id, names, first_name, last_name, email, province, city, source, raw_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    JSON.stringify(names),
    opts?.firstName ?? null,
    opts?.lastName ?? null,
    opts?.email ?? null,
    opts?.province ?? null,
    opts?.city ?? null,
    rawSource,
    JSON.stringify(rawData),
    now(),
    now(),
  );

  return id;
}

/**
 * Upsert an organization into the shared `organizations` table.
 */
export function upsertOrganization(
  name: string,
  opts?: {
    type?: string;
    industry?: string;
    province?: string;
    city?: string;
    website?: string;
    parentOrganizationId?: string;
    source: string;
    rawData?: Record<string, unknown>;
  },
): string {
  const db = getRawDb();
  const rawSource = opts?.source ?? "manual";
  const rawData = opts?.rawData ?? {};
  const names = [name];
  const id = `org-${Buffer.from(name).toString("hex").slice(0, 16)}`;

  db.prepare(
    `INSERT OR IGNORE INTO organizations (id, names, type, industry, province, city, website, parent_organization_id, source, raw_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    JSON.stringify(names),
    opts?.type ?? "other",
    opts?.industry ?? null,
    opts?.province ?? null,
    opts?.city ?? null,
    opts?.website ?? null,
    opts?.parentOrganizationId ?? null,
    rawSource,
    JSON.stringify(rawData),
    now(),
    now(),
  );

  return id;
}

/**
 * Upsert a contract into the shared `contracts` table.
 */
export function upsertContract(
  contractNumber: string,
  title: string,
  description: string,
  vendorName: string,
  department: string,
  value: number,
  opts?: {
    vendorId?: string;
    currency?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    isSoleSource?: boolean;
    province?: string;
    commodityType?: string;
    source: string;
    rawData?: Record<string, unknown>;
  },
): string {
  const db = getRawDb();
  const rawSource = opts?.source ?? "manual";
  const rawData = opts?.rawData ?? {};
  const id = `contract-${Buffer.from(contractNumber).toString("hex").slice(0, 16)}`;

  db.prepare(
    `INSERT OR IGNORE INTO contracts (id, contract_number, title, description, vendor_name, vendor_id, department, value, currency, start_date, end_date, status, is_sole_source, province, commodity_type, source, raw_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    contractNumber,
    title,
    description,
    vendorName,
    opts?.vendorId ?? null,
    department,
    value,
    opts?.currency ?? "CAD",
    opts?.startDate ?? now().substring(0, 10),
    opts?.endDate ?? null,
    opts?.status ?? "active",
    opts?.isSoleSource ? 1 : 0,
    opts?.province ?? null,
    opts?.commodityType ?? null,
    rawSource,
    JSON.stringify(rawData),
    now(),
    now(),
  );

  return id;
}

/**
 * Upsert a lobbying filing into the shared `lobbying_filings` table.
 */
export function upsertLobbyingFiling(
  filingNumber: string,
  registrantName: string,
  clientName: string,
  subjectMatter: string,
  opts?: {
    registrantFirm?: string;
    registrantPersonId?: string;
    clientOrganizationId?: string;
    communications?: unknown[];
    startDate?: string;
    endDate?: string;
    activities?: string[];
    institution?: string;
    province?: string;
    source: string;
    rawData?: Record<string, unknown>;
  },
): string {
  const db = getRawDb();
  const rawSource = opts?.source ?? "manual";
  const rawData = opts?.rawData ?? {};
  const id = `lobbying-${Buffer.from(filingNumber).toString("hex")}`;

  db.prepare(
    `INSERT OR IGNORE INTO lobbying_filings (id, filing_number, registrant_name, registrant_firm, registrant_person_id, client_name, client_organization_id, subject_matter, communications, start_date, end_date, activities, institution, province, source, raw_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    filingNumber,
    registrantName,
    opts?.registrantFirm ?? null,
    opts?.registrantPersonId ?? null,
    clientName,
    opts?.clientOrganizationId ?? null,
    subjectMatter,
    JSON.stringify(opts?.communications ?? []),
    opts?.startDate ?? now().substring(0, 10),
    opts?.endDate ?? now().substring(0, 10),
    JSON.stringify(opts?.activities ?? []),
    opts?.institution ?? null,
    opts?.province ?? null,
    rawSource,
    JSON.stringify(rawData),
    now(),
    now(),
  );

  return id;
}

/**
 * Upsert a donation aggregate. The row has no donor name.
 */
export function upsertDonationAggregate(input: {
  party: string;
  riding?: string;
  amount: number;
  contributionCount?: number;
  jurisdiction?: string;
  source: string;
}): string {
  const db = getRawDb();
  const party = input.party.trim() || 'unspecified';
  const riding = input.riding?.trim() ?? '';
  const amountBand = donationAmountBand(input.amount);
  const id = `donation-agg-${Buffer.from(`${input.source}|${party}|${riding}|${amountBand}|${input.jurisdiction ?? ''}`).toString('hex')}`;
  db.prepare(
    `INSERT INTO donations
      (id, party, riding, amount_band, contribution_count, total_amount, jurisdiction, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       contribution_count = contribution_count + excluded.contribution_count,
       total_amount = total_amount + excluded.total_amount,
       updated_at = excluded.updated_at`,
  ).run(
    id,
    party,
    riding,
    amountBand,
    input.contributionCount ?? 1,
    input.amount,
    input.jurisdiction ?? null,
    input.source,
    now(),
    now(),
  );
  return id;
}

/**
 * Upsert a disclosure into the shared `disclosures` table.
 */
export function upsertDisclosure(
  personName: string,
  position: string,
  department: string,
  year: number,
  opts?: {
    personId?: string;
    interests?: unknown[];
    province?: string;
    filingDate?: string;
    source: string;
    rawData?: Record<string, unknown>;
  },
): string {
  const db = getRawDb();
  const rawSource = opts?.source ?? "manual";
  const rawData = opts?.rawData ?? {};
  const id = `disclosure-${Buffer.from(personName + department + year).toString("hex")}`;

  db.prepare(
    `INSERT OR IGNORE INTO disclosures (id, person_name, person_id, position, department, year, interests, province, filing_date, source, raw_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    personName,
    opts?.personId ?? null,
    position,
    department,
    year,
    JSON.stringify(opts?.interests ?? []),
    opts?.province ?? null,
    opts?.filingDate ?? now().substring(0, 10),
    rawSource,
    JSON.stringify(rawData),
    now(),
    now(),
  );

  return id;
}

/**
 * Upsert a GAC project into the shared `gac_projects` table.
 */
export function upsertGacProject(
  projectId: string,
  title: string,
  description: string,
  department: string,
  country: string,
  region: string,
  budget: number,
  opts?: {
    currency?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    implementingPartners?: unknown[];
    sector?: string;
    source: string;
    rawData?: Record<string, unknown>;
  },
): string {
  const db = getRawDb();
  const rawSource = opts?.source ?? "manual";
  const rawData = opts?.rawData ?? {};
  const id = `gac-${Buffer.from(projectId).toString("hex")}`;

  db.prepare(
    `INSERT OR IGNORE INTO gac_projects (id, project_id, title, description, department, country, region, budget, currency, start_date, end_date, status, implementing_partners, sector, source, raw_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    title,
    description,
    department,
    country,
    region,
    budget,
    opts?.currency ?? "CAD",
    opts?.startDate ?? now().substring(0, 10),
    opts?.endDate ?? null,
    opts?.status ?? "active",
    JSON.stringify(opts?.implementingPartners ?? []),
    opts?.sector ?? null,
    rawSource,
    JSON.stringify(rawData),
    now(),
    now(),
  );

  return id;
}
