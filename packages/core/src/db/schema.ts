import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── Persons ────────────────────────────────────────────────────────────
export const persons = sqliteTable("persons", {
  id: text("id").primaryKey(),
  names: text("names", { mode: "json" }).notNull().$type<string[]>(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  province: text("province"),
  city: text("city"),
  source: text("source").notNull(),
  rawData: text("raw_data", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Organizations ──────────────────────────────────────────────────────
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  names: text("names", { mode: "json" }).notNull().$type<string[]>(),
  type: text("type").notNull(),
  industry: text("industry"),
  province: text("province"),
  city: text("city"),
  website: text("website"),
  parentOrganizationId: text("parent_organization_id"),
  source: text("source").notNull(),
  rawData: text("raw_data", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Contracts ──────────────────────────────────────────────────────────
export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  contractNumber: text("contract_number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  vendorName: text("vendor_name").notNull(),
  vendorId: text("vendor_id"),
  department: text("department").notNull(),
  value: real("value").notNull(),
  currency: text("currency").notNull().default("CAD"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  status: text("status").notNull().default("active"),
  isSoleSource: integer("is_sole_source", { mode: "boolean" })
    .notNull()
    .default(false),
  province: text("province"),
  commodityType: text("commodity_type"),
  source: text("source").notNull(),
  rawData: text("raw_data", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Tenders ────────────────────────────────────────────────────────────
export const tenders = sqliteTable("tenders", {
  id: text("id").primaryKey(),
  solicitationNumber: text("solicitation_number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  department: text("department").notNull(),
  estimatedValue: real("estimated_value"),
  currency: text("currency").notNull().default("CAD"),
  publishDate: text("publish_date").notNull(),
  closingDate: text("closing_date").notNull(),
  status: text("status").notNull().default("open"),
  isSoleSource: integer("is_sole_source", { mode: "boolean" })
    .notNull()
    .default(false),
  province: text("province"),
  source: text("source").notNull(),
  rawData: text("raw_data", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Lobbying Filings ───────────────────────────────────────────────────
export const lobbyingFilings = sqliteTable("lobbying_filings", {
  id: text("id").primaryKey(),
  filingNumber: text("filing_number").notNull(),
  registrantName: text("registrant_name").notNull(),
  registrantFirm: text("registrant_firm"),
  registrantPersonId: text("registrant_person_id"),
  clientName: text("client_name").notNull(),
  clientOrganizationId: text("client_organization_id"),
  subjectMatter: text("subject_matter").notNull(),
  communications: text("communications", { mode: "json" })
    .notNull()
    .$type<unknown[]>(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  activities: text("activities", { mode: "json" }).notNull().$type<string[]>(),
  institution: text("institution").notNull(),
  province: text("province"),
  source: text("source").notNull(),
  rawData: text("raw_data", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Donations ──────────────────────────────────────────────────────────
export const donations = sqliteTable("donations", {
  id: text("id").primaryKey(),
  donorName: text("donor_name").notNull(),
  donorPersonId: text("donor_person_id"),
  donorOrganizationId: text("donor_organization_id"),
  recipientName: text("recipient_name").notNull(),
  recipientType: text("recipient_type").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("CAD"),
  date: text("date").notNull(),
  province: text("province"),
  riding: text("riding"),
  isCorporate: integer("is_corporate", { mode: "boolean" })
    .notNull()
    .default(false),
  source: text("source").notNull(),
  rawData: text("raw_data", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Disclosures ────────────────────────────────────────────────────────
export const disclosures = sqliteTable("disclosures", {
  id: text("id").primaryKey(),
  personName: text("person_name").notNull(),
  personId: text("person_id"),
  position: text("position").notNull(),
  department: text("department").notNull(),
  year: integer("year").notNull(),
  interests: text("interests", { mode: "json" }).notNull().$type<unknown[]>(),
  province: text("province"),
  filingDate: text("filing_date").notNull(),
  source: text("source").notNull(),
  rawData: text("raw_data", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── GAC Projects ───────────────────────────────────────────────────────
export const gacProjects = sqliteTable("gac_projects", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  department: text("department").notNull(),
  country: text("country").notNull(),
  region: text("region").notNull(),
  budget: real("budget").notNull(),
  currency: text("currency").notNull().default("CAD"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  status: text("status").notNull().default("active"),
  implementingPartners: text("implementing_partners", { mode: "json" })
    .notNull()
    .$type<unknown[]>(),
  sector: text("sector"),
  source: text("source").notNull(),
  rawData: text("raw_data", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Graph Nodes & Edges ────────────────────────────────────────────────
export const graphNodes = sqliteTable("graph_nodes", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  label: text("label").notNull(),
  properties: text("properties", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const graphEdges = sqliteTable("graph_edges", {
  id: text("id").primaryKey(),
  source: text("source_node")
    .notNull()
    .references(() => graphNodes.id),
  target: text("target_node")
    .notNull()
    .references(() => graphNodes.id),
  type: text("type").notNull(),
  weight: real("weight").notNull().default(1),
  properties: text("properties", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  sourceRef: text("source_ref").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Intelligence Threads ───────────────────────────────────────────────
export const intelligenceThreads = sqliteTable("intelligence_threads", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  signalType: text("signal_type").notNull(),
  confidence: real("confidence").notNull(),
  nodes: text("nodes", { mode: "json" }).notNull().$type<string[]>(),
  edges: text("edges", { mode: "json" }).notNull().$type<string[]>(),
  sources: text("sources", { mode: "json" }).notNull().$type<string[]>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Briefs ─────────────────────────────────────────────────────────────
export const briefs = sqliteTable("briefs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  sections: text("sections", { mode: "json" }).notNull().$type<unknown[]>(),
  entityIds: text("entity_ids", { mode: "json" }).notNull().$type<string[]>(),
  confidence: real("confidence").notNull(),
  generatedAt: text("generated_at").notNull(),
  expiresAt: text("expires_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
