/**
export { parseCppOasBeneficiary, parseCppOasBeneficiarys } from './parser.js';
 * Social Programs Ingestion — Quill
 *
 * Orchestrates ingestion of Canadian social program data from
 * open.canada.ca CKAN and other federal sources:
 *   1. Canada Child Benefit (CCB) — payments by federal riding
 *   2. CPP/OAS/GIS — beneficiary counts and CPPIB investments
 *   3. Employment Insurance (EI) — claims and benefits by province
 *   4. Poverty statistics — LICO, LIM, MBM thresholds and rates
 *   5. Food security — Food Banks Canada HungerCount, homelessness
 *   6. Social assistance — provincial welfare rates
 */

import { ingestCcb, searchCcbDatasets } from './ccb.js';
import { ingestCppOas, searchCppOasDatasets } from './cpp-oas.js';
import { ingestEi, searchEiDatasets } from './ei.js';
import { ingestFoodSecurity } from './food-security.js';
import { ingestPoverty, searchPovertyDatasets } from './poverty.js';
import { ingestSocialAssistance } from './social-assistance.js';
import {
  SOCIAL_SOURCES, SOCIAL_CKAN_PACKAGE_IDS, SOCIAL_CKAN_QUERIES,
  SOCIAL_CPP_OAS_DDL, SOCIAL_EI_DDL, SOCIAL_CCB_DDL,
  SOCIAL_POVERTY_DDL, SOCIAL_ASSISTANCE_DDL, SOCIAL_FOOD_SECURITY_DDL, SOCIAL_DDL,
  ckanPackageShowUrl, ckanSearchUrl, ckanDownloadUrl,
} from './constants.js';
import type {
  CcbRecord, CppOasBeneficiary, CppibInvestment, EiRecord,
  PovertyRecord, SocialAssistanceRecord, FoodBankRecord,
  HomelessnessRecord, DisabilityBenefitRecord, SocialIngestionResult,
} from './types.js';

export type {
  CcbRecord, CppOasBeneficiary, CppibInvestment, EiRecord,
  PovertyRecord, SocialAssistanceRecord, FoodBankRecord,
  HomelessnessRecord, DisabilityBenefitRecord, SocialIngestionResult,
};

export {
  SOCIAL_SOURCES, SOCIAL_CKAN_PACKAGE_IDS, SOCIAL_CKAN_QUERIES,
  SOCIAL_CPP_OAS_DDL, SOCIAL_EI_DDL, SOCIAL_CCB_DDL,
  SOCIAL_POVERTY_DDL, SOCIAL_ASSISTANCE_DDL, SOCIAL_FOOD_SECURITY_DDL, SOCIAL_DDL,
  ckanPackageShowUrl, ckanSearchUrl, ckanDownloadUrl,
};

/** Ingest all social program data sources in parallel */
export async function ingestAllSocialPrograms(): Promise<SocialIngestionResult> {
  const startTime = Date.now();

  const [ccb, cppOas, ei, poverty, foodSecurity, socialAssistance] = await Promise.all([
    ingestCcb().catch((e: unknown) => ({ records: [] as CcbRecord[], errors: [String(e)] })),
    ingestCppOas().catch((e: unknown) => ({ beneficiaries: [] as CppOasBeneficiary[], investments: [] as CppibInvestment[], errors: [String(e)] })),
    ingestEi().catch((e: unknown) => ({ records: [] as EiRecord[], errors: [String(e)] })),
    ingestPoverty().catch((e: unknown) => ({ records: [] as PovertyRecord[], errors: [String(e)] })),
    ingestFoodSecurity().catch((e: unknown) => ({ foodBanks: [] as FoodBankRecord[], homelessness: [] as HomelessnessRecord[], disabilityBenefits: [] as DisabilityBenefitRecord[], errors: [String(e)] })),
    ingestSocialAssistance().catch((e: unknown) => ({ records: [] as SocialAssistanceRecord[], errors: [String(e)] })),
  ]);

  return {
    ccb: { recordsFound: ccb.records.length, recordsIngested: ccb.records.length, errors: ccb.errors },
    cppOas: { recordsFound: cppOas.beneficiaries?.length ?? 0, recordsIngested: cppOas.beneficiaries?.length ?? 0, errors: cppOas.errors },
    cppib: { recordsFound: cppOas.investments?.length ?? 0, recordsIngested: cppOas.investments?.length ?? 0, errors: [] },
    ei: { recordsFound: ei.records.length, recordsIngested: ei.records.length, errors: ei.errors },
    poverty: { recordsFound: poverty.records.length, recordsIngested: poverty.records.length, errors: poverty.errors },
    socialAssistance: { recordsFound: socialAssistance.records.length, recordsIngested: socialAssistance.records.length, errors: socialAssistance.errors },
    foodSecurity: {
      recordsFound: foodSecurity.foodBanks.length + foodSecurity.homelessness.length + foodSecurity.disabilityBenefits.length,
      recordsIngested: foodSecurity.foodBanks.length + foodSecurity.homelessness.length + foodSecurity.disabilityBenefits.length,
      errors: foodSecurity.errors,
    },
    durationMs: Date.now() - startTime,
  };
}

/** Search all social program datasets via CKAN */
export async function searchSocialPrograms(query: string): Promise<{
  records: Record<string, unknown>[];
  errors: string[];
  durationMs: number;
}> {
  const startTime = Date.now();
  const results = await Promise.allSettled([
    searchCcbDatasets(query),
    searchCppOasDatasets(query),
    searchEiDatasets(query),
    searchPovertyDatasets(query),
  ]);
  const records: Record<string, unknown>[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') records.push(...(r.value as unknown[] as Record<string, unknown>[]));
    else errors.push(r.reason?.message ?? 'unknown');
  }
  return { records, errors, durationMs: Date.now() - startTime };
}
