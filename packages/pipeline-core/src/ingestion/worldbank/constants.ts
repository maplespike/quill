/**
 * World Bank Constants — MapleSpike Pipeline
 *
 * API URLs, indicator code mappings, and helper functions
 * for the World Bank Indicators API V2.
 *
 * API Docs: https://datahelpdesk.worldbank.org/knowledgebase/topics/125589
 * Data License: World Bank Open License — free for all uses.
 */

import type { WorldBankIndicatorCategory } from './types.js';

/* ------------------------------------------------------------------ */
/*  API Configuration                                                  */
/* ------------------------------------------------------------------ */

export const WB_API_BASE = 'https://api.worldbank.org/v2';

export const WB_DEFAULT_TIMEOUT_MS = 60_000;

/** Default format parameter for JSON responses. */
export const WB_FORMAT = 'format=json';

/* ------------------------------------------------------------------ */
/*  Top 50 World Bank Indicators by Category                           */
/* ------------------------------------------------------------------ */

/**
 * Curated list of the most-used World Bank indicators.
 * These cover all major development categories and are
 * most commonly referenced in research and policy analysis.
 */
export const WB_INDICATORS = {
  // ── Economy & Growth ──
  /** GDP (current US$) */
  GDP_CURRENT_USD: 'NY.GDP.MKTP.CD',
  /** GDP growth (annual %) */
  GDP_GROWTH_ANNUAL: 'NY.GDP.MKTP.KD.ZG',
  /** GDP per capita (current US$) */
  GDP_PER_CAPITA_USD: 'NY.GDP.PCAP.CD',
  /** GDP per capita growth (annual %) */
  GDP_PER_CAPITA_GROWTH: 'NY.GDP.PCAP.KD.ZG',
  /** GNI (current US$) */
  GNI_CURRENT_USD: 'NY.GNP.MKTP.CD',
  /** GNI per capita (current US$) */
  GNI_PER_CAPITA_USD: 'NY.GNP.PCAP.CD',
  /** Inflation, consumer prices (annual %) */
  INFLATION_CPI: 'FP.CPI.TOTL.ZG',
  /** Unemployment, total (% of total labor force) */
  UNEMPLOYMENT_TOTAL: 'SL.UEM.TOTL.ZS',
  /** Labor force, total */
  LABOR_FORCE_TOTAL: 'SL.TLF.TOTL.IN',
  /** GDP deflator (annual %) */
  GDP_DEFLATOR: 'NY.GDP.DEFL.KD.ZG',

  // ── Trade ──
  /** Exports of goods and services (current US$) */
  EXPORTS_GOODS_SERVICES: 'NE.EXP.GNFS.CD',
  /** Imports of goods and services (current US$) */
  IMPORTS_GOODS_SERVICES: 'NE.IMP.GNFS.CD',
  /** Trade (% of GDP) */
  TRADE_PERCENT_GDP: 'NE.TRD.GNFS.ZS',
  /** High-technology exports (% of manufactured exports) */
  HIGH_TECH_EXPORTS: 'TX.VAL.TECH.MF.ZS',
  /** Current account balance (% of GDP) */
  CURRENT_ACCOUNT_BALANCE: 'BN.CAB.XOKA.GD.ZS',
  /** Foreign direct investment, net inflows (% of GDP) */
  FDI_NET_INFLOWS: 'BX.KLT.DINV.WD.GD.ZS',

  // ── Population & Demographics ──
  /** Population, total */
  POPULATION_TOTAL: 'SP.POP.TOTL',
  /** Population growth (annual %) */
  POPULATION_GROWTH: 'SP.POP.GROW',
  /** Population, female (% of total) */
  POPULATION_FEMALE_PERCENT: 'SP.POP.TOTL.FE.ZS',
  /** Population ages 65 and above (% of total) */
  POPULATION_AGED_65_PLUS: 'SP.POP.65UP.TO.ZS',
  /** Urban population (% of total) */
  URBAN_POPULATION_PERCENT: 'SP.URB.TOTL.IN.ZS',
  /** Population density (people per sq. km of land area) */
  POPULATION_DENSITY: 'EN.POP.DNST',

  // ── Health ──
  /** Life expectancy at birth, total (years) */
  LIFE_EXPECTANCY_TOTAL: 'SP.DYN.LE00.IN',
  /** Maternal mortality ratio (modeled estimate, per 100,000 live births) */
  MATERNAL_MORTALITY: 'SH.STA.MMRT',
  /** Mortality rate, infant (per 1,000 live births) */
  INFANT_MORTALITY: 'SP.DYN.IMRT.IN',
  /** Current health expenditure (% of GDP) */
  HEALTH_EXPENDITURE_PERCENT_GDP: 'SH.XPD.CHEX.GD.ZS',
  /** Physicians (per 1,000 people) */
  PHYSICIANS_PER_THOUSAND: 'SH.MED.PHYS.ZS',
  /** Immunization, DPT (% of children ages 12-23 months) */
  IMMUNIZATION_DPT: 'SH.IMM.IDPT',
  /** Prevalence of undernourishment (% of population) */
  UNDERNOURISHMENT: 'SN.ITK.DEFC.ZS',

  // ── Education ──
  /** Government expenditure on education, total (% of GDP) */
  EDUCATION_EXPENDITURE_PERCENT_GDP: 'SE.XPD.TOTL.GD.ZS',
  /** School enrollment, primary (% gross) */
  SCHOOL_ENROLLMENT_PRIMARY: 'SE.PRM.ENRR',
  /** School enrollment, secondary (% gross) */
  SCHOOL_ENROLLMENT_SECONDARY: 'SE.SEC.ENRR',
  /** School enrollment, tertiary (% gross) */
  SCHOOL_ENROLLMENT_TERTIARY: 'SE.TER.ENRR',
  /** Literacy rate, adult total (% of people ages 15 and above) */
  LITERACY_RATE_ADULT: 'SE.ADT.LITR.ZS',
  /** Pupil-teacher ratio, primary */
  PUPIL_TEACHER_RATIO_PRIMARY: 'SE.PRM.ENRL.TC.ZS',

  // ── Environment & Energy ──
  /** CO2 emissions (metric tons per capita) */
  CO2_EMISSIONS_PER_CAPITA: 'EN.ATM.CO2E.PC',
  /** Renewable energy consumption (% of total final energy consumption) */
  RENEWABLE_ENERGY_PERCENT: 'EG.FEC.RNEW.ZS',
  /** Access to electricity (% of population) */
  ACCESS_ELECTRICITY_PERCENT: 'EG.ELC.ACCS.ZS',
  /** Energy use (kg of oil equivalent per capita) */
  ENERGY_USE_PER_CAPITA: 'EG.USE.PCAP.KG.OE',
  /** Forest area (% of land area) */
  FOREST_AREA_PERCENT: 'AG.LND.FRST.ZS',

  // ── Infrastructure ──
  /** Individuals using the Internet (% of population) */
  INTERNET_USERS_PERCENT: 'IT.NET.USER.ZS',
  /** Mobile cellular subscriptions (per 100 people) */
  MOBILE_SUBSCRIPTIONS: 'IT.CEL.SETS.P2',
  /** Fixed broadband subscriptions (per 100 people) */
  BROADBAND_SUBSCRIPTIONS: 'IT.NET.BBND.P2',
  /** Air transport, passengers carried */
  AIR_TRANSPORT_PASSENGERS: 'IS.AIR.PSGR',
  /** Container port traffic (TEU: 20 foot equivalent units) */
  CONTAINER_PORT_TRAFFIC: 'IS.SHP.GOOD.TU',

  // ── Finance ──
  /** Market capitalization of listed domestic companies (% of GDP) */
  MARKET_CAP_PERCENT_GDP: 'CM.MKT.LCAP.GD.ZS',
  /** Broad money (% of GDP) */
  BROAD_MONEY_PERCENT_GDP: 'FM.LBL.BMNY.GD.ZS',
  /** Domestic credit to private sector (% of GDP) */
  DOMESTIC_CREDIT_PRIVATE: 'FS.AST.PRVT.GD.ZS',
  /** Interest rate spread (lending rate minus deposit rate, %) */
  INTEREST_RATE_SPREAD: 'FR.INR.LNDP',
  /** Remittances, received (% of GDP) */
  REMITTANCES_PERCENT_GDP: 'BX.TRF.PWKR.DT.GD.ZS',

  // ── Poverty & Inequality ──
  /** Poverty headcount ratio at $1.90 a day (% of population) */
  POVERTY_190_DAY: 'SI.POV.DDAY',
  /** GINI index */
  GINI_INDEX: 'SI.POV.GINI',
  /** Income share held by highest 10% */
  INCOME_SHARE_HIGHEST_10: 'SI.DST.10TH.10',
  /** Income share held by lowest 10% */
  INCOME_SHARE_LOWEST_10: 'SI.DST.FRST.10',
} as const;

