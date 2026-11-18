// ---------------------------------------------------------------------------
// MapleSpike SDK — Zod validation schemas per action
// ---------------------------------------------------------------------------
// Auto-generated from agents.ts definitions. Schemas are keyed by
// `${agentName}/${actionId}` in the SCHEMAS export.
// ---------------------------------------------------------------------------
import { z } from 'zod';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Optional string field */
const str = () => z.string().optional();
/** Optional number field (accepts numeric strings too). A missing key stays absent. */
const num = () => z.coerce.number().optional();
/** Optional positive integer cap. A missing key stays absent. */
const lim = () => z.coerce.number().int().min(1).max(1000).optional();
/** Required string */
const reqStr = () => z.string().min(1);
/** Required number (coerced) */
const reqNum = () => z.coerce.number();

// ─── Committees ─────────────────────────────────────────────────────────────

export const committeeMembershipSchema = z.object({
  committee: str(),
  parliament: num(),
  chamber: z.enum(['commons', 'senate']).optional(),
  party: str(),
  limit: lim(),
});

export const committeeMeetingsSchema = z.object({
  committee: str(),
  date_from: str(),
  date_to: str(),
  parliament: num(),
  limit: lim(),
});

export const committeeReportsSchema = z.object({
  committee: str(),
  parliament: num(),
  keyword: str(),
  limit: lim(),
});

export const committeeWitnessesSchema = z.object({
  committee: str(),
  witness: str(),
  date_from: str(),
  date_to: str(),
  limit: lim(),
});

// ─── Corporate ──────────────────────────────────────────────────────────────

export const corporationProfileSchema = z.object({
  business_number: reqStr(),
  jurisdiction: str(),
  include_directors: str(),
});

export const corporationFilingsSchema = z.object({
  business_number: reqStr(),
  year: num(),
  filing_type: str(),
  limit: lim(),
});

export const directorRegistrySchema = z.object({
  business_number: str(),
  director_name: str(),
  limit: lim(),
});

export const lobbyingActivitiesSchema = z.object({
  lobbyist: str(),
  client: str(),
  subject: str(),
  date_from: str(),
  limit: lim(),
});

// ─── Influence ──────────────────────────────────────────────────────────────

export const politicalContributionsSchema = z.object({
  donor: str(),
  party: str(),
  year: num(),
  limit: lim(),
  sort: str(),
});

export const fundraisingEventsSchema = z.object({
  party: str(),
  date_from: str(),
  date_to: str(),
  limit: lim(),
});

export const mediaOwnershipSchema = z.object({
  media_group: str(),
  outlet: str(),
  limit: lim(),
});

// ─── Regulations ────────────────────────────────────────────────────────────

export const regulatoryProposalsSchema = z.object({
  agency: str(),
  status: str(),
  keyword: str(),
  published_after: str(),
  limit: lim(),
});

export const regulatoryDecisionsSchema = z.object({
  agency: str(),
  decision_type: str(),
  date_from: str(),
  limit: lim(),
});

export const consultationCommentsSchema = z.object({
  proposal_id: str(),
  commenter: str(),
  keyword: str(),
  limit: lim(),
});

// ─── Courts ─────────────────────────────────────────────────────────────────

export const courtDecisionsSchema = z.object({
  court: str(),
  date_from: str(),
  keyword: str(),
  citation: str(),
  limit: lim(),
});

export const caseTrackingSchema = z.object({
  case_number: str(),
  court: str(),
  party_name: str(),
  status: str(),
  limit: lim(),
});

export const tribunalRulingsSchema = z.object({
  tribunal: str(),
  date_from: str(),
  keyword: str(),
  limit: lim(),
});

// ─── Oversight ──────────────────────────────────────────────────────────────

export const auditorReportsSchema = z.object({
  agency: str(),
  year: num(),
  keyword: str(),
  limit: lim(),
});

export const watchdogReportsSchema = z.object({
  office: str(),
  year: num(),
  keyword: str(),
  limit: lim(),
});

export const accessToInformationSchema = z.object({
  institution: str(),
  year: num(),
  keyword: str(),
  limit: lim(),
});

export const conflictOfInterestSchema = z.object({
  public_office_holder: str(),
  year: num(),
  finding: str(),
  limit: lim(),
});

// ─── Data ───────────────────────────────────────────────────────────────────

export const governmentSpendingSchema = z.object({
  department: str(),
  year: num(),
  category: str(),
  limit: lim(),
  min_amount: num(),
});

