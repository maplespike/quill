// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CRTC Ingestion Constants — Quill
 *
 * CRTC URLs, RSS feed patterns, decision numbering conventions,
 * subject matter classifications, and known data sources.
 *
 * Sources:
 *   - Decisions archive:      https://crtc.gc.ca/eng/archive/
 *   - Broadcasting decisions: https://crtc.gc.ca/eng/archive/decision-broadcasting.htm
 *   - Telecom decisions:      https://crtc.gc.ca/eng/archive/decision-telecom.htm
 *   - Broadcasting RSS:       https://crtc.gc.ca/rss/eng/decision-broadcasting.xml
 *   - Telecom RSS:            https://crtc.gc.ca/rss/eng/decision-telecom.xml
 *   - Consultation RSS:       https://crtc.gc.ca/rss/eng/notice-consultation.xml
 *   - Ownership data:         https://crtc.gc.ca/eng/cancon/ownership.htm
 *   - Open Canada CKAN:       https://open.canada.ca/data (CRTC datasets)
 */

/* ------------------------------------------------------------------ */
/*  Base URLs                                                          */
/* ------------------------------------------------------------------ */

/** CRTC base domain */
export const CRTC_BASE_URL = 'https://crtc.gc.ca';

/**
 * CRTC decisions and publications archive.
 * Searchable by year, type (broadcasting/telecom), and keywords.
 */
export const CRTC_DECISIONS_URL = `${CRTC_BASE_URL}/eng/archive/`;

/**
 * CRTC broadcasting decisions archive page.
 * Lists broadcasting decisions, which cover media ownership changes,
 * licence renewals, Canadian content rulings, and diversity of voices.
 */
export const CRTC_BROADCASTING_DECISIONS_URL = `${CRTC_BASE_URL}/eng/archive/decision-broadcasting.htm`;

/**
 * CRTC telecom decisions archive page.
 * Lists telecom decisions covering internet pricing, wholesale access,
 * net neutrality, and consumer protection.
 */
export const CRTC_TELECOM_DECISIONS_URL = `${CRTC_BASE_URL}/eng/archive/decision-telecom.htm`;

/**
 * CRTC ownership data page.
 * Tracks ownership of broadcasting undertakings and media ownership groups.
 */
export const CRTC_OWNERSHIP_URL = `${CRTC_BASE_URL}/eng/cancon/ownership.htm`;

/**
 * CRTC French ownership data page.
 */
export const CRTC_OWNERSHIP_FR_URL = `${CRTC_BASE_URL}/fra/cancon/propriete.htm`;

/* ------------------------------------------------------------------ */
/*  RSS Feeds                                                          */
/* ------------------------------------------------------------------ */

/** CRTC RSS feed for broadcasting decisions */
export const CRTC_BROADCASTING_RSS_URL = `${CRTC_BASE_URL}/rss/eng/decision-broadcasting.xml`;

/** CRTC RSS feed for telecom decisions */
export const CRTC_TELECOM_RSS_URL = `${CRTC_BASE_URL}/rss/eng/decision-telecom.xml`;

/** CRTC RSS feed for notices of consultation */
export const CRTC_CONSULTATION_RSS_URL = `${CRTC_BASE_URL}/rss/eng/notice-consultation.xml`;

/** All CRTC RSS feeds keyed by decision type */
export const CRTC_RSS_FEEDS = {
  'broadcasting-decision': CRTC_BROADCASTING_RSS_URL,
  'telecom-decision': CRTC_TELECOM_RSS_URL,
  'notice-consultation': CRTC_CONSULTATION_RSS_URL,
} as const;

/* ------------------------------------------------------------------ */
/*  CKAN / Open Canada Sources                                         */
/* ------------------------------------------------------------------ */

/**
 * open.canada.ca CKAN API base URL for CRTC datasets.
 * CRTC publishes some structured datasets via CKAN, including
 * ownership data, financial data, and annual reports.
 */
export const CRTC_CKAN_BASE = 'https://open.canada.ca/data';

