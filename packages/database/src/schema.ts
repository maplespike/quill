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
    party: text("party").notNull(),
    riding: text("riding").notNull().default(""),
    amountBand: text("amount_band").notNull(),
    contributionCount: integer("contribution_count").notNull(),
    totalAmount: real("total_amount").notNull(),
    jurisdiction: text("jurisdiction"),
    source: text("source").notNull(),
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

// ─── Governance Committees ─────────────────────────────────────────────────────────────────────────────────────────
export const committee_governance = sqliteTable(
  "committee_governance",
  {
    id: text("id").primaryKey().notNull(),
    names: text("names", { mode: "json" }).notNull().$type<string[]>(),
    type: text("type").notNull(), // standing, special, joint, subcommittee, other
    scope: text("scope").notNull(), // federal, provincial, municipal, other
    chamber: text("chamber"),
    mandate: text("mandate").notNull(),
    parentCommitteeId: text("parent_committee_id"),
    sourceUrl: text("source_url"),
    sourceLastUpdated: text("source_last_updated"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  }
);

export const committee_governance_members = sqliteTable(
  "committee_governance_members",
  {
    id: text("id").primaryKey().notNull(),
    committeeId: text("committee_id").notNull().references(() => committee_governance.id, { onDelete: "cascade" }),
    personId: text("person_id"),
    personName: text("person_name").notNull(),
    role: text("role").notNull(), // chair, vice_chair, member, clerk
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    party: text("party"),
    riding: text("riding"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  }
);

export const committee_governance_meetings = sqliteTable(
  "committee_governance_meetings",
  {
    id: text("id").primaryKey().notNull(),
    committeeId: text("committee_id").notNull().references(() => committee_governance.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    type: text("type").notNull(), // regular, emergency, in_camera
    location: text("location"),
    agenda: text("agenda", { mode: "json" }).$type<string[]>(),
    attendees: text("attendees", { mode: "json" }).$type<string[]>(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  }
);

// ─── Charities ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const charities = sqliteTable(
  "charities",
  {
    id: text("id").primaryKey().notNull(),
    names: text("names", { mode: "json" }).notNull().$type<string[]>(),
    registrationNumber: text("registration_number").unique(),
    type: text("type").notNull(), // charitable_organization, public_foundation, private_foundation, other
    status: text("status").notNull(), // registered, revoked, suspended, pending, other
    mandate: text("mandate").notNull(),
    website: text("website"),
    street: text("street"),
    city: text("city"),
    province: text("province"),
    postalCode: text("postal_code"),
    country: text("country").default("Canada"),
    parentOrganizationId: text("parent_organization_id"),
    sourceUrl: text("source_url"),
    sourceLastUpdated: text("source_last_updated"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  }
);

export const charity_activities = sqliteTable(
  "charity_activities",
  {
    id: text("id").primaryKey().notNull(),
    charityId: text("charity_id").notNull().references(() => charities.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    description: text("description").notNull(),
    beneficiaries: text("beneficiaries").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  }
);

export const charity_financials = sqliteTable(
  "charity_financials",
  {
    id: text("id").primaryKey().notNull(),
    charityId: text("charity_id").notNull().references(() => charities.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    totalRevenue: real("total_revenue").notNull(),
    totalExpenses: real("total_expenses").notNull(),
    assets: real("assets").notNull(),
    currency: text("currency").default("CAD"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  }
);

export const charity_board_members = sqliteTable(
  "charity_board_members",
  {
    id: text("id").primaryKey().notNull(),
    charityId: text("charity_id").notNull().references(() => charities.id, { onDelete: "cascade" }),
    personId: text("person_id"),
    personName: text("person_name").notNull(),
    title: text("title").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    isCompensated: integer("is_compensated", { mode: "boolean" }).default(false),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  }
);

// ─── Notification Subscriptions ────────────────────────────────────────────────────────────────────────────────────

// Decision 0002: notification subscriptions never store plaintext.
// `subject_hash` is HMAC-SHA256(email-or-wallet) used only for
// lookup. Real delivery is performed by the user's client
// (web-push worker or wallet-attested inbox).
export const notification_subscriptions = sqliteTable(
  "notification_subscriptions",
  {
    id: text("id").primaryKey().notNull(),
    subjectHash: text("subject_hash").notNull(),
    sourceFilter: text("source_filter", { mode: "json" }).notNull().$type<string[]>(),
    eventTypes: text("event_types", { mode: "json" }).notNull().$type<string[]>(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    label: text("label"),
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
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

// ─── Billing ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const users = sqliteTable(
  "users",
  {
    tenantId: text("tenant_id").primaryKey().notNull(),
    // Decision 0002: PII avoidance — store HMAC-SHA256 only.
    emailHash: text("email_hash").notNull().unique(),
    authProvider: text("auth_provider").notNull(), // passkey, web3, oauth
    apiKeyHash: text("api_key_hash").notNull().unique(),
    planId: text("plan_id").notNull().default("free"),
    quotaCredits: integer("quota_credits").notNull().default(1000),
    quotaResetAt: integer("quota_reset_at").notNull().default(sql`(strftime('%s', 'now'))`),
    subscriptionStatus: text("subscription_status").notNull().default("active"), // active, cancelled, past_due
    // ── Stripe additions (nullable; only populated after webhook settlement) ──
    // Per ADR-0002 PII avoidance: we never store the Stripe Customer email here;
    // customer-side identity lives in the Stripe dashboard. We only store opaque IDs.
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeSubscriptionStatus: text("stripe_subscription_status"), // mirrors Stripe: active, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired
    stripeCurrentPeriodEnd: integer("stripe_current_period_end"), // unix seconds; used to gate tier expiry
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  }
);

export const plans = sqliteTable(
  "plans",
  {
    planId: text("plan_id").primaryKey().notNull(),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("CAD"),
    creditsPerMonth: integer("credits_per_month").notNull(),
    rateLimitPerMin: integer("rate_limit_per_min").notNull(),
    features: text("features", { mode: "json" }).$type<string[]>().notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  }
);

export const orders = sqliteTable(
  "orders",
  {
    orderId: text("order_id").primaryKey().notNull(),
    tenantId: text("tenant_id").notNull().references(() => users.tenantId),
    planId: text("plan_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("CAD"),
    paymentMethod: text("payment_method").notNull().default("etransfer"), // etransfer, stripe, crypto
    status: text("status").notNull().default("pending"), // pending, paid, expired, cancelled
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull().default(sql`(strftime('%s', 'now'))`),
    paidAt: integer("paid_at"),
    // Stripe linkage (nullable; only set when paymentMethod='stripe')
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
  }
);

// Decision 0002: payment reconciliation never references a person.
// `email_uid` is the bank's anonymous transaction id; senderEmail
// is REMOVED.
export const payment_reconciliations = sqliteTable(
  "payment_reconciliations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    transactionUid: text("transaction_uid").notNull().unique(),
    orderId: text("order_id").references(() => orders.orderId),
    amountCents: integer("amount_cents"),
    reference: text("reference"),
    channel: text("channel").notNull().default("stripe"), // stripe, plaid_ca, interac_webhook
    processedAt: integer("processed_at").notNull().default(sql`(strftime('%s', 'now'))`),
  }
);

export const audit_log = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey().notNull(),
    tenantId: text("tenant_id").references(() => users.tenantId),
    requestId: text("request_id").notNull(),
    endpoint: text("endpoint").notNull(),
    creditsConsumed: integer("credits_consumed").notNull(),
    timestamp: integer("timestamp").notNull().default(sql`(strftime('%s', 'now'))`),
  }
);