export const electionResultsSchema = z.object({
  year: num(),
  riding: str(),
  party: str(),
  type: z.enum(['federal', 'provincial']).optional(),
  limit: lim(),
});

export const populationStatisticsSchema = z.object({
  region: str(),
  year: num(),
  demographic: str(),
  limit: lim(),
});

export const publicSalaryDisclosureSchema = z.object({
  employer: str(),
  year: num(),
  min_salary: num(),
  name: str(),
  limit: lim(),
});

// ─── Immigration ────────────────────────────────────────────────────────────

export const permanentResidentsSchema = z.object({
  province: str(),
  year: num(),
  category: str(),
  limit: lim(),
});

export const studyPermitsSchema = z.object({
  year: num(),
  country: str(),
  limit: lim(),
});

export const workPermitsSchema = z.object({
  year: num(),
  program: str(),
  province: str(),
  limit: lim(),
});

export const refugeeDecisionsSchema = z.object({
  year: num(),
  country: str(),
  outcome: str(),
  limit: lim(),
});

export const cbsaEnforcementSchema = z.object({
  year: num(),
  type: str(),
  limit: lim(),
});

// ─── Indigenous Relations ───────────────────────────────────────────────────

export const landClaimsSchema = z.object({
  status: str(),
  province: str(),
  limit: lim(),
});

export const iscSpendingSchema = z.object({
  program: str(),
  province: str(),
  year: num(),
  limit: lim(),
});

export const fnTransparencySchema = z.object({
  year: num(),
  first_nation: str(),
  limit: lim(),
});

export const trcProgressSchema = z.object({
  call_number: str(),
  status: str(),
  limit: lim(),
});

// ─── Criminal Justice ───────────────────────────────────────────────────────

export const correctionsPopulationSchema = z.object({
  year: num(),
  province: str(),
  type: str(),
});

export const paroleDecisionsSchema = z.object({
  year: num(),
  outcome: str(),
  limit: lim(),
});

export const rcmpCrimeStatsSchema = z.object({
  year: num(),
  province: str(),
  violation: str(),
  limit: lim(),
});

export const prosecutionsSchema = z.object({
  year: num(),
  province: str(),
  limit: lim(),
});

// ─── Defence ────────────────────────────────────────────────────────────────

export const personnelSchema = z.object({
  year: num(),
  rank: str(),
  trade: str(),
  limit: lim(),
});

export const procurementSchema = z.object({
  year: num(),
  vendor: str(),
  value_min: num(),
  limit: lim(),
});

// ─── Municipal ──────────────────────────────────────────────────────────────

export const municipalMeetingsSchema = z.object({
  city: str(),
  year: num(),
  type: str(),
  limit: lim(),
});

export const municipalBudgetsSchema = z.object({
  city: str(),
  year: num(),
  limit: lim(),
});

export const municipalOpenDataSchema = z.object({
  city: str(),
  keyword: str(),
  limit: lim(),
});

// ─── Transport ──────────────────────────────────────────────────────────────

export const tsbOccurrencesSchema = z.object({
  mode: str(),
  year: num(),
  province: str(),
  limit: lim(),
});

export const tcRecallsSchema = z.object({
  year: num(),
  make: str(),
  type: str(),
  limit: lim(),
});

export const ctaRulingsSchema = z.object({
  year: num(),
  keyword: str(),
  limit: lim(),
});

// ─── Real-Time ──────────────────────────────────────────────────────────────

export const weatherAlertsSchema = z.object({
  province: str(),
  severity: str(),
  limit: lim(),
});

export const borderWaitsSchema = z.object({
  port: str(),
  province: str(),
  limit: lim(),
});

export const paroleRegistrySchema = z.object({
  year: num(),
  limit: lim(),
});

// ─── Media & Broadcasting ───────────────────────────────────────────────────

export const crtcMarketReportsSchema = z.object({
  year: num(),
  sector: str(),
  limit: lim(),
});

export const ownershipChartsSchema = z.object({
  sector: str(),
  limit: lim(),
});

export const cmfDataSchema = z.object({
  year: num(),
  program: str(),
  limit: lim(),
});

// ─── Education & Research ───────────────────────────────────────────────────

export const triCouncilGrantsSchema = z.object({
  agency: str(),
  institution: str(),
  year: num(),
  limit: lim(),
});

export const researchChairsSchema = z.object({
  institution: str(),
  tier: str(),
  limit: lim(),
});

export const studentLoansSchema = z.object({
  year: num(),
  province: str(),
  limit: lim(),
});

export const cudoDataSchema = z.object({
  institution: str(),
  year: num(),
  metric: str(),
  limit: lim(),
});