/** Type for World Bank indicator keys */
export type WbIndicatorKey = keyof typeof WB_INDICATORS;

/** Indicator key-to-category mapping */
export const WB_INDICATOR_CATEGORIES: Record<string, WorldBankIndicatorCategory> = {
  [WB_INDICATORS.GDP_CURRENT_USD]: 'economy',
  [WB_INDICATORS.GDP_GROWTH_ANNUAL]: 'economy',
  [WB_INDICATORS.GDP_PER_CAPITA_USD]: 'economy',
  [WB_INDICATORS.GDP_PER_CAPITA_GROWTH]: 'economy',
  [WB_INDICATORS.GNI_CURRENT_USD]: 'economy',
  [WB_INDICATORS.GNI_PER_CAPITA_USD]: 'economy',
  [WB_INDICATORS.INFLATION_CPI]: 'economy',
  [WB_INDICATORS.UNEMPLOYMENT_TOTAL]: 'economy',
  [WB_INDICATORS.LABOR_FORCE_TOTAL]: 'economy',
  [WB_INDICATORS.GDP_DEFLATOR]: 'economy',

  [WB_INDICATORS.EXPORTS_GOODS_SERVICES]: 'trade',
  [WB_INDICATORS.IMPORTS_GOODS_SERVICES]: 'trade',
  [WB_INDICATORS.TRADE_PERCENT_GDP]: 'trade',
  [WB_INDICATORS.HIGH_TECH_EXPORTS]: 'trade',
  [WB_INDICATORS.CURRENT_ACCOUNT_BALANCE]: 'trade',
  [WB_INDICATORS.FDI_NET_INFLOWS]: 'trade',

  [WB_INDICATORS.POPULATION_TOTAL]: 'population',
  [WB_INDICATORS.POPULATION_GROWTH]: 'population',
  [WB_INDICATORS.POPULATION_FEMALE_PERCENT]: 'population',
  [WB_INDICATORS.POPULATION_AGED_65_PLUS]: 'population',
  [WB_INDICATORS.URBAN_POPULATION_PERCENT]: 'population',
  [WB_INDICATORS.POPULATION_DENSITY]: 'population',

  [WB_INDICATORS.LIFE_EXPECTANCY_TOTAL]: 'health',
  [WB_INDICATORS.MATERNAL_MORTALITY]: 'health',
  [WB_INDICATORS.INFANT_MORTALITY]: 'health',
  [WB_INDICATORS.HEALTH_EXPENDITURE_PERCENT_GDP]: 'health',
  [WB_INDICATORS.PHYSICIANS_PER_THOUSAND]: 'health',
  [WB_INDICATORS.IMMUNIZATION_DPT]: 'health',
  [WB_INDICATORS.UNDERNOURISHMENT]: 'health',

  [WB_INDICATORS.EDUCATION_EXPENDITURE_PERCENT_GDP]: 'education',
  [WB_INDICATORS.SCHOOL_ENROLLMENT_PRIMARY]: 'education',
  [WB_INDICATORS.SCHOOL_ENROLLMENT_SECONDARY]: 'education',
  [WB_INDICATORS.SCHOOL_ENROLLMENT_TERTIARY]: 'education',
  [WB_INDICATORS.LITERACY_RATE_ADULT]: 'education',
  [WB_INDICATORS.PUPIL_TEACHER_RATIO_PRIMARY]: 'education',

  [WB_INDICATORS.CO2_EMISSIONS_PER_CAPITA]: 'environment',
  [WB_INDICATORS.RENEWABLE_ENERGY_PERCENT]: 'environment',
  [WB_INDICATORS.ACCESS_ELECTRICITY_PERCENT]: 'environment',
  [WB_INDICATORS.ENERGY_USE_PER_CAPITA]: 'environment',
  [WB_INDICATORS.FOREST_AREA_PERCENT]: 'environment',

  [WB_INDICATORS.INTERNET_USERS_PERCENT]: 'infrastructure',
  [WB_INDICATORS.MOBILE_SUBSCRIPTIONS]: 'infrastructure',
  [WB_INDICATORS.BROADBAND_SUBSCRIPTIONS]: 'infrastructure',
  [WB_INDICATORS.AIR_TRANSPORT_PASSENGERS]: 'infrastructure',
  [WB_INDICATORS.CONTAINER_PORT_TRAFFIC]: 'infrastructure',

  [WB_INDICATORS.MARKET_CAP_PERCENT_GDP]: 'finance',
  [WB_INDICATORS.BROAD_MONEY_PERCENT_GDP]: 'finance',
  [WB_INDICATORS.DOMESTIC_CREDIT_PRIVATE]: 'finance',
  [WB_INDICATORS.INTEREST_RATE_SPREAD]: 'finance',
  [WB_INDICATORS.REMITTANCES_PERCENT_GDP]: 'finance',

  [WB_INDICATORS.POVERTY_190_DAY]: 'poverty',
  [WB_INDICATORS.GINI_INDEX]: 'poverty',
  [WB_INDICATORS.INCOME_SHARE_HIGHEST_10]: 'poverty',
  [WB_INDICATORS.INCOME_SHARE_LOWEST_10]: 'poverty',
};

