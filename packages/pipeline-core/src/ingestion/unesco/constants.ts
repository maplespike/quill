// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * UNESCO Institute for Statistics (UIS) API Constants
 *
 * Provides access to UNESCO data on education, culture, and science
 * via SDMX REST API.
 *
 * API Reference:
 *   Base: https://api.uis.unesco.org/sdmx/data
 *   Format: SDMX-JSON (v2.0)
 *   Auth: API key required (UNESCO_API_KEY environment variable)
 *   Rate limits: Respect with delays between requests
 *
 * See: https://apiportal.uis.unesco.org/
 */

/** Base URL for UNESCO UIS SDMX API */
export const UNESCO_BASE_URL = "https://api.uis.unesco.org/sdmx";

/** Timeout for UNESCO API requests (30 seconds) */
export const UNESCO_TIMEOUT_MS = 30_000;

/** Max records to request per API call */
export const UNESCO_MAX_RECORDS = 10000;

/** User agent for API requests */
export const UNESCO_USER_AGENT = "MapleSpike-UNESCO/1.0";

/** Get API key from environment */
export function getUnescoApiKey(): string {
  const key = process.env["UNESCO_API_KEY"];
  if (!key) {
    throw new Error(
      "UNESCO_API_KEY environment variable is required. " +
      "Get an API key from https://apiportal.uis.unesco.org/"
    );
  }
  return key;
}

/**
 * Priority Education Indicators (highest priority)
 *
 * These are the most commonly used UNESCO education statistics
 * aligned with SDG 4 indicators.
 */
export const EDUCATION_INDICATORS = {
  EDU_LITR_AD_ZS: "Adult literacy rate (% of population aged 15+)",
  EDU_LITR_YTH_ZS: "Youth literacy rate (% of population aged 15-24)",
  EDU_NERT_PRY: "Net enrollment rate, primary education (%)",
  EDU_NERT_SEC: "Net enrollment rate, secondary education (%)",
  EDU_NERT_TER: "Net enrollment rate, tertiary education (%)",
  EDU_ENRL_PRY: "Gross enrollment ratio, primary education (%)",
  EDU_ENRL_SEC: "Gross enrollment ratio, secondary education (%)",
  EDU_ENRL_TER: "Gross enrollment ratio, tertiary education (%)",
  EDU_SPEND_EXP: "Government expenditure on education (% of GDP)",
  EDU_TEACH_PRY: "Pupil-teacher ratio, primary education",
  EDU_TEACH_SEC: "Pupil-teacher ratio, secondary education",
  EDU_GRAD_PRY: "Primary completion rate (%)",
  EDU_GRAD_SEC: "Lower secondary completion rate (%)",
  EDU_OOSC_PRY: "Out-of-school children, primary education (number)",
  EDU_OOSC_SEC: "Out-of-school adolescents, secondary education (number)",
} as const;

/**
 * Culture Indicators
 */
export const CULTURE_INDICATORS = {
  CUL_HER_SITES: "World Heritage sites (total designated)",
  CUL_MOB_VST: "International student mobility (inbound)",
  CUL_MOB_OUT: "International student mobility (outbound)",
  CUL_PRESS_FREEDOM: "Press Freedom Index score",
  CUL_LIB_BOOKS: "Libraries — book holdings per capita",
  CUL_MUSEUM_VST: "Museum visits per 100,000 population",
  CUL_FILM_PRODUCED: "Feature films produced (annual)",
  CUL_PUB_PERIODICALS: "Periodicals and newspapers published",
} as const;

/**
 * Science & Technology Indicators
 */
export const SCIENCE_INDICATORS = {
  SC_RESEXP: "Gross domestic expenditure on R&D (GERD, current USD)",
  SC_RESEXP_GDP: "R&D expenditure as % of GDP",
  SC_RESEARP: "Researchers per million inhabitants (FTE)",
  SC_TECH_JOURNAL: "Scientific and technical journal articles",
  SC_PATENT_RES: "Patent applications by residents",
  SC_PATENT_NONRES: "Patent applications by non-residents",
  SC_HIGH_TECH_EXP: "High-technology exports (current USD)",
  SC_HIGH_TECH_PCT: "High-technology exports (% of manufactured exports)",
  SC_RD_TECHNICIAN: "Technicians in R&D per million inhabitants",
  SC_GERD_BUSINESS: "Business enterprise R&D expenditure (% of GERD)",
} as const;

/** All UNESCO indicators combined */
export const ALL_UNESCO_INDICATORS = {
  ...EDUCATION_INDICATORS,
  ...CULTURE_INDICATORS,
  ...SCIENCE_INDICATORS,
} as const;

export type UnescoIndicatorCode = keyof typeof ALL_UNESCO_INDICATORS;

/**
 * Indicator categories for grouped queries
 */
export const INDICATOR_CATEGORIES = {
  education: {
    name: "Education",
    description: "Literacy, enrollment, completion, spending, and teacher ratios",
    indicators: Object.keys(EDUCATION_INDICATORS),
  },
  culture: {
    name: "Culture",
    description: "Heritage sites, student mobility, press freedom, museums, films",
    indicators: Object.keys(CULTURE_INDICATORS),
  },
  science: {
    name: "Science & Technology",
    description: "R&D expenditure, researchers, patents, high-tech exports, journals",
    indicators: Object.keys(SCIENCE_INDICATORS),
  },
} as const;

export type IndicatorCategoryCode = keyof typeof INDICATOR_CATEGORIES;

/**
 * Get the dataflow ID for an indicator code.
 * UNESCO SDMX dataflow IDs follow the pattern: DF_{INDICATOR_CODE}
 */
export function getDataflowId(indicatorCode: string): string {
  return `DF_${indicatorCode}`;
}

/**
 * Default countries to query (ISO 3-letter codes).
 * Includes G7+Australia/NZ plus major emerging economies.
 */
export const DEFAULT_COUNTRIES = [
  "CAN", "USA", "GBR", "DEU", "FRA", "ITA", "JPN",
  "AUS", "NZL", "MEX", "BRA", "IND", "CHN", "ZAF",
  "NOR", "SWE", "CHE", "AUT", "BEL", "DNK", "FIN",
  "IRL", "NLD", "ESP", "PRT", "KOR", "SGP", "ISR",
  "TUR", "ARG", "CHL", "COL", "PER", "EGY", "NGA",
  "KEN", "GHA", "RUS", "SAU", "ARE", "IDN", "THA",
  "VNM", "PHL", "PAK", "BGD", "UKR", "POL", "CZE",
] as const;