// ─── Social Programs ────────────────────────────────────────────────────────

export const ccbDataSchema = z.object({
  year: num(),
  riding: str(),
  province: str(),
  limit: lim(),
});

export const cppOasSchema = z.object({
  program: str(),
  year: num(),
  province: str(),
  limit: lim(),
});

export const eiStatisticsSchema = z.object({
  year: num(),
  province: str(),
  limit: lim(),
});

export const povertyDataSchema = z.object({
  measure: str(),
  year: num(),
  province: str(),
  limit: lim(),
});

// ─── Bank of Canada ─────────────────────────────────────────────────────────

export const rateDecisionsSchema = z.object({
  date_from: str(),
  date_to: str(),
  limit: lim(),
});

export const monetaryPolicySchema = z.object({
  year: num(),
  limit: lim(),
});

// ─── Unions ─────────────────────────────────────────────────────────────────

export const unionReportsSchema = z.object({
  union_name: str(),
  year: num(),
  limit: lim(),
});

// ─── Universities ───────────────────────────────────────────────────────────

export const universityDataSchema = z.object({
  institution: str(),
  year: num(),
  province: str(),
  limit: lim(),
});

// ─── CRTC ───────────────────────────────────────────────────────────────────

export const crtcDecisionsSchema = z.object({
  year: num(),
  type: str(),
  applicant: str(),
  limit: lim(),
});

export const crtcOwnershipSchema = z.object({
  owner: str(),
  limit: lim(),
});

// ─── CRA Charity ────────────────────────────────────────────────────────────

export const charitySearchSchema = z.object({
  query: str(),
  category: str(),
  year: num(),
  limit: lim(),
});

export const politicalSpendingSchema = z.object({
  year: num(),
  limit: lim(),
});

// ─── Provincial Regulators ──────────────────────────────────────────────────

export const regulatorSearchSchema = z.object({
  province: str(),
  category: str(),
  query: str(),
  limit: lim(),
});

export const regulatorCoverageSchema = z.object({
  // No params
});

// ─── A2AJ Legal API ─────────────────────────────────────────────────────────

export const legalSearchSchema = z.object({
  query: reqStr(),
  doc_type: str(),
  dataset: str(),
  size: num(),
  start_date: str(),
  end_date: str(),
});

export const legalFetchSchema = z.object({
  citation: reqStr(),
  doc_type: str(),
});

export const legalCoverageSchema = z.object({
  doc_type: str(),
});

// ─── Legislation ────────────────────────────────────────────────────────────

export const federalActsSchema = z.object({
  keyword: str(),
  limit: lim(),
});

export const federalRegulationsSchema = z.object({
  keyword: str(),
  limit: lim(),
});

export const provincialLegislationSchema = z.object({
  province: str(),
  keyword: str(),
  limit: lim(),
});

// ─── GoC Spending ───────────────────────────────────────────────────────────

export const contractsSchema = z.object({
  year: num(),
  department: str(),
  vendor: str(),
  limit: lim(),
});

export const spendingSummarySchema = z.object({
  year: num(),
  department: str(),
  limit: lim(),
});

// ─── SCHEMAS map ────────────────────────────────────────────────────────────
// Keyed by `${agentName}/${actionId}` for runtime lookup.

