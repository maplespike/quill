import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const persons = sqliteTable(
  "persons",
  {
    id: text("id").primaryKey(),
    names: text("names", { mode: "json" }).notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email"),
    province: text("province"),
    city: text("city"),
    source: text("source").notNull(),
    rawData: text("raw_data").notNull(),
    createdAt: text("created_at").notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull()
      .default(sql`(datetime('now'))`),
  }
);

export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    names: text("names", { mode: "json" }).notNull(),
    type: text("type").notNull(),
    industry: text("industry"),
    province: text("province"),
    city: text("city"),
    website: text("website"),
    parentOrganizationId: text("parent_organization_id"),
    source: text("source").notNull(),
    rawData: text("raw_data").notNull(),
    createdAt: text("created_at").notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull()
      .default(sql`(datetime('now'))`),
  }
);

export const contracts = sqliteTable(
  "contracts",
  {
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
    isSoleSource: integer("is_sole_source").notNull().default(0),
    province: text("province"),
    commodityType: text("commodity_type"),
    source: text("source").notNull(),
    rawData: text("raw_data").notNull(),
    createdAt: text("created_at").notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull()
      .default(sql`(datetime('now'))`),
  }
);

export const tenders = sqliteTable(
  "tenders",
  {
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
    isSoleSource: integer("is_sole_source").notNull().default(0),
    province: text("province"),
    source: text("source").notNull(),
    rawData: text("raw_data").notNull(),
    createdAt: text("created_at").notNull()
      .default(sql`(datetime('now))`),
    updatedAt: text("updated_at").notNull()
      .default(sql`(datetime('now))`),
  }
);

export const lobbyingFilings = sqliteTable(
  "lobbying_filings",
  {
    id: text("id").primaryKey().notNull(),
    filingNumber: text("filing_number").notNull(),
    registrantName: text("registrant_name").notNull(),
    registrantFirm: text("registrant_firm"),
    registrantPersonId: text("registrant_person_id"),
    clientName: text("client_name").notNull(),
    clientOrganizationId: text("client_organization_id"),
    subjectMatter: text("subject_matter").notNull(),
    communications: text("communications").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    activities: text("activities").notNull(),
    institution: text("institution").notNull(),
    province: text("province"),
    source: text("source").notNull(),
    rawData: text("raw_data").notNull(),
    createdAt: text("created_at").notNull()
      .default(sql`(datetime('now))`),
    updatedAt: text("updated_at").notNull()
      .default(sql`(datetime('now))`),
  }
);

export const donations = sqliteTable(
  "donations",
  {
    id: text("id").primaryKey().notNull(),
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
    isCorporate: integer("is_corporate").notNull().default(0),
    source: text("source").notNull(),
    rawData: text("raw_data").notNull(),
    createdAt: text("created_at").notNull()
      .default(sql`(datetime('now))`),
    updatedAt: text("updated_at").notNull()
      .default(sql`(datetime('now))`),
  }
);

export const disclosures = sqliteTable(
  "disclosures",
  {
    id: text("id").primaryKey().notNull(),
    personName: text("person_name").notNull(),
    personId: text("person_id"),
    position: text("position").notNull(),
    department: text("department").notNull(),
    year: integer("year").notNull(),
    interests: text("interests").notNull(),
    province: text("province"),
    filingDate: text("filing_date").notNull(),
    source: text("source").notNull(),
    rawData: text("raw_data").notNull(),
    createdAt: text("created_at").notNull()
      .default(sql`(datetime('now))`),
    updatedAt: text("updated_at").notNull()
      .default(sql`(datetime('now))`),
  }
);

export const gacProjects = sqliteTable(
  "gac_projects",
  {
    id: text("id").primaryKey().notNull(),
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
    implementingPartners: text("implementing_partners").notNull(),
    sector: text("sector"),
    source: text("source").notNull(),
    rawData: text("raw_data").notNull(),
    createdAt: text("created_at").notNull()
      .default(sql`(datetime('now))`),
    updatedAt: text("updated_at").notNull()
      .default(sql`(datetime('now))`),
  }
);

export const graphNodes = sqliteTable(
  "graph_nodes",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    label: text("label").notNull(),
    properties: text("properties").notNull(),
    createdAt: text("created_at").notNull()
      .default(sql`(datetime('now))`),
  }
);

