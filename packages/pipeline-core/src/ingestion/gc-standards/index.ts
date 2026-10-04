/**
 * GC Standards & Compatibility — Quill
 *
 * Canonical mappings, schemas, and compatibility layers adopted from:
 *
 * - GoC-Spending department acronyms (goc-spending.github.io)
 *   Standardized 83-department code list used across GC spending analysis.
 *
 * - Canada.ca AIA (Algorithmic Impact Assessment)
 *   Department list used by Treasury Board for AI governance.
 *
 * - Justice Canada Otto legal AI platform
 *   Structured legal data formats for ML compatibility (AGPL-3.0).
 *
 * - CanLII API
 *   Standard court database IDs for case law.
 *
 * - A2AJ Canadian Legal Data
 *   116K+ decision corpus with standardized dataset codes.
 */

/** Standard GC department acronym → full name mapping */
export const GC_DEPARTMENTS: Record<string, string> = {
  acoa: 'Atlantic Canada Opportunities Agency',
  agr: 'Agriculture and Agri-Food Canada',
  atssc: 'Administrative Tribunals Support Service of Canada',
  cannor: 'Canadian Northern Economic Development Agency',
  cas: 'Courts Administration Service',
  cbsa: 'Canada Border Services Agency',
  cc: 'Canadian Coast Guard',
  ccohs: 'Canadian Centre for Occupational Health and Safety',
  ceaa: 'Canadian Environmental Assessment Agency',
  ced: 'Canada Economic Development for Quebec Regions',
  cfia: 'Canadian Food Inspection Agency',
  cgc: 'Canadian Grain Commission',
  chrc: 'Canadian Human Rights Commission',
  cics: 'Canadian Intergovernmental Conference Secretariat',
  cihr: 'Canadian Institutes of Health Research',
  cnsc: 'Canadian Nuclear Safety Commission',
  cpc: 'Canada Post Corporation',
  cra: 'Canada Revenue Agency',
  crtc: 'Canadian Radio-television and Telecommunications Commission',
  csa: 'Canadian Space Agency',
  csc: 'Correctional Service Canada',
  csps: 'Canada School of Public Service',
  cta: 'Canadian Transportation Agency',
  dfo: 'Fisheries and Oceans Canada',
  dnd: 'National Defence',
  ec: 'Environment and Climate Change Canada',
  elections: 'Elections Canada',
  esdc: 'Employment and Social Development Canada',
  fcac: 'Financial Consumer Agency of Canada',
  feddev: 'Federal Economic Development Agency for Southern Ontario',
  fin: 'Department of Finance Canada',
  fintrac: 'Financial Transactions and Reports Analysis Centre of Canada',
  fja: 'Office of the Commissioner for Federal Judicial Affairs',
  fpcc: 'Federal-Provincial Relations Office',
  gac: 'Global Affairs Canada',
  hc: 'Health Canada',
  ic: 'Innovation, Science and Economic Development Canada',
  ijc: 'International Joint Commission',
  inac: 'Indigenous and Northern Affairs Canada',
  infra: 'Infrastructure Canada',
  ircc: 'Immigration, Refugees and Citizenship Canada',
  isc: 'Indigenous Services Canada',
  just: 'Department of Justice Canada',
  lac: 'Library and Archives Canada',
  mgerc: 'Military Grievances External Review Committee',
  mpcc: 'Military Police Complaints Commission',
  neb: 'National Energy Board',
  nfb: 'National Film Board',
  nrc: 'National Research Council Canada',
  nrcan: 'Natural Resources Canada',
  nserc: 'Natural Sciences and Engineering Research Council',
  oag: 'Office of the Auditor General of Canada',
  oci: 'Office of the Correctional Investigator',
  ocl: 'Office of the Commissioner of Lobbying',
  ocol: 'Office of the Commissioner of Official Languages',
  oic: 'Office of the Information Commissioner of Canada',
  opc: 'Office of the Privacy Commissioner of Canada',
  osfi: 'Office of the Superintendent of Financial Institutions',
  osgg: 'Office of the Secretary to the Governor General',
  oto: 'Office of the Taxpayers Ombudsman',
  pbc: 'Parole Board of Canada',
  pc: 'Privy Council Office',
  pch: 'Canadian Heritage',
  pco: 'Privy Council Office',
  phac: 'Public Health Agency of Canada',
  pmprb: 'Patented Medicine Prices Review Board',
  ppsc: 'Public Prosecution Service of Canada',
  pptc: 'Public Prosecution Service of Canada',
  ps: 'Public Safety Canada',
  psc: 'Public Service Commission',
  psic: 'Public Sector Integrity Commission',
  pspc: 'Public Services and Procurement Canada',
  rcmp: 'Royal Canadian Mounted Police',
  sirc: 'Security Intelligence Review Committee',
  ssc: 'Shared Services Canada',
  sshrc: 'Social Sciences and Humanities Research Council',
  stats: 'Statistics Canada',
  swc: 'Status of Women Canada',
  tbs: 'Treasury Board of Canada Secretariat',
  tc: 'Transport Canada',
  tsb: 'Transportation Safety Board of Canada',
  vac: 'Veterans Affairs Canada',
  vrab: 'Veterans Review and Appeal Board',
};