/** Grouped indicator codes by category for batch fetching */
export const WB_INDICATORS_BY_CATEGORY: Record<WorldBankIndicatorCategory, string[]> = {
  economy: [
    WB_INDICATORS.GDP_CURRENT_USD,
    WB_INDICATORS.GDP_GROWTH_ANNUAL,
    WB_INDICATORS.GDP_PER_CAPITA_USD,
    WB_INDICATORS.GDP_PER_CAPITA_GROWTH,
    WB_INDICATORS.GNI_CURRENT_USD,
    WB_INDICATORS.GNI_PER_CAPITA_USD,
    WB_INDICATORS.INFLATION_CPI,
    WB_INDICATORS.UNEMPLOYMENT_TOTAL,
    WB_INDICATORS.LABOR_FORCE_TOTAL,
    WB_INDICATORS.GDP_DEFLATOR,
  ],
  trade: [
    WB_INDICATORS.EXPORTS_GOODS_SERVICES,
    WB_INDICATORS.IMPORTS_GOODS_SERVICES,
    WB_INDICATORS.TRADE_PERCENT_GDP,
    WB_INDICATORS.HIGH_TECH_EXPORTS,
    WB_INDICATORS.CURRENT_ACCOUNT_BALANCE,
    WB_INDICATORS.FDI_NET_INFLOWS,
  ],
  health: [
    WB_INDICATORS.LIFE_EXPECTANCY_TOTAL,
    WB_INDICATORS.MATERNAL_MORTALITY,
    WB_INDICATORS.INFANT_MORTALITY,
    WB_INDICATORS.HEALTH_EXPENDITURE_PERCENT_GDP,
    WB_INDICATORS.PHYSICIANS_PER_THOUSAND,
    WB_INDICATORS.IMMUNIZATION_DPT,
    WB_INDICATORS.UNDERNOURISHMENT,
  ],
  education: [
    WB_INDICATORS.EDUCATION_EXPENDITURE_PERCENT_GDP,
    WB_INDICATORS.SCHOOL_ENROLLMENT_PRIMARY,
    WB_INDICATORS.SCHOOL_ENROLLMENT_SECONDARY,
    WB_INDICATORS.SCHOOL_ENROLLMENT_TERTIARY,
    WB_INDICATORS.LITERACY_RATE_ADULT,
    WB_INDICATORS.PUPIL_TEACHER_RATIO_PRIMARY,
  ],
  population: [
    WB_INDICATORS.POPULATION_TOTAL,
    WB_INDICATORS.POPULATION_GROWTH,
    WB_INDICATORS.POPULATION_FEMALE_PERCENT,
    WB_INDICATORS.POPULATION_AGED_65_PLUS,
    WB_INDICATORS.URBAN_POPULATION_PERCENT,
    WB_INDICATORS.POPULATION_DENSITY,
  ],
  environment: [
    WB_INDICATORS.CO2_EMISSIONS_PER_CAPITA,
    WB_INDICATORS.RENEWABLE_ENERGY_PERCENT,
    WB_INDICATORS.ACCESS_ELECTRICITY_PERCENT,
    WB_INDICATORS.ENERGY_USE_PER_CAPITA,
    WB_INDICATORS.FOREST_AREA_PERCENT,
  ],
  infrastructure: [
    WB_INDICATORS.INTERNET_USERS_PERCENT,
    WB_INDICATORS.MOBILE_SUBSCRIPTIONS,
    WB_INDICATORS.BROADBAND_SUBSCRIPTIONS,
    WB_INDICATORS.AIR_TRANSPORT_PASSENGERS,
    WB_INDICATORS.CONTAINER_PORT_TRAFFIC,
  ],
  poverty: [
    WB_INDICATORS.POVERTY_190_DAY,
    WB_INDICATORS.GINI_INDEX,
    WB_INDICATORS.INCOME_SHARE_HIGHEST_10,
    WB_INDICATORS.INCOME_SHARE_LOWEST_10,
  ],
  gender: [],
  energy: [],
  finance: [
    WB_INDICATORS.MARKET_CAP_PERCENT_GDP,
    WB_INDICATORS.BROAD_MONEY_PERCENT_GDP,
    WB_INDICATORS.DOMESTIC_CREDIT_PRIVATE,
    WB_INDICATORS.INTEREST_RATE_SPREAD,
    WB_INDICATORS.REMITTANCES_PERCENT_GDP,
  ],
  agriculture: [],
  social: [],
};