export const graphEdges = sqliteTable(
  "graph_edges",
  {
    id: text("id").primaryKey().notNull(),
    source: text("source_node").notNull()
      .references(() => graphNodes.id),
    target: text("target_node").notNull()
      .references(() => graphNodes.id),
    type: text("type").notNull(),
    weight: real("weight").notNull().default(1),
    properties: text("properties").notNull(),
    sourceRef: text("source_ref").notNull(),
    createdAt: text("created_at").notNull()
      .default(sql`(datetime('now))`),
  }
);

export const intelligenceThreads = sqliteTable(
  "intelligence_threads",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    signalType: text("signal_type").notNull(),
    confidence: real("confidence").notNull(),
    nodes: text("nodes").notNull(),
    edges: text("edges").notNull(),
    sources: text("sources").notNull(),
    createdAt: text("created_at").notNull()
      .default(sql`(datetime('now))`),
    updatedAt: text("updated_at").notNull()
      .default(sql`(datetime('now))`),
  }
);

export const briefs = sqliteTable(
  "briefs",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    sections: text("sections").notNull(),
    entityIds: text("entity_ids").notNull(),
    confidence: real("confidence").notNull(),
    generatedAt: text("generated_at").notNull()
      .default(sql`(datetime('now))`),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull()
      .default(sql`(datetime('now))`),
  }
);

// ─── Committees ──────────────────────────────────────────────────────────────
export const committees = sqliteTable(
  "committees",
  {
    id: text("id").primaryKey().notNull(),
    parliament: text("parliament").notNull(),
    chamber: text("chamber").notNull(),
    committee_name: text("committee_name").notNull(),
    role: text("role").notNull(),
    name: text("name").notNull(),
    party: text("party"),
    province: text("province"),
    startDate: text("startDate").notNull(),
  }
);

// ─── Committee Meetings ─────────────────────────────────────────────────────
export const committee_meetings = sqliteTable(
  "committee_meetings",
  {
    id: text("id").primaryKey().notNull(),
    committee_id: text("committee_id")
      .notNull()
      .references(() => committees.id),
    meeting: text("meeting").notNull(),
    date: text("date").notNull(),
    topic: text("topic").notNull(),
    inCamera: integer("inCamera").notNull().default(0),
    witnesses: text("witnesses"),
    durationMinutes: integer("durationMinutes"),
  }
);

// ─── Committee Reports ─────────────────────────────────────────────────────
export const committee_reports = sqliteTable(
  "committee_reports",
  {
    id: text("id").primaryKey().notNull(),
    committee_id: text("committee_id")
      .notNull()
      .references(() => committees.id),
    reportNumber: text("reportNumber").notNull(),
    title: text("title").notNull(),
    presentedDate: text("presentedDate").notNull(),
    parliament: text("parliament").notNull(),
    session: text("session"),
    pages: integer("pages"),
    recommendations: integer("recommendations"),
  }
);

// ─── Committee Witnesses ────────────────────────────────────────────────────────────────────────────────────────────
export const committee_witnesses = sqliteTable(
  "committee_witnesses",
  {
    id: text("id").primaryKey().notNull(),
    committee_id: text("committee_id")
      .notNull()
      .references(() => committees.id),
    witness: text("witness").notNull(),
    role: text("role").notNull(),
    date: text("date").notNull(),
    topic: text("topic").notNull(),
    meeting: text("meeting").notNull(),
  }
);

// ─── Notification Subscriptions ────────────────────────────────────────────────────────────────────────────────────

export const notification_subscriptions = sqliteTable(
  "notification_subscriptions",
  {
    id: text("id").primaryKey().notNull(),
    email: text("email").notNull(),
    sourceFilter: text("source_filter", { mode: "json" }).notNull().$type<string[]>(),
    eventTypes: text("event_types", { mode: "json" }).notNull().$type<string[]>(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    label: text("label"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  }
);

// ─── Notification Events ────────────────────────────────────────────────────────────────────────────────────────────

export const notification_events = sqliteTable(
  "notification_events",
  {
    id: text("id").primaryKey().notNull(),
    subscriptionId: text("subscription_id").notNull()
      .references(() => notification_subscriptions.id),
    sourceId: text("source_id").notNull(),
    eventType: text("event_type").notNull(),
    summary: text("summary").notNull(),
    deliveredAt: text("delivered_at"),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  }
);