/** CKAN API search endpoint */
export const CRTC_CKAN_SEARCH = `${CRTC_CKAN_BASE}/api/3/action/package_search`;

/** CKAN package show endpoint */
export const CRTC_CKAN_PACKAGE_SHOW = `${CRTC_CKAN_BASE}/api/3/action/package_show`;

/**
 * Known CRTC CKAN package IDs.
 * These are CRTC datasets published on open.canada.ca.
 */
export const CRTC_CKAN_PACKAGE_IDS = {
  /** Broadcasting ownership data */
  BROADCASTING_OWNERSHIP: 'aee4fb68-9bcb-431f-9a10-00382a341799',
  /** Telecom financial data */
  TELECOM_FINANCIAL: 'f92a9711-fe13-421c-bbfb-38c93d7807e5',
  /** Telecommunications service area maps */
  TELECOM_SERVICE_AREAS: 'cb02d3b1-dacb-4401-beec-9f9fe178fc1c',
} as const;

/**
 * Build a CKAN package_show URL for a given package ID.
 */
export function ckanPackageUrl(packageId: string): string {
  return `${CRTC_CKAN_PACKAGE_SHOW}?id=${encodeURIComponent(packageId)}`;
}

/**
 * Build a CKAN package_search URL for CRTC datasets.
 */
export function ckanSearchUrl(
  query: string = 'crtc',
  rows: number = 20,
): string {
  return `${CRTC_CKAN_SEARCH}?q=${encodeURIComponent(query)}&rows=${rows}`;
}

/* ------------------------------------------------------------------ */
/*  Decision URL Patterns                                              */
/* ------------------------------------------------------------------ */

/**
 * Build a CRTC decision page URL from a year and decision number.
 * Pattern: https://crtc.gc.ca/eng/archive/2024/2024-123.htm
 */
export function crtcDecisionUrl(year: string, number: string): string {
  return `${CRTC_BASE_URL}/eng/archive/${year}/${number}.htm`;
}

/**
 * Build a CRTC decision PDF URL.
 * Pattern: https://crtc.gc.ca/eng/archive/2024/2024-123.pdf
 * (not all decisions have PDFs)
 */
export function crtcDecisionPdfUrl(year: string, number: string): string {
  return `${CRTC_BASE_URL}/eng/archive/${year}/${number}.pdf`;
}

/**
 * Extract year from a CRTC decision number.
 * Decision numbers follow pattern YYYY-NNN.
 */
export function extractYearFromDecisionNumber(decisionNumber: string): string | null {
  const match = decisionNumber.match(/^(\d{4})-/);
  return match ? match[1] : null;
}

/* ------------------------------------------------------------------ */
/*  Decision Type Patterns                                             */
/* ------------------------------------------------------------------ */

/**
 * CRTC decision type keywords and their canonical classification.
 * These appear in decision titles and metadata.
 */
export const CRTC_DECISION_TYPE_PATTERNS: Record<string, string> = {
  'Broadcasting Decision': 'broadcasting-decision',
  'Décision de radiodiffusion': 'broadcasting-decision',
  'Telecom Decision': 'telecom-decision',
  'Décision de télécom': 'telecom-decision',
  'Broadcasting Order': 'administrative',
  'Ordonnance de radiodiffusion': 'administrative',
  'Telecom Order': 'administrative',
  'Ordonnance de télécom': 'administrative',
  'Broadcasting Notice of Consultation': 'notice-consultation',
  'Avis de consultation de radiodiffusion': 'notice-consultation',
  'Telecom Notice of Consultation': 'notice-consultation',
  'Avis de consultation de télécom': 'notice-consultation',
  'Notice of Consultation': 'notice-consultation',
  'Avis de consultation': 'notice-consultation',
  'Policy': 'policy',
  'Politique': 'policy',
  'Broadcasting Regulatory Policy': 'policy',
  'Politique réglementaire de radiodiffusion': 'policy',
  'Telecom Regulatory Policy': 'policy',
  'Politique réglementaire de télécom': 'policy',
  'Ownership': 'ownership-change',
};