/* ------------------------------------------------------------------ */
/*  URL Builders                                                       */
/* ------------------------------------------------------------------ */

/** Build a World Bank API URL for a given path. */
export function wbUrl(
  path: string,
  params: Record<string, string> = {},
): string {
  const searchParams = new URLSearchParams({
    [WB_FORMAT]: '',
    ...params,
  });
  return `${WB_API_BASE}${path}?${searchParams.toString()}`;
}

/** Build URL for indicator data by country. */
export function wbCountryIndicatorUrl(
  countryCode: string,
  indicatorCode: string,
  params: Record<string, string> = {},
): string {
  return wbUrl(`/country/${countryCode}/indicator/${indicatorCode}`, {
    per_page: '100',
    ...params,
  });
}

/** Build URL for all countries, single indicator. */
export function wbIndicatorUrl(
  indicatorCode: string,
  params: Record<string, string> = {},
): string {
  return wbUrl(`/indicator/${indicatorCode}`, {
    per_page: '500',
    ...params,
  });
}

/** Build the data explorer URL for a given indicator. */
export function wbDataExplorerUrl(indicatorCode: string): string {
  return `https://data.worldbank.org/indicator/${indicatorCode}`;
}

/** Human-readable name for an indicator code. */
export function wbIndicatorName(code: string): string {
  const entry = Object.entries(WB_INDICATORS).find(
    ([, value]) => value === code,
  );
  if (entry) {
    return entry[0].replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return code;
}

/** All 50 top indicator codes as an array. */
export const WB_TOP_INDICATORS: string[] = Object.values(WB_INDICATORS);