/** Reverse: full name → acronym */
export const GC_DEPARTMENT_CODES: Record<string, string> = {};
for (const [code, name] of Object.entries(GC_DEPARTMENTS)) {
  GC_DEPARTMENT_CODES[name.toLowerCase()] = code;
}

/** Try to normalize any department name/alias to a canonical code */
export function normalizeDepartment(name: string): string {
  const cleaned = name.trim().toLowerCase();
  // Direct match
  if (GC_DEPARTMENT_CODES[cleaned]) return GC_DEPARTMENT_CODES[cleaned];
  // Acronym match
  if (GC_DEPARTMENTS[cleaned]) return cleaned;
  // Partial match
  for (const [fullName, code] of Object.entries(GC_DEPARTMENT_CODES)) {
    if (fullName.includes(cleaned) || cleaned.includes(fullName)) return code;
  }
  return cleaned.replace(/[^a-z0-9]/g, '-').substring(0, 20);
}

/**
 * A2AJ legal dataset codes (from api.a2aj.ca/coverage)
 * Courts, tribunals, and legislation datasets with standardized identifiers.
 */
export const A2AJ_DATASET_CODES: Record<string, string> = {
  SCC: 'Supreme Court of Canada',
  FCA: 'Federal Court of Appeal',
  FC: 'Federal Court',
  TCC: 'Tax Court of Canada',
  ONCA: 'Ontario Court of Appeal',
  ONSC: 'Ontario Superior Court of Justice',
  BCCA: 'British Columbia Court of Appeal',
  BCSC: 'British Columbia Supreme Court',
  ABCA: 'Alberta Court of Appeal',
  ABKB: 'Alberta Court of King\'s Bench',
  QCCA: 'Quebec Court of Appeal',
  QCCS: 'Quebec Superior Court',
  RAD: 'Refugee Appeal Division',
  RPD: 'Refugee Protection Division',
  SST: 'Social Security Tribunal',
  CITT: 'Canadian International Trade Tribunal',
  CHRT: 'Canadian Human Rights Tribunal',
  FED: 'Federal Court',
  LEGISLATION_FED: 'Federal Legislation',
  REGULATIONS_FED: 'Federal Regulations',
};

/** CanLII court database IDs matching A2AJ codes */
export const CANLII_COURT_IDS: Record<string, string> = {
  SCC: 'scc-csc',
  FCA: 'fca-caf',
  FC: 'fc-cf',
  TCC: 'tcc-cci',
  ONCA: 'onca',
  ONSC: 'onsc',
  BCCA: 'bcca',
  BCSC: 'bcsc',
  ABCA: 'abca',
  ABKB: 'abkb',
};