/**
 * Reverse map from canonical type to URL path segment.
 */
export const CRTC_TYPE_TO_SEGMENT: Record<string, string> = {
  'broadcasting-decision': 'decision-broadcasting',
  'telecom-decision': 'decision-telecom',
  'notice-consultation': 'notice-consultation',
  'policy': 'regulatory-policy',
  'ownership-change': 'ownership',
  'administrative': 'orders',
};

/* ------------------------------------------------------------------ */
/*  Subject Categories                                                 */
/* ------------------------------------------------------------------ */

/**
 * Subject matter keyword mapping.
 * Maps keywords found in decision titles/descriptions to canonical
 * CrtcSubjectMatter categories.
 */
export const CRTC_SUBJECT_KEYWORDS: Record<string, string[]> = {
  'licensing': [
    'licence', 'licensing', 'license', 'renew', 'application for',
    'licence', 'permis', 'renouvellement',
  ],
  'ownership-change': [
    'ownership', 'transfer of control', 'transfer of ownership',
    'acquisition', 'merger', 'takeover', 'propriété',
    'transfert de contrôle', 'acquisition',
  ],
  'net-neutrality': [
    'net neutrality', 'internet traffic', 'throttling', 'zero-rating',
    'network management', 'neutralité du net', 'traffic management',
  ],
  'telecom-pricing': [
    'rate', 'pricing', 'price cap', 'wholesale rate', 'tariff',
    'wireless price', 'internet price', 'prix', 'tarif',
  ],
  'wholesale-access': [
    'wholesale', 'access rate', 'facilities-based', 'competition',
    'services de gros', 'accès',
  ],
  'canadian-content': [
    'canadian content', 'cancon', 'canadian programming',
    'contribution', 'contenu canadien', 'émissions canadiennes',
  ],
  'diversity-of-voices': [
    'diversity of voices', 'diversity of editorial voices',
    'media ownership', 'diversité des voix', 'pluralism',
  ],
  'local-news': [
    'local news', 'local programming', 'local television',
    'community television', 'nouvelles locales',
    'programmation locale',
  ],
  'indigenous-broadcasting': [
    'indigenous', 'aboriginal', 'first nations', 'inuit', 'métis',
    'autochtone', 'peuples autochtones',
  ],
  'french-language': [
    'french-language', 'francophone', 'french programming',
    'langue française', 'programmation française',
  ],
  'accessibility': [
    'accessibility', 'closed captioning', 'described video',
    'accessible', 'sous-titrage', 'vidéodescription',
  ],
  'emergency-alerting': [
    'emergency alert', 'alert ready', 'public alerting',
    'alertes d\'urgence', 'en alerte',
  ],
  'consumer-protection': [
    'consumer protection', 'customer service', 'consumer rights',
    'bill shock', 'cramming', 'protection des consommateurs',
  ],
};

/* ------------------------------------------------------------------ */
/*  Fetch Configuration                                                */
/* ------------------------------------------------------------------ */

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** User-Agent for CRTC HTTP requests */
export const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)',
  Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
} as const;

/** Maximum pages to scrape for historical archive pages */
export const MAX_ARCHIVE_PAGES = 10;

/** Maximum RSS items to fetch per feed */
export const MAX_RSS_ITEMS = 100;

/** Years to look back for historical data during initial ingestion */
export const HISTORICAL_YEARS_BACK = 5;

/* ------------------------------------------------------------------ */
/*  DDL — CRTC Tables for D1 Schema                                    */
/* ------------------------------------------------------------------ */

/**
 * DDL for the crtc_decisions table.
 * This table stores CRTC regulatory decisions across broadcasting,
 * telecom, and administrative categories.
 */
