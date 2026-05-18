/**
 * Shared DB helpers — bridges pipeline-core ingestion modules
 * to the @maplespike/database shared entity tables.
 *
 * Pipeline-core modules write raw data to their own D1Database-backed tables.
 * This module upserts resolved entities into the shared tables so the engine
 * can read from them via loadFromDb().
 */
import { getRawDb } from "@maplespike/database";

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
