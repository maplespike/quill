// SPDX-License-Identifier: AGPL-3.0-only
export const UNION_USER_AGENT = 'MapleSpike-Unions/1.0';
export const UNION_TIMEOUT_MS = 15_000;
export const MAJOR_UNIONS = [
  { name: 'CUPE', url: 'https://cupe.ca', annualReportPath: '/about/reports' },
  { name: 'Unifor', url: 'https://unifor.org', annualReportPath: '/about/financials' },
  { name: 'PSAC', url: 'https://psac-afpc.com', annualReportPath: '/about/financial-statements' },
  { name: 'NUPGE', url: 'https://nupge.ca', annualReportPath: '/about/financials' },
  { name: 'UFCW Canada', url: 'https://ufcw.ca', annualReportPath: '/about/reports' },
  { name: 'Teamsters Canada', url: 'https://teamsters.ca', annualReportPath: '/about/financials' },
  { name: 'IBEW Canada', url: 'https://ibew.ca', annualReportPath: '/about' },
  { name: 'LIUNA', url: 'https://liuna.ca', annualReportPath: '/about' },
];
export const MAX_UNION_RECORDS = 100;