export const SCHEMAS: Record<string, z.ZodObject<any>> = {
  // Committees
  'committees/committee-membership': committeeMembershipSchema,
  'committees/committee-meetings': committeeMeetingsSchema,
  'committees/committee-reports': committeeReportsSchema,
  'committees/committee-witnesses': committeeWitnessesSchema,

  // Corporate
  'corporate/corporation-profile': corporationProfileSchema,
  'corporate/corporation-filings': corporationFilingsSchema,
  'corporate/director-registry': directorRegistrySchema,
  'corporate/lobbying-activities': lobbyingActivitiesSchema,

  // Influence
  'influence/political-contributions': politicalContributionsSchema,
  'influence/fundraising-events': fundraisingEventsSchema,
  'influence/media-ownership': mediaOwnershipSchema,

  // Regulations
  'regulations/regulatory-proposals': regulatoryProposalsSchema,
  'regulations/regulatory-decisions': regulatoryDecisionsSchema,
  'regulations/consultation-comments': consultationCommentsSchema,

  // Courts
  'courts/court-decisions': courtDecisionsSchema,
  'courts/case-tracking': caseTrackingSchema,
  'courts/tribunal-rulings': tribunalRulingsSchema,

  // Oversight
  'oversight/auditor-reports': auditorReportsSchema,
  'oversight/watchdog-reports': watchdogReportsSchema,
  'oversight/access-to-information': accessToInformationSchema,
  'oversight/conflict-of-interest': conflictOfInterestSchema,

  // Data
  'data/government-spending': governmentSpendingSchema,
  'data/election-results': electionResultsSchema,
  'data/population-statistics': populationStatisticsSchema,
  'data/public-salary-disclosure': publicSalaryDisclosureSchema,

  // Immigration
  'immigration/permanent-residents': permanentResidentsSchema,
  'immigration/study-permits': studyPermitsSchema,
  'immigration/work-permits': workPermitsSchema,
  'immigration/refugee-decisions': refugeeDecisionsSchema,
  'immigration/cbsa-enforcement': cbsaEnforcementSchema,

  // Indigenous
  'indigenous/land-claims': landClaimsSchema,
  'indigenous/isc-spending': iscSpendingSchema,
  'indigenous/fn-transparency': fnTransparencySchema,
  'indigenous/trc-progress': trcProgressSchema,

  // Criminal Justice
  'criminal-justice/corrections-population': correctionsPopulationSchema,
  'criminal-justice/parole-decisions': paroleDecisionsSchema,
  'criminal-justice/rcmp-crime-stats': rcmpCrimeStatsSchema,
  'criminal-justice/prosecutions': prosecutionsSchema,

  // Defence
  'defence/personnel': personnelSchema,
  'defence/procurement': procurementSchema,

  // Municipal
  'municipal/meetings': municipalMeetingsSchema,
  'municipal/budgets': municipalBudgetsSchema,
  'municipal/open-data': municipalOpenDataSchema,

  // Transport
  'transport/tsb-occurrences': tsbOccurrencesSchema,
  'transport/tc-recalls': tcRecallsSchema,
  'transport/cta-rulings': ctaRulingsSchema,

  // Real-Time
  'realtime/weather-alerts': weatherAlertsSchema,
  'realtime/border-waits': borderWaitsSchema,
  'realtime/parole-registry': paroleRegistrySchema,

  // Media
  'media/crtc-market-reports': crtcMarketReportsSchema,
  'media/ownership-charts': ownershipChartsSchema,
  'media/cmf-data': cmfDataSchema,

  // Education
  'education/tri-council-grants': triCouncilGrantsSchema,
  'education/research-chairs': researchChairsSchema,
  'education/student-loans': studentLoansSchema,
  'education/cudo-data': cudoDataSchema,

  // Social Programs
  'social-programs/ccb-data': ccbDataSchema,
  'social-programs/cpp-oas': cppOasSchema,
  'social-programs/ei-statistics': eiStatisticsSchema,
  'social-programs/poverty-data': povertyDataSchema,

  // Bank of Canada
  'bank-of-canada/rate-decisions': rateDecisionsSchema,
  'bank-of-canada/monetary-policy': monetaryPolicySchema,

  // Unions
  'unions/union-reports': unionReportsSchema,

  // Universities
  'universities/university-data': universityDataSchema,

  // CRTC
  'crtc/decisions': crtcDecisionsSchema,
  'crtc/ownership': crtcOwnershipSchema,

  // CRA Charity
  'cra-charity/charity-search': charitySearchSchema,
  'cra-charity/political-spending': politicalSpendingSchema,

  // Provincial Regulators
  'provincial-regulators/regulator-search': regulatorSearchSchema,
  'provincial-regulators/regulator-coverage': regulatorCoverageSchema,

  // A2AJ Legal
  'a2aj/legal-search': legalSearchSchema,
  'a2aj/legal-fetch': legalFetchSchema,
  'a2aj/legal-coverage': legalCoverageSchema,

  // Legislation
  'legislation/federal-acts': federalActsSchema,
  'legislation/federal-regulations': federalRegulationsSchema,
  'legislation/provincial-legislation': provincialLegislationSchema,

  // GoC Spending
  'goc-spending/contracts': contractsSchema,
  'goc-spending/spending-summary': spendingSummarySchema,
};

// ─── validateParams ─────────────────────────────────────────────────────────
// Looks up the schema for `agent/action`, then parses/validates `params`.

export function validateParams(
  agent: string,
  action: string,
  params?: Record<string, unknown>,
): Record<string, unknown> {
  const key = `${agent}/${action}`;
  const schema = SCHEMAS[key];
  if (!schema) {
    throw new Error(`No schema found for "${key}". Available keys: ${Object.keys(SCHEMAS).join(', ')}`);
  }
  return schema.parse(params ?? {});
}