export const CRTC_DECISIONS_DDL = `-- CRTC regulatory decisions
CREATE TABLE IF NOT EXISTS crtc_decisions (
  id TEXT PRIMARY KEY,
  decision_number TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('broadcasting-decision','telecom-decision','administrative','ownership-change','policy','notice-consultation')),
  applicant TEXT,
  outcome TEXT NOT NULL DEFAULT 'unknown' CHECK(outcome IN ('approved','denied','conditionally-approved','partially-approved','deferred','withdrawn','unknown')),
  subject_matter TEXT,
  related_companies TEXT,
  conditions TEXT,
  findings TEXT,
  is_ownership_change INTEGER DEFAULT 0,
  is_net_neutrality INTEGER DEFAULT 0,
  is_telecom_pricing INTEGER DEFAULT 0,
  is_canadian_content INTEGER DEFAULT 0,
  is_licence_renewal INTEGER DEFAULT 0,
  summary TEXT,
  source_url TEXT NOT NULL,
  pdf_url TEXT,
  language TEXT DEFAULT 'en',
  ingested_at TEXT NOT NULL,
  UNIQUE(source_url)
);

CREATE INDEX IF NOT EXISTS idx_crtc_dec_date ON crtc_decisions(date DESC);
CREATE INDEX IF NOT EXISTS idx_crtc_dec_type ON crtc_decisions(type);
CREATE INDEX IF NOT EXISTS idx_crtc_dec_number ON crtc_decisions(decision_number);
CREATE INDEX IF NOT EXISTS idx_crtc_dec_applicant ON crtc_decisions(applicant);
CREATE INDEX IF NOT EXISTS idx_crtc_dec_outcome ON crtc_decisions(outcome);
CREATE INDEX IF NOT EXISTS idx_crtc_dec_ownership ON crtc_decisions(is_ownership_change);
CREATE INDEX IF NOT EXISTS idx_crtc_dec_netneutrality ON crtc_decisions(is_net_neutrality);
CREATE INDEX IF NOT EXISTS idx_crtc_dec_pricing ON crtc_decisions(is_telecom_pricing);
CREATE INDEX IF NOT EXISTS idx_crtc_dec_content ON crtc_decisions(is_canadian_content);
CREATE INDEX IF NOT EXISTS idx_crtc_dec_renewal ON crtc_decisions(is_licence_renewal);
CREATE INDEX IF NOT EXISTS idx_crtc_dec_type_date ON crtc_decisions(type, date DESC);`;

/**
 * DDL for the crtc_ownership table.
 * This table tracks ownership of broadcasting and telecom undertakings,
 * including ownership percentages, parent companies, and transfers of control.
 */
export const CRTC_OWNERSHIP_DDL = `-- CRTC media ownership records
CREATE TABLE IF NOT EXISTS crtc_ownership (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL CHECK(record_type IN ('broadcasting-undertaking','telecom-undertaking','media-ownership-group','transfer-of-control','transfer-of-ownership')),
  undertaking_name TEXT NOT NULL,
  undertaking_type TEXT NOT NULL,
  service_area TEXT,
  licence_number TEXT,
  owner_name TEXT NOT NULL,
  parent_company TEXT,
  ownership_percentage REAL,
  effective_date TEXT,
  published_date TEXT,
  transaction_value REAL,
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(undertaking_name, owner_name, source_url)
);

CREATE INDEX IF NOT EXISTS idx_crtc_own_undertaking ON crtc_ownership(undertaking_name);
CREATE INDEX IF NOT EXISTS idx_crtc_own_owner ON crtc_ownership(owner_name);
CREATE INDEX IF NOT EXISTS idx_crtc_own_parent ON crtc_ownership(parent_company);
CREATE INDEX IF NOT EXISTS idx_crtc_own_type ON crtc_ownership(record_type);
CREATE INDEX IF NOT EXISTS idx_crtc_own_area ON crtc_ownership(service_area);
CREATE INDEX IF NOT EXISTS idx_crtc_own_effective_date ON crtc_ownership(effective_date);
CREATE INDEX IF NOT EXISTS idx_crtc_own_published_date ON crtc_ownership(published_date);
CREATE INDEX IF NOT EXISTS idx_crtc_own_undertaker_owner ON crtc_ownership(undertaking_name, owner_name);
CREATE INDEX IF NOT EXISTS idx_crtc_own_parent_owner ON crtc_ownership(parent_company, owner_name);`;
