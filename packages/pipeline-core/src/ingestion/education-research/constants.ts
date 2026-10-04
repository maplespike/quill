/**
 * Education & Research Constants — Quill
 *
 * CKAN search queries, source URLs, and DDL for education & research data
 * published on open.canada.ca and other Canadian open data portals.
 *
 * Sources:
 *   - Tri-Council grants: CIHR, NSERC, SSHRC awards on open.canada.ca
 *   - Canada Research Chairs: CRC holders dataset
 *   - Canada Foundation for Innovation: CFI awards
 *   - Canada Student Loans: CSL default rates and debt
 *   - University tuition: StatCan tuition and living accommodation costs
 *   - Apprenticeship: RAP (Registered Apprenticeship Program) data
 */

/* ------------------------------------------------------------------ */
/*  CKAN Portal URLs                                                   */
/* ------------------------------------------------------------------ */

export const EDU_SOURCES = {
  /** open.canada.ca CKAN portal */
  CKAN: {
    BASE: 'https://open.canada.ca/data',
    /** CKAN package_search API endpoint */
    PACKAGE_SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
    /** CKAN package_show API endpoint */
    PACKAGE_SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
    /** CKAN resource download base */
    DOWNLOAD_BASE: 'https://open.canada.ca/data/dataset',
  },

  /** Digital Research Alliance of Canada (HTML scraping target) */
  ALLIANCE_CAN: {
    BASE: 'https://alliancecan.ca/en',
    SERVICES: 'https://alliancecan.ca/en/services',
    RESEARCH_PORTAL: 'https://alliancecan.ca/en/research-portal',
  },

  /** Mitacs (HTML scraping target) */
  MITACS: {
    BASE: 'https://www.mitacs.ca/en',
    PROGRAMS: 'https://www.mitacs.ca/en/programs',
    FUNDING: 'https://www.mitacs.ca/en/funding-opportunities',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  CKAN Search Queries                                                */
/* ------------------------------------------------------------------ */

/**
 * CKAN search queries for discovering education & research datasets.
 * Used with open.canada.ca/data/api/3/action/package_search?q=...
 */
export const EDU_CKAN_QUERIES = {
  /** CIHR (Canadian Institutes of Health Research) grants */
  CIHR_GRANTS: 'cihr grants awards funded',
  /** NSERC (Natural Sciences and Engineering Research Council) grants */
  NSERC_GRANTS: 'nserc grants awards',
  /** SSHRC (Social Sciences and Humanities Research Council) grants */
  SSHRC_GRANTS: 'sshrc grants awards',
  /** Tri-Council aggregate search */
  TRI_COUNCIL: 'cihr nserc sshrc grants awards',
  /** Canada Research Chairs */
  RESEARCH_CHAIRS: 'canada research chairs holders',
  /** Canada Foundation for Innovation */
  CFI: 'canada foundation innovation infrastructure',
  /** Canada Student Loans default rates */
  STUDENT_LOANS_DEFAULT: 'canada student loans default rates',
  /** Canada Student Loans debt */
  STUDENT_LOANS_DEBT: 'canada student loans debt borrowers',
  /** University tuition fees */
  UNIVERSITY_TUITION: 'university tuition fees canada',
  /** Apprenticeship registration and completion */
  APPRENTICESHIP: 'apprenticeship registration completion',
} as const;

/* ------------------------------------------------------------------ */
/*  Known CKAN Package IDs (verified on open.canada.ca)                */
/* ------------------------------------------------------------------ */

/**
 * Known CKAN package IDs for education & research datasets.
 * These were discovered via package_search queries on open.canada.ca.
 * They serve as direct references when package_search is unreliable.
 */
export const EDU_CKAN_PACKAGE_IDS = {
  /** CIHR funded grants */
  CIHR_GRANTS: '49edb1d7-5cb4-4fa7-897c-515d1aad5da3',
  /** NSERC research grants */
  NSERC_GRANTS: 'c1b0f627-8c29-427c-ab73-33968ad9176e',
  /** SSHRC awarded grants */
  SSHRC_GRANTS: 'b4e2b302-9bc6-4b33-b880-6496f8cef0f1',
  /** Canada Research Chairs holders list */
  CRC_HOLDERS: '9606b8cd-0c80-4b3b-a771-e8872b9d6616',
  /** CFI awarded infrastructure grants */
  CFI_GRANTS: '4112e654-b080-4ce0-a4e4-d739e8f274f7',
  /** Canada Student Loans default rates by institution */
  CSL_DEFAULT_RATES: '0840231b-5bbf-447f-81ce-3ec0673aefc4',
  /** Canada Student Loans debt statistics */
  CSL_DEBT: '8a6a3f7e-dbca-467c-ad55-8ab6ddc7754b',
} as const;

/* ------------------------------------------------------------------ */
/*  URL Builders                                                       */
/* ------------------------------------------------------------------ */

/**
 * Build a CKAN package_search URL for education & research datasets.
 */
export function eduCkanSearchUrl(query: string, rows: number = 20): string {
  return `${EDU_SOURCES.CKAN.PACKAGE_SEARCH}?q=${encodeURIComponent(query)}&rows=${rows}`;
}

/**
 * Build a CKAN package_show URL for a known package ID.
 */
export function eduCkanPackageUrl(packageId: string): string {
  return `${EDU_SOURCES.CKAN.PACKAGE_SHOW}?id=${packageId}`;
}

/**
 * Build a CKAN resource download URL.
 */
export function eduCkanDownloadUrl(packageId: string, resourceId: string, filename: string = 'data.csv'): string {
  return `${EDU_SOURCES.CKAN.DOWNLOAD_BASE}/${packageId}/resource/${resourceId}/download/${filename}`;
}

/* ------------------------------------------------------------------ */
/*  DDL — edu_tri_council_grants                                       */
/* ------------------------------------------------------------------ */

export const EDU_TRI_COUNCIL_DDL = `
CREATE TABLE IF NOT EXISTS edu_tri_council_grants (
  id TEXT PRIMARY KEY,
  agency TEXT NOT NULL CHECK(agency IN ('CIHR', 'NSERC', 'SSHRC')),
  program_name TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_institution TEXT NOT NULL,
  grant_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CAD',
  project_title TEXT NOT NULL,
  project_summary TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_etg_agency ON edu_tri_council_grants(agency);
CREATE INDEX IF NOT EXISTS idx_etg_fiscal_year ON edu_tri_council_grants(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_etg_institution ON edu_tri_council_grants(recipient_institution);
CREATE INDEX IF NOT EXISTS idx_etg_amount ON edu_tri_council_grants(grant_amount DESC);
CREATE INDEX IF NOT EXISTS idx_etg_agency_fiscal ON edu_tri_council_grants(agency, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_etg_recipient ON edu_tri_council_grants(recipient_name);
`;

/* ------------------------------------------------------------------ */
/*  DDL — edu_research_chairs                                          */
/* ------------------------------------------------------------------ */

export const EDU_RESEARCH_CHAIRS_DDL = `
CREATE TABLE IF NOT EXISTS edu_research_chairs (
  id TEXT PRIMARY KEY,
  chairholder_name TEXT NOT NULL,
  institution TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('Tier 1', 'Tier 2')),
  discipline TEXT NOT NULL,
  program TEXT,
  start_date TEXT,
  award_date TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_erc_institution ON edu_research_chairs(institution);
CREATE INDEX IF NOT EXISTS idx_erc_tier ON edu_research_chairs(tier);
CREATE INDEX IF NOT EXISTS idx_erc_discipline ON edu_research_chairs(discipline);
CREATE INDEX IF NOT EXISTS idx_erc_chairholder ON edu_research_chairs(chairholder_name);
CREATE INDEX IF NOT EXISTS idx_erc_institution_tier ON edu_research_chairs(institution, tier);
`;

/* ------------------------------------------------------------------ */
/*  DDL — edu_cfi_infrastructure                                       */
/* ------------------------------------------------------------------ */

export const EDU_CFI_DDL = `
CREATE TABLE IF NOT EXISTS edu_cfi_infrastructure (
  id TEXT PRIMARY KEY,
  institution TEXT NOT NULL,
  project_title TEXT NOT NULL,
  program_name TEXT NOT NULL,
  funding_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CAD',
  infrastructure_sector TEXT,
  province TEXT,
  award_date TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ecfi_institution ON edu_cfi_infrastructure(institution);
CREATE INDEX IF NOT EXISTS idx_ecfi_program ON edu_cfi_infrastructure(program_name);
CREATE INDEX IF NOT EXISTS idx_ecfi_sector ON edu_cfi_infrastructure(infrastructure_sector);
CREATE INDEX IF NOT EXISTS idx_ecfi_province ON edu_cfi_infrastructure(province);
CREATE INDEX IF NOT EXISTS idx_ecfi_amount ON edu_cfi_infrastructure(funding_amount DESC);
CREATE INDEX IF NOT EXISTS idx_ecfi_award_date ON edu_cfi_infrastructure(award_date);
`;

/* ------------------------------------------------------------------ */
/*  DDL — edu_student_loans                                            */
/* ------------------------------------------------------------------ */

export const EDU_STUDENT_LOANS_DDL = `
CREATE TABLE IF NOT EXISTS edu_student_loans (
  id TEXT PRIMARY KEY,
  institution TEXT NOT NULL,
  province TEXT NOT NULL,
  program_year TEXT NOT NULL,
  default_rate REAL,
  borrowers_count INTEGER,
  total_debt REAL,
  average_debt REAL,
  repayment_rate REAL,
  data_type TEXT NOT NULL CHECK(data_type IN ('default-rate', 'debt', 'repayment', 'other')),
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_esl_institution ON edu_student_loans(institution);
CREATE INDEX IF NOT EXISTS idx_esl_province ON edu_student_loans(province);
CREATE INDEX IF NOT EXISTS idx_esl_program_year ON edu_student_loans(program_year);
CREATE INDEX IF NOT EXISTS idx_esl_data_type ON edu_student_loans(data_type);
CREATE INDEX IF NOT EXISTS idx_esl_province_year ON edu_student_loans(province, program_year);
CREATE INDEX IF NOT EXISTS idx_esl_default_rate ON edu_student_loans(default_rate DESC);
`;

/* ------------------------------------------------------------------ */
/*  DDL — edu_university_tuition                                       */
/* ------------------------------------------------------------------ */

export const EDU_UNIVERSITY_TUITION_DDL = `
CREATE TABLE IF NOT EXISTS edu_university_tuition (
  id TEXT PRIMARY KEY,
  institution TEXT NOT NULL,
  province TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  study_level TEXT NOT NULL,
  program TEXT NOT NULL,
  tuition_fee REAL NOT NULL DEFAULT 0,
  additional_fees REAL,
  total_fee REAL,
  student_category TEXT NOT NULL CHECK(student_category IN ('canadian', 'international', 'both')),
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eut_institution ON edu_university_tuition(institution);
CREATE INDEX IF NOT EXISTS idx_eut_province ON edu_university_tuition(province);
CREATE INDEX IF NOT EXISTS idx_eut_year ON edu_university_tuition(academic_year);
CREATE INDEX IF NOT EXISTS idx_eut_level ON edu_university_tuition(study_level);
CREATE INDEX IF NOT EXISTS idx_eut_category ON edu_university_tuition(student_category);
`;

/* ------------------------------------------------------------------ */
/*  DDL — edu_apprenticeship                                           */
/* ------------------------------------------------------------------ */

export const EDU_APPRENTICESHIP_DDL = `
CREATE TABLE IF NOT EXISTS edu_apprenticeship (
  id TEXT PRIMARY KEY,
  fiscal_year TEXT NOT NULL,
  province TEXT,
  trade_group TEXT NOT NULL,
  trade_name TEXT NOT NULL,
  registrations INTEGER,
  completions INTEGER,
  active_apprentices INTEGER,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ea_fiscal_year ON edu_apprenticeship(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_ea_province ON edu_apprenticeship(province);
CREATE INDEX IF NOT EXISTS idx_ea_trade_group ON edu_apprenticeship(trade_group);
CREATE INDEX IF NOT EXISTS idx_ea_trade_name ON edu_apprenticeship(trade_name);
CREATE INDEX IF NOT EXISTS idx_ea_fiscal_trade ON edu_apprenticeship(fiscal_year, trade_group);
`;

/* ------------------------------------------------------------------ */
/*  Combined DDL for table creation                                    */
/* ------------------------------------------------------------------ */

export const EDU_DDL = `
${EDU_TRI_COUNCIL_DDL}

${EDU_RESEARCH_CHAIRS_DDL}

${EDU_CFI_DDL}

${EDU_STUDENT_LOANS_DDL}

${EDU_UNIVERSITY_TUITION_DDL}

${EDU_APPRENTICESHIP_DDL}
`;
