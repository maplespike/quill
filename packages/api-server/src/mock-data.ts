/**
 * MapleSpike — Mock Data
 *
 * Comprehensive curated sample responses for all agents and actions.
 * Triggered via `_mock=true` query parameter on any /v1/:agent/:action endpoint.
 *
 * Each entry in MOCK_DATA_MAP is keyed by "agent/action" and contains
 * realistic Canadian government data as arrays of typed records.
 */

import { enrichCitation, buildQualityMeta } from './response.js';
import type { CitationMeta, QualityMeta, BuildContext } from './response.js';

/* ------------------------------------------------------------------ */
/*  MOCK_DATA_MAP — keyed by "agent/action"                            */
/* ------------------------------------------------------------------ */

export const MOCK_DATA_MAP: Record<string, Record<string, unknown>> = {

  // ─── Committees ──────────────────────────────────────────────────

  'committees/committee-membership': {
    results: [
      { parliament: 44, chamber: 'Commons', committee: 'FINA', role: 'Chair', name: 'John McKay', party: 'Liberal', province: 'ON', startDate: '2023-01-01' },
      { parliament: 44, chamber: 'Commons', committee: 'FINA', role: 'Vice-Chair', name: 'Adam Chambers', party: 'Conservative', province: 'ON', startDate: '2023-01-01' },
      { parliament: 44, chamber: 'Commons', committee: 'FINA', role: 'Member', name: 'Yvan Baker', party: 'Liberal', province: 'ON', startDate: '2023-01-01' },
      { parliament: 44, chamber: 'Commons', committee: 'FINA', role: 'Member', name: 'Gabriel Ste-Marie', party: 'Bloc Québécois', province: 'QC', startDate: '2023-01-01' },
      { parliament: 44, chamber: 'Commons', committee: 'FINA', role: 'Member', name: 'Jasraj Singh Hallan', party: 'Conservative', province: 'AB', startDate: '2023-01-01' },
      { parliament: 44, chamber: 'Commons', committee: 'OGGO', role: 'Chair', name: 'Iqra Khalid', party: 'Liberal', province: 'ON', startDate: '2023-01-01' },
      { parliament: 44, chamber: 'Commons', committee: 'OGGO', role: 'Vice-Chair', name: 'Garnett Genuis', party: 'Conservative', province: 'AB', startDate: '2023-01-01' },
    ],
  },
  'committees/committee-meetings': {
    results: [
      { committee: 'FINA', meeting: 145, date: '2025-04-15', topic: 'Pre-budget consultations 2025', inCamera: false, witnesses: ['Minister of Finance', 'PBO'], durationMinutes: 120 },
      { committee: 'FINA', meeting: 146, date: '2025-04-17', topic: 'Bank of Canada monetary policy', inCamera: false, witnesses: ['Tiff Macklem, Governor'], durationMinutes: 90 },
      { committee: 'OGGO', meeting: 82, date: '2025-04-14', topic: 'Government procurement modernization', inCamera: false, witnesses: ['PSPC Officials'], durationMinutes: 105 },
      { committee: 'ETHI', meeting: 56, date: '2025-04-16', topic: 'AI and privacy implications', inCamera: false, witnesses: ['OPC Commissioner'], durationMinutes: 95 },
      { committee: 'FORE', meeting: 48, date: '2025-04-18', topic: 'Canada-US trade relations', inCamera: true, witnesses: ['GAC Officials'], durationMinutes: 75 },
    ],
  },
  'committees/committee-reports': {
    results: [
      { committee: 'FINA', reportNumber: 35, title: 'Pre-Budget Consultations 2025', presentedDate: '2025-03-20', parliament: 44, session: 1, pages: 184, recommendations: 42 },
      { committee: 'ETHI', reportNumber: 22, title: 'Privacy and AI: Protecting Canadians in the Digital Age', presentedDate: '2025-02-15', parliament: 44, session: 1, pages: 96, recommendations: 18 },
      { committee: 'OGGO', reportNumber: 18, title: 'Improving Government Procurement', presentedDate: '2025-01-30', parliament: 44, session: 1, pages: 132, recommendations: 28 },
      { committee: 'SOCI', reportNumber: 14, title: 'Affordable Housing in Canada', presentedDate: '2025-03-10', parliament: 44, session: 1, pages: 158, recommendations: 35 },
    ],
  },
  'committees/committee-witnesses': {
    results: [
      { committee: 'FINA', witness: 'Chrystia Freeland', role: 'Minister of Finance', date: '2025-04-15', topic: 'Fall Economic Statement', meeting: 145 },
      { committee: 'FINA', witness: 'Tiff Macklem', role: 'Governor, Bank of Canada', date: '2025-04-17', topic: 'Monetary Policy Report', meeting: 146 },
      { committee: 'ETHI', witness: 'Philippe Dufresne', role: 'Privacy Commissioner', date: '2025-04-16', topic: 'AI and Privacy', meeting: 56 },
      { committee: 'OGGO', witness: 'Bill Matthews', role: 'Deputy Minister, PSPC', date: '2025-04-14', topic: 'Procurement', meeting: 82 },
      { committee: 'SOCI', witness: 'Ahmed Hussen', role: 'Minister of Housing', date: '2025-03-10', topic: 'Housing Strategy', meeting: 40 },
    ],
  },

  // ─── Corporate ──────────────────────────────────────────────────

  'corporate/corporation-profile': {
    results: [
      { businessNumber: '123456789', name: 'Royal Bank of Canada', jurisdiction: 'Canada', incorporationDate: '1869-06-22', status: 'Active', type: 'Public Company', ticker: 'RY', industry: 'Banking', fiscalYearEnd: 'Oct 31' },
      { businessNumber: '987654321', name: 'Shopify Inc.', jurisdiction: 'Canada', incorporationDate: '2004-12-01', status: 'Active', type: 'Public Company', ticker: 'SHOP', industry: 'E-Commerce Software', fiscalYearEnd: 'Dec 31' },
    ],
  },
  'corporate/corporation-filings': {
    results: [
      { businessNumber: '123456789', year: 2024, filingType: 'Annual Return', filedDate: '2024-11-15', status: 'Filed', documentId: 'AR-2024-12345' },
      { businessNumber: '123456789', year: 2024, filingType: 'Financial Statements', filedDate: '2024-11-10', status: 'Filed', documentId: 'FS-2024-12345' },
      { businessNumber: '123456789', year: 2024, filingType: 'Director Change', filedDate: '2024-08-01', status: 'Filed', documentId: 'DC-2024-6789' },
      { businessNumber: '987654321', year: 2024, filingType: 'Annual Return', filedDate: '2025-02-10', status: 'Filed', documentId: 'AR-2025-54321' },
    ],
  },
  'corporate/director-registry': {
    results: [
      { businessNumber: '123456789', directorName: 'David McKay', role: 'Board Chair', appointedDate: '2023-01-01', nationality: 'Canadian', residence: 'ON' },
      { businessNumber: '123456789', directorName: 'Kathryn B., did:', role: 'Independent Director', appointedDate: '2021-06-15', nationality: 'Canadian', residence: 'ON' },
      { businessNumber: '123456789', directorName: 'Jacynthe Côté', role: 'Independent Director', appointedDate: '2022-03-01', nationality: 'Canadian', residence: 'QC' },
      { businessNumber: '987654321', directorName: 'Harley Finkelstein', role: 'President', appointedDate: '2017-06-01', nationality: 'Canadian', residence: 'ON' },
    ],
  },
  'corporate/lobbying-activities': {
    results: [
      { id: 'L-2024-001', registrant: 'Royal Bank of Canada', client: 'RBC', subject: 'Banking Regulation', date: '2024-11-10', type: 'Oral Communication', publicOfficeHolder: 'Minister of Finance' },
      { id: 'L-2024-002', registrant: 'Canadian Bankers Association', client: 'CBA Members', subject: 'Anti-Money Laundering', date: '2024-11-08', type: 'Written Correspondence', publicOfficeHolder: 'Department of Finance' },
      { id: 'L-2024-003', registrant: 'Shopify Inc.', client: 'Shopify', subject: 'Digital Economy', date: '2024-10-25', type: 'Oral Communication', publicOfficeHolder: 'Minister of Innovation' },
    ],
  },

  // ─── Influence ──────────────────────────────────────────────────

  'influence/political-contributions': {
    results: [
      { donor: 'John Smith', party: 'Liberal', year: 2024, amount: 1500, category: 'Individual', riding: 'Toronto Centre' },
      { donor: 'Jane Doe Corp', party: 'Conservative', year: 2024, amount: 5000, category: 'Corporation', riding: 'Calgary Nose Hill' },
      { donor: 'GreenTech Inc.', party: 'Green', year: 2024, amount: 2000, category: 'Corporation', riding: 'Vancouver Granville' },
      { donor: 'CUPE National', party: 'NDP', year: 2024, amount: 75000, category: 'Union', riding: 'Ottawa Centre' },
      { donor: 'Sarah Johnson', party: 'Bloc Québécois', year: 2024, amount: 800, category: 'Individual', riding: 'Laurier-Sainte-Marie' },
    ],
  },
  'influence/fundraising-events': {
    results: [
      { party: 'Liberal', date: '2024-11-20', location: 'Toronto, ON', ticketPrice: 250, host: 'Liberal Party of Canada', attendees: 150 },
      { party: 'Conservative', date: '2024-11-18', location: 'Calgary, AB', ticketPrice: 500, host: 'Conservative Fund Canada', attendees: 200 },
      { party: 'NDP', date: '2024-11-15', location: 'Vancouver, BC', ticketPrice: 100, host: 'NDP', attendees: 300 },
    ],
  },
  'influence/media-ownership': {
    results: [
      { mediaGroup: 'Postmedia Network', outlet: 'National Post', type: 'Newspaper', market: 'National', circulation: 142000, year: 2024 },
      { mediaGroup: 'Postmedia Network', outlet: 'Ottawa Citizen', type: 'Newspaper', market: 'Ottawa', circulation: 35000, year: 2024 },
      { mediaGroup: 'Bell Media', outlet: 'CTV News', type: 'Television', market: 'National', reachMillions: 12.5, year: 2024 },
      { mediaGroup: 'Rogers Communications', outlet: 'CityNews', type: 'Television', market: 'Toronto', reachMillions: 4.2, year: 2024 },
      { mediaGroup: 'Quebecor', outlet: 'Journal de Montréal', type: 'Newspaper', market: 'Montreal', circulation: 185000, year: 2024 },
    ],
  },

  // ─── Regulations ────────────────────────────────────────────────

  'regulations/regulatory-proposals': {
    results: [
      { id: 'GC-2025-001', agency: 'Health Canada', title: 'Amendments to Food and Drug Regulations (Nutrition Symbols)', status: 'Open for Comment', published: '2025-03-15', commentDeadline: '2025-05-15', gazettePart: 'I' },
      { id: 'GC-2025-002', agency: 'Environment Canada', title: 'Clean Fuel Regulations Amendments', status: 'Open for Comment', published: '2025-04-01', commentDeadline: '2025-06-01', gazettePart: 'I' },
      { id: 'GC-2025-003', agency: 'CRTC', title: 'Broadcasting Notice of Consultation 2025-50', status: 'Open for Comment', published: '2025-04-10', commentDeadline: '2025-06-15', gazettePart: 'I' },
      { id: 'GC-2024-180', agency: 'Finance Canada', title: 'Proposed Amendments to the Income Tax Act', status: 'Closed', published: '2024-09-01', commentDeadline: '2024-10-15', gazettePart: 'I' },
    ],
  },
  'regulations/regulatory-decisions': {
    results: [
      { id: 'DEC-2025-01', agency: 'CRTC', title: 'Decision on BCE-CTV Ownership Transfer', decisionType: 'Approved with Conditions', date: '2025-02-28', number: 'CRTC 2025-45' },
      { id: 'DEC-2025-02', agency: 'Canadian Transportation Agency', title: 'Air Passenger Protection Regulations Update', decisionType: 'Amended', date: '2025-01-15', number: 'CTA 2025-12' },
      { id: 'DEC-2024-98', agency: 'Competition Bureau', title: 'Rogers-Shaw Merger Consent Agreement Compliance', decisionType: 'Monitoring', date: '2024-12-01', number: 'CT-2024-003' },
    ],
  },
  'regulations/consultation-comments': {
    results: [
      { proposalId: 'GC-2025-001', commenter: 'Canadian Medical Association', date: '2025-04-10', position: 'Support with recommendations', summary: 'Supports front-of-package nutrition labeling but recommends phased implementation for small businesses' },
      { proposalId: 'GC-2025-001', commenter: 'Food and Consumer Products of Canada', date: '2025-04-12', position: 'Opposed', summary: 'Concerned about compliance costs and international trade implications' },
      { proposalId: 'GC-2025-002', commenter: 'Canadian Association of Petroleum Producers', date: '2025-04-20', position: 'Opposed', summary: 'Argues targets are unattainable given current technology' },
    ],
  },

  // ─── Courts ────────────────────────────────────────────────────

  'courts/court-decisions': {
    results: [
      { caseName: 'R. v. Brown', court: 'Supreme Court of Canada', date: '2025-03-15', citation: '2025 SCC 12', type: 'Criminal', keywords: ['Charter', 's. 8', 'search and seizure'], majority: '7-0' },
      { caseName: 'Reference re Greenhouse Gas Pollution Pricing Act', court: 'Supreme Court of Canada', date: '2024-11-10', citation: '2024 SCC 40', type: 'Constitutional', keywords: ['federal jurisdiction', 'environment'], majority: '6-3' },
      { caseName: 'Canada (AG) v. Fontaine', court: 'Federal Court of Appeal', date: '2025-02-20', citation: '2025 FCA 45', type: 'Administrative', keywords: ['Indigenous', 'residential schools', 'records'], majority: '3-0' },
    ],
  },
  'courts/case-tracking': {
    results: [
      { caseNumber: 'C-45678', court: 'Supreme Court of Canada', title: 'Reference re Online Streaming Act', status: 'Pending Hearing', filed: '2025-01-20', nextHearing: '2025-06-15' },
      { caseNumber: 'C-45679', court: 'Federal Court', title: 'Smith v. Canada (Attorney General)', status: 'Discovery', filed: '2024-08-15', nextHearing: '2025-05-30' },
      { caseNumber: 'C-45680', court: 'Ontario Superior Court', title: 'R. v. Patel', status: 'Trial in Progress', filed: '2024-03-01', nextHearing: '2025-05-22' },
    ],
  },
  'courts/tribunal-rulings': {
    results: [
      { tribunal: 'Immigration and Refugee Board (IRB)', caseNumber: 'TB5-12345', type: 'Refugee Protection', date: '2025-04-10', outcome: 'Accepted', grounds: 'Particular social group', countryOfOrigin: 'Nigeria' },
      { tribunal: 'Canadian Human Rights Tribunal', caseNumber: 'HRT-2024-001', type: 'Discrimination', date: '2025-03-28', outcome: 'Upheld', grounds: 'Disability' },
      { tribunal: 'Competition Tribunal', caseNumber: 'CT-2024-005', type: 'Merger Review', date: '2025-02-15', outcome: 'Approved', industry: 'Telecommunications' },
    ],
  },

  // ─── Oversight ──────────────────────────────────────────────────

  'oversight/auditor-reports': {
    results: [
      { agency: 'Office of the Auditor General', title: 'Report on Indigenous Services Canada — Child and Family Services', year: 2025, type: 'Performance Audit', datePublished: '2025-04-01', pages: 72, paragraphCount: 185 },
      { agency: 'Office of the Auditor General', title: 'Report on Canada Revenue Agency — Tax Avoidance', year: 2025, type: 'Performance Audit', datePublished: '2025-03-15', pages: 88, paragraphCount: 210 },
      { agency: 'Office of the Auditor General', title: 'Report on Climate Adaptation Funding', year: 2024, type: 'Performance Audit', datePublished: '2024-11-20', pages: 64, paragraphCount: 150 },
    ],
  },
  'oversight/watchdog-reports': {
    results: [
      { office: 'Office of the Privacy Commissioner', title: '2024 Annual Report on PIPEDA Compliance', year: 2024, type: 'Annual Report', datePublished: '2025-03-01', keyFinding: 'Complaints increased 22% year-over-year, driven by AI-related concerns' },
      { office: 'Commissioner of Lobbying', title: 'Report on Investigations 2024', year: 2024, type: 'Investigation Report', datePublished: '2025-02-15', keyFinding: 'Three administrative monetary penalties issued for non-compliance' },
      { office: 'Parliamentary Budget Officer', title: 'Fiscal Sustainability Report 2025', year: 2025, type: 'Analysis', datePublished: '2025-04-05', keyFinding: 'Federal debt-to-GDP ratio projected to stabilize at 42% by 2030' },
    ],
  },
  'oversight/access-to-information': {
    results: [
      { institution: 'RCMP', year: 2024, requestsReceived: 4250, requestsCompleted: 3950, completionRate: 0.93, averageDays: 45, pagesReleased: 125000 },
      { institution: 'Department of National Defence', year: 2024, requestsReceived: 2100, requestsCompleted: 1950, completionRate: 0.93, averageDays: 52, pagesReleased: 78000 },
      { institution: 'Health Canada', year: 2024, requestsReceived: 3800, requestsCompleted: 3600, completionRate: 0.95, averageDays: 38, pagesReleased: 95000 },
      { institution: 'Global Affairs Canada', year: 2024, requestsReceived: 2800, requestsCompleted: 2600, completionRate: 0.93, averageDays: 50, pagesReleased: 88000 },
    ],
  },
  'oversight/conflict-of-interest': {
    results: [
      { publicOfficeHolder: 'Justin Trudeau', role: 'Prime Minister', year: 2024, finding: 'No violation', matter: 'WE Charity review (closed)', commissioner: 'Mario Dion' },
      { publicOfficeHolder: 'Bill Morneau', role: 'Former Minister of Finance', year: 2024, finding: 'Violation — failure to recuse', matter: 'WE Charity', commissioner: 'Mario Dion', penalty: 'Contempt of Parliament finding' },
      { publicOfficeHolder: 'Maryam Monsef', role: 'Former Minister', year: 2023, finding: 'No violation', matter: 'Charity donations', commissioner: 'Mario Dion' },
    ],
  },

  // ─── Data ────────────────────────────────────────────────────────

  'data/government-spending': {
    results: [
      { department: 'Health Canada', year: 2024, category: 'Operating', amount: 3400000000, fiscalYear: '2024-2025' },
      { department: 'Health Canada', year: 2024, category: 'Transfers', amount: 12000000000, fiscalYear: '2024-2025' },
      { department: 'Department of National Defence', year: 2024, category: 'Operating', amount: 18000000000, fiscalYear: '2024-2025' },
      { department: 'Department of National Defence', year: 2024, category: 'Capital', amount: 6500000000, fiscalYear: '2024-2025' },
      { department: 'Employment and Social Development', year: 2024, category: 'Transfers', amount: 65000000000, fiscalYear: '2024-2025' },
    ],
  },
  'data/election-results': {
    results: [
      { year: 2021, type: 'Federal', party: 'Liberal', seats: 160, popularVote: 32.6, turnout: 62.3 },
      { year: 2021, type: 'Federal', party: 'Conservative', seats: 119, popularVote: 33.7, turnout: 62.3 },
      { year: 2021, type: 'Federal', party: 'Bloc Québécois', seats: 32, popularVote: 7.6, turnout: 62.3 },
      { year: 2021, type: 'Federal', party: 'NDP', seats: 25, popularVote: 17.8, turnout: 62.3 },
      { year: 2021, type: 'Federal', party: 'Green', seats: 2, popularVote: 2.3, turnout: 62.3 },
      { year: 2019, type: 'Federal', party: 'Liberal', seats: 157, popularVote: 33.1, turnout: 67.0 },
    ],
  },
  'data/population-statistics': {
    results: [
      { region: 'Ontario', year: 2025, population: 15800000, demographic: 'Total', source: 'StatsCan Q1 2025' },
      { region: 'Quebec', year: 2025, population: 8900000, demographic: 'Total', source: 'StatsCan Q1 2025' },
      { region: 'British Columbia', year: 2025, population: 5400000, demographic: 'Total', source: 'StatsCan Q1 2025' },
      { region: 'Alberta', year: 2025, population: 4800000, demographic: 'Total', source: 'StatsCan Q1 2025' },
      { region: 'Canada', year: 2025, population: 40700000, demographic: 'Total', source: 'StatsCan Q1 2025' },
      { region: 'Canada', year: 2025, population: 13500000, demographic: 'Age 0-14', source: 'StatsCan Q1 2025' },
    ],
  },
  'data/public-salary-disclosure': {
    results: [
      { employer: 'Ontario Power Generation', year: 2023, name: 'Kenneth Hartwick', position: 'President and CEO', salary: 1725000, taxableBenefits: 85000 },
      { employer: 'Sunnybrook Health Sciences Centre', year: 2023, name: 'Dr. Andy Smith', position: 'CEO', salary: 850000, taxableBenefits: 42000 },
      { employer: 'University of Toronto', year: 2023, name: 'Meric Gertler', position: 'President', salary: 725000, taxableBenefits: 35000 },
      { employer: 'City of Toronto', year: 2023, name: 'Olivia Chow', position: 'Mayor', salary: 212000, taxableBenefits: 5000 },
    ],
  },

  // ─── Immigration ────────────────────────────────────────────────

  'immigration/permanent-residents': {
    results: [
      { year: 2025, month: 1, category: 'Economic', province: 'ON', admissions: 14500, genderDistribution: { male: 48, female: 52 } },
      { year: 2025, month: 1, category: 'Family', province: 'BC', admissions: 3200, genderDistribution: { male: 45, female: 55 } },
      { year: 2025, month: 1, category: 'Refugee', province: 'AB', admissions: 1800, genderDistribution: { male: 52, female: 48 } },
      { year: 2025, month: 1, category: 'Economic', province: 'QC', admissions: 6200, genderDistribution: { male: 49, female: 51 } },
      { year: 2025, month: 2, category: 'Economic', province: 'ON', admissions: 13800, genderDistribution: { male: 48, female: 52 } },
    ],
  },
  'immigration/study-permits': {
    results: [
      { year: 2025, quarter: 1, country: 'India', permitHolders: 125000, institutionType: 'University', genderDistribution: { male: 42, female: 58 } },
      { year: 2025, quarter: 1, country: 'China', permitHolders: 52000, institutionType: 'University', genderDistribution: { male: 48, female: 52 } },
      { year: 2025, quarter: 1, country: 'Philippines', permitHolders: 18500, institutionType: 'College', genderDistribution: { male: 38, female: 62 } },
      { year: 2025, quarter: 1, country: 'France', permitHolders: 14500, institutionType: 'University', genderDistribution: { male: 46, female: 54 } },
      { year: 2025, quarter: 1, country: 'Nigeria', permitHolders: 12800, institutionType: 'College', genderDistribution: { male: 55, female: 45 } },
    ],
  },
  'immigration/work-permits': {
    results: [
      { year: 2025, quarter: 1, program: 'TFWP', stream: 'Agricultural', permitsIssued: 12500, province: 'ON', skillLevel: 'Low-skilled' },
      { year: 2025, quarter: 1, program: 'TFWP', stream: 'Caregiver', permitsIssued: 4500, province: 'BC', skillLevel: 'Semi-skilled' },
      { year: 2025, quarter: 1, program: 'IMP', stream: 'PGWP', permitsIssued: 42000, province: 'ON', skillLevel: 'High-skilled' },
      { year: 2025, quarter: 1, program: 'IMP', stream: 'Global Talent', permitsIssued: 8400, province: 'BC', skillLevel: 'High-skilled' },
      { year: 2025, quarter: 1, program: 'IMP', stream: 'CUSMA', permitsIssued: 3500, province: 'ON', skillLevel: 'High-skilled' },
    ],
  },
  'immigration/refugee-decisions': {
    results: [
      { year: 2025, quarter: 1, country: 'Nigeria', claimsFiled: 2450, accepted: 850, rejected: 1200, abandoned: 400, acceptanceRate: 0.35 },
      { year: 2025, quarter: 1, country: 'Mexico', claimsFiled: 3200, accepted: 600, rejected: 2100, abandoned: 500, acceptanceRate: 0.19 },
      { year: 2025, quarter: 1, country: 'Afghanistan', claimsFiled: 980, accepted: 720, rejected: 150, abandoned: 110, acceptanceRate: 0.73 },
      { year: 2025, quarter: 1, country: 'Colombia', claimsFiled: 850, accepted: 320, rejected: 430, abandoned: 100, acceptanceRate: 0.38 },
    ],
  },
  'immigration/cbsa-enforcement': {
    results: [
      { year: 2025, quarter: 1, type: 'Removals', count: 2850, topCountry: 'Mexico', enforcementRegion: 'Ontario Region' },
      { year: 2025, quarter: 1, type: 'Detentions', count: 420, averageDays: 12, enforcementRegion: 'Quebec Region' },
      { year: 2025, quarter: 1, type: 'Inadmissibility Reports', count: 5100, enforcementRegion: 'National' },
      { year: 2025, quarter: 1, type: 'Port of Entry Exam', count: 32000, enforcementRegion: 'All Regions' },
    ],
  },

  // ─── Indigenous Relations ─────────────────────────────────────

  'indigenous/land-claims': {
    results: [
      { claimNumber: 'SC-2020-045', community: 'Beardy\'s and Okemasis Cree Nation', province: 'SK', type: 'Specific Claim', status: 'Settled', settlementAmount: 125000000, settledDate: '2024-06-15' },
      { claimNumber: 'SC-2021-120', community: 'Tsuut\'ina Nation', province: 'AB', type: 'Specific Claim', status: 'Negotiation', settlementAmount: null, settledDate: null },
      { claimNumber: 'CL-2018-001', community: 'Council of Yukon First Nations', province: 'YT', type: 'Comprehensive Land Claim', status: 'In Progress', settlementAmount: null, settledDate: null },
      { claimNumber: 'SC-2022-033', community: 'Huron-Wendat Nation', province: 'QC', type: 'Specific Claim', status: 'Submitted', settlementAmount: null, settledDate: null },
    ],
  },
  'indigenous/isc-spending': {
    results: [
      { program: 'Health Services', province: 'ON', year: 2024, amount: 1250000000, beneficiaries: 250000 },
      { program: 'Elementary and Secondary Education', province: 'MB', year: 2024, amount: 680000000, beneficiaries: 85000 },
      { program: 'Infrastructure and Housing', province: 'AB', year: 2024, amount: 420000000, beneficiaries: 60000 },
      { program: 'Social Development', province: 'SK', year: 2024, amount: 350000000, beneficiaries: 55000 },
    ],
  },
  'indigenous/fn-transparency': {
    results: [
      { year: 2024, firstNation: 'Cowichan Tribes', province: 'BC', chiefSalary: 120000, totalCouncilCompensation: 520000, communityBudget: 45000000, auditOpinion: 'Unmodified' },
      { year: 2024, firstNation: 'Mistawasis Nêhiyawak', province: 'SK', chiefSalary: 95000, totalCouncilCompensation: 380000, communityBudget: 28000000, auditOpinion: 'Unmodified' },
      { year: 2024, firstNation: 'Kitigan Zibi Anishinabeg', province: 'QC', chiefSalary: 108000, totalCouncilCompensation: 420000, communityBudget: 32000000, auditOpinion: 'Modified' },
    ],
  },
  'indigenous/trc-progress': {
    results: [
      { callNumber: 1, title: 'Child welfare — reduce overrepresentation', status: 'In Progress', lead: 'Federal Government', deadline: 'Ongoing', progress: 'Legislative amendments underway' },
      { callNumber: 10, title: 'Education — Closing gaps', status: 'In Progress', lead: 'Federal Government', deadline: '2030', progress: 'Funding increases implemented' },
      { callNumber: 45, title: 'National Council for Reconciliation', status: 'Completed', lead: 'Federal Government', deadline: '2024', progress: 'Legislation passed 2024' },
      { callNumber: 72, title: 'Missing children and burial information', status: 'In Progress', lead: 'National Centre for Truth and Reconciliation', deadline: 'Ongoing', progress: 'Ongoing research and documentation' },
    ],
  },

  // ─── Criminal Justice ───────────────────────────────────────────

  'criminal-justice/corrections-population': {
    results: [
      { year: 2025, quarter: 1, type: 'Federal Custody', population: 12750, capacity: 15500, occupancyRate: 0.82, costPerInmateAnnual: 120000 },
      { year: 2025, quarter: 1, type: 'Provincial Custody', population: 21500, province: 'ON', costPerInmateAnnual: 85000 },
      { year: 2025, quarter: 1, type: 'Provincial Custody', population: 9200, province: 'QC', costPerInmateAnnual: 78000 },
      { year: 2025, quarter: 1, type: 'Federal Custody', demographic: 'Indigenous', proportion: 0.32, population: 4080 },
    ],
  },
  'criminal-justice/parole-decisions': {
    results: [
      { year: 2025, quarter: 1, outcome: 'Granted', count: 1850, type: 'Day Parole', grantRate: 0.68, averageHearingDuration: 45 },
      { year: 2025, quarter: 1, outcome: 'Granted', count: 1200, type: 'Full Parole', grantRate: 0.42, averageHearingDuration: 52 },
      { year: 2025, quarter: 1, outcome: 'Denied', count: 1450, totalApplications: 4500, type: 'All' },
    ],
  },
  'criminal-justice/rcmp-crime-stats': {
    results: [
      { year: 2024, violation: 'Homicide', totalIncidents: 778, ratePer100k: 2.0, solvedRate: 0.78 },
      { year: 2024, violation: 'Sexual Assault', totalIncidents: 34500, ratePer100k: 88.0, solvedRate: 0.52 },
      { year: 2024, violation: 'Breaking and Entering', totalIncidents: 135000, ratePer100k: 345.0, solvedRate: 0.22 },
      { year: 2024, violation: 'Fraud', totalIncidents: 152000, ratePer100k: 388.0, solvedRate: 0.14 },
      { year: 2024, violation: 'Hate Crime', totalIncidents: 3200, ratePer100k: 8.2, solvedRate: 0.42 },
    ],
  },
  'criminal-justice/prosecutions': {
    results: [
      { year: 2024, province: 'ON', caseloadTotal: 125000, completed: 112000, stayRate: 0.08, convictionRate: 0.75 },
      { year: 2024, province: 'QC', caseloadTotal: 85000, completed: 78000, stayRate: 0.06, convictionRate: 0.78 },
      { year: 2024, province: 'BC', caseloadTotal: 62000, completed: 58000, stayRate: 0.09, convictionRate: 0.72 },
      { year: 2024, province: 'AB', caseloadTotal: 48000, completed: 44000, stayRate: 0.10, convictionRate: 0.70 },
    ],
  },

  // ─── Defence ──────────────────────────────────────────────────────

  'defence/personnel': {
    results: [
      { year: 2025, rank: 'General/Flag Officer', count: 78, component: 'Regular Force', trade: 'All', genderDistribution: { male: 88, female: 12 } },
      { year: 2025, rank: 'Officer', count: 14200, component: 'Regular Force', trade: 'All', genderDistribution: { male: 82, female: 18 } },
      { year: 2025, rank: 'Non-Commissioned Member', count: 51500, component: 'Regular Force', trade: 'All', genderDistribution: { male: 85, female: 15 } },
      { year: 2025, rank: 'All Ranks', count: 26500, component: 'Reserve Force', trade: 'All', genderDistribution: { male: 83, female: 17 } },
      { year: 2025, rank: 'All Ranks', count: 1800, component: 'Canadian Rangers', trade: 'All' },
    ],
  },
  'defence/procurement': {
    results: [
      { year: 2025, projectName: 'Canadian Surface Combatant', vendor: 'Irving Shipbuilding Inc.', value: 60000000000, phase: 'Implementation', contractAward: '2019-02-08', expectedDelivery: '2034' },
      { year: 2025, projectName: 'Future Fighter Capability (F-35)', vendor: 'Lockheed Martin', value: 19000000000, phase: 'Negotiation', contractAward: '2023-01-09', expectedDelivery: '2028' },
      { year: 2025, projectName: 'Arctic and Offshore Patrol Ships (AOPS)', vendor: 'Irving Shipbuilding Inc.', value: 4300000000, phase: 'Delivery', contractAward: '2015-01-16', expectedDelivery: '2026' },
      { year: 2025, projectName: 'CC-295 Search and Rescue Aircraft', vendor: 'Airbus Defence and Space', value: 2400000000, phase: 'Delivery', contractAward: '2019-08-02', expectedDelivery: '2027' },
    ],
  },

  // ─── Municipal ─────────────────────────────────────────────────

  'municipal/meetings': {
    results: [
      { city: 'Toronto', date: '2025-04-16', type: 'City Council', agendaItems: 18, durationMinutes: 245, decisions: { approved: 14, deferred: 3, defeated: 1 } },
      { city: 'Vancouver', date: '2025-04-15', type: 'City Council', agendaItems: 12, durationMinutes: 180, decisions: { approved: 10, deferred: 2, defeated: 0 } },
      { city: 'Ottawa', date: '2025-04-14', type: 'Transportation Committee', agendaItems: 8, durationMinutes: 120, decisions: { approved: 6, deferred: 1, defeated: 1 } },
      { city: 'Montreal', date: '2025-04-17', type: 'Executive Committee', agendaItems: 15, durationMinutes: 160, decisions: { approved: 12, deferred: 2, defeated: 1 } },
    ],
  },
  'municipal/budgets': {
    results: [
      { city: 'Toronto', year: 2025, operatingBudget: 17000000000, capitalBudget: 43000000000, propertyTaxRateChange: 0.095, majorCategory: 'Transit' },
      { city: 'Vancouver', year: 2025, operatingBudget: 8000000000, capitalBudget: 18000000000, propertyTaxRateChange: 0.072, majorCategory: 'Housing' },
      { city: 'Ottawa', year: 2025, operatingBudget: 4500000000, capitalBudget: 12000000000, propertyTaxRateChange: 0.053, majorCategory: 'Infrastructure' },
      { city: 'Montreal', year: 2025, operatingBudget: 7200000000, capitalBudget: 16000000000, propertyTaxRateChange: 0.048, majorCategory: 'Public Transit' },
    ],
  },
  'municipal/open-data': {
    results: [
      { city: 'Ottawa', dataset: 'Council Votes', url: 'https://data.ottawa.ca/dataset/council-votes', records: 45000, lastUpdated: '2025-04-10', format: 'CSV' },
      { city: 'Toronto', dataset: 'TTCOmbudsmanComplaints', url: 'https://open.toronto.ca/dataset/ttc-ombudsman-complaints/', records: 8200, lastUpdated: '2025-03-15', format: 'CSV' },
      { city: 'Vancouver', dataset: 'Property Tax Reports', url: 'https://opendata.vancouver.ca/', records: 156000, lastUpdated: '2025-04-01', format: 'CSV' },
      { city: 'Calgary', dataset: 'Permit Approvals', url: 'https://data.calgary.ca/', records: 22500, lastUpdated: '2025-04-05', format: 'API' },
    ],
  },

  // ─── Transport ─────────────────────────────────────────────────

  'transport/tsb-occurrences': {
    results: [
      { mode: 'Aviation', year: 2025, quarter: 1, occurrences: 225, fatalities: 3, seriousInjuries: 8, mostCommonEvent: 'Collision with terrain' },
      { mode: 'Rail', year: 2025, quarter: 1, occurrences: 180, fatalities: 2, seriousInjuries: 5, mostCommonEvent: 'Main track derailment' },
      { mode: 'Marine', year: 2025, quarter: 1, occurrences: 95, fatalities: 1, seriousInjuries: 3, mostCommonEvent: 'Collision' },
      { mode: 'Pipeline', year: 2025, quarter: 1, occurrences: 22, fatalities: 0, seriousInjuries: 0, mostCommonEvent: 'Release of product' },
    ],
  },
  'transport/tc-recalls': {
    results: [
      { year: 2025, quarter: 1, make: 'Toyota', type: 'Vehicle', unitsAffected: 285000, defect: 'Fuel pump failure', dateIssued: '2025-02-15' },
      { year: 2025, quarter: 1, make: 'Ford', type: 'Vehicle', unitsAffected: 152000, defect: 'Brake line corrosion', dateIssued: '2025-03-01' },
      { year: 2025, quarter: 1, make: 'Honda', type: 'Vehicle', unitsAffected: 95000, defect: 'Airbag inflator', dateIssued: '2025-01-20' },
      { year: 2025, quarter: 1, make: 'Stellantis', type: 'Vehicle', unitsAffected: 72000, defect: 'Transmission software', dateIssued: '2025-03-10' },
    ],
  },
  'transport/cta-rulings': {
    results: [
      { caseNumber: 'CTA-2025-001', year: 2025, type: 'Air Travel Complaint', issue: 'Flight delay compensation', ruling: 'Upheld', compensationAwarded: 1000, airline: 'Air Canada' },
      { caseNumber: 'CTA-2025-002', year: 2025, type: 'Air Travel Complaint', issue: 'Lost baggage', ruling: 'Upheld in part', compensationAwarded: 800, airline: 'WestJet' },
      { caseNumber: 'CTA-2025-003', year: 2025, type: 'Rail Level of Service', issue: 'Service frequency', ruling: 'Dismissed', compensationAwarded: 0, railOperator: 'VIA Rail' },
    ],
  },

  // ─── Real-Time Feeds ────────────────────────────────────────────

  'realtime/weather-alerts': {
    results: [
      { region: 'Southern Ontario', severity: 'Warning', type: 'Thunderstorm', issued: '2025-04-18T14:30:00Z', expires: '2025-04-18T18:00:00Z', headline: 'Severe thunderstorm warning — damaging winds and large hail' },
      { region: 'Montreal Area', severity: 'Watch', type: 'Heat', issued: '2025-04-18T10:00:00Z', expires: '2025-04-20T20:00:00Z', headline: 'Heat warning continues — humidex values above 40' },
      { region: 'Yukon', severity: 'Warning', type: 'Snowfall', issued: '2025-04-18T06:00:00Z', expires: '2025-04-19T06:00:00Z', headline: 'Blizzard warning — heavy snow and near-zero visibility' },
    ],
  },
  'realtime/border-waits': {
    results: [
      { port: 'Windsor-Detroit Tunnel', province: 'ON', direction: 'Canada-bound', currentWaitMinutes: 15, updatedAt: '2025-04-18T15:00:00Z', laneType: 'Standard' },
      { port: 'Ambassador Bridge', province: 'ON', direction: 'US-bound', currentWaitMinutes: 45, updatedAt: '2025-04-18T15:00:00Z', laneType: 'Standard' },
      { port: 'Peace Bridge (Fort Erie)', province: 'ON', direction: 'Canada-bound', currentWaitMinutes: 10, updatedAt: '2025-04-18T15:00:00Z', laneType: 'Nexus' },
      { port: 'Pacific Highway (Surrey)', province: 'BC', direction: 'US-bound', currentWaitMinutes: 25, updatedAt: '2025-04-18T15:00:00Z', laneType: 'Standard' },
    ],
  },
  'realtime/parole-registry': {
    results: [
      { year: 2025, month: 4, decisionNumber: 'PB-2025-0421', offenderInitials: 'J.M.', date: '2025-04-15', outcome: 'Day Parole Granted', type: 'Non-Violent' },
      { year: 2025, month: 4, decisionNumber: 'PB-2025-0422', offenderInitials: 'R.T.', date: '2025-04-15', outcome: 'Full Parole Denied', type: 'Violent' },
      { year: 2025, month: 4, decisionNumber: 'PB-2025-0423', offenderInitials: 'L.S.', date: '2025-04-14', outcome: 'Detention Review — Continued Detention', type: 'Serious Violent' },
    ],
  },

  // ─── Media & Broadcasting ──────────────────────────────────────

  'media/crtc-market-reports': {
    results: [
      { year: 2024, sector: 'Broadcasting', metric: 'Total revenue (TV)', value: 5500000000, unit: 'CAD', change: -0.03 },
      { year: 2024, sector: 'Broadcasting', metric: 'Total revenue (Radio)', value: 1500000000, unit: 'CAD', change: -0.05 },
      { year: 2024, sector: 'Telecom', metric: 'Total revenue (Wireless)', value: 28000000000, unit: 'CAD', change: 0.04 },
      { year: 2024, sector: 'Telecom', metric: 'Total revenue (Wireline)', value: 18000000000, unit: 'CAD', change: -0.02 },
      { year: 2024, sector: 'Internet', metric: 'Total revenue', value: 14500000000, unit: 'CAD', change: 0.06 },
    ],
  },
  'media/ownership-charts': {
    results: [
      { year: 2024, sector: 'Television', group: 'Bell Media', marketShare: 35.2, outlets: ['CTV', 'CTV2', 'BNN Bloomberg', 'TSN'] },
      { year: 2024, sector: 'Television', group: 'Rogers Sports & Media', marketShare: 22.8, outlets: ['Citytv', 'Sportsnet', 'OMNI'] },
      { year: 2024, sector: 'Television', group: 'CBC/Radio-Canada', marketShare: 15.5, outlets: ['CBC Television', 'Ici Radio-Canada'] },
      { year: 2024, sector: 'Radio', group: 'Bell Media Radio', marketShare: 18.5, outlets: ['CHUM FM', 'Virgin Radio', 'TSN Radio'] },
      { year: 2024, sector: 'Radio', group: 'Rogers Radio', marketShare: 12.2, outlets: ['Sportsnet 590', 'KISS Radio'] },
    ],
  },
  'media/cmf-data': {
    results: [
      { year: 2025, program: 'Convergent Stream', applicant: 'Sienna Films', projectName: 'Northern Borders', amountAwarded: 850000, genre: 'Drama', platform: 'Television' },
      { year: 2025, program: 'Experimental Stream', applicant: 'Secret Location', projectName: 'VR Indigenous Experience', amountAwarded: 350000, genre: 'Interactive', platform: 'Digital' },
      { year: 2025, program: 'Marketing Stream', applicant: 'CBC', projectName: 'The Passionate Eye', amountAwarded: 200000, genre: 'Documentary', platform: 'Television' },
    ],
  },

  // ─── Education Research ─────────────────────────────────────────

  'education/tri-council-grants': {
    results: [
      { agency: 'NSERC', year: 2024, institution: 'University of Toronto', programs: 'Discovery Grants', amount: 45000000, investigatorCount: 280 },
      { agency: 'CIHR', year: 2024, institution: 'McGill University', programs: 'Project Grants', amount: 38000000, investigatorCount: 195 },
      { agency: 'SSHRC', year: 2024, institution: 'University of British Columbia', programs: 'Insight Grants', amount: 12000000, investigatorCount: 85 },
      { agency: 'NSERC', year: 2024, institution: 'University of Waterloo', programs: 'CREATE', amount: 8500000, investigatorCount: 42 },
    ],
  },
  'education/research-chairs': {
    results: [
      { institution: 'University of Toronto', tier: 1, chairs: 85, field: 'All' },
      { institution: 'University of British Columbia', tier: 1, chairs: 62, field: 'All' },
      { institution: 'McGill University', tier: 1, chairs: 55, field: 'All' },
      { institution: 'University of Alberta', tier: 1, chairs: 42, field: 'All' },
      { institution: 'University of Waterloo', tier: 1, chairs: 38, field: 'All' },
    ],
  },
  'education/student-loans': {
    results: [
      { year: 2024, province: 'ON', totalRecipients: 425000, averageLoan: 13000, totalDisbursed: 5500000000, cumulativeDefaultRate: 0.085 },
      { year: 2024, province: 'QC', totalRecipients: 185000, averageLoan: 9500, totalDisbursed: 1750000000, cumulativeDefaultRate: 0.065 },
      { year: 2024, province: 'BC', totalRecipients: 135000, averageLoan: 11000, totalDisbursed: 1480000000, cumulativeDefaultRate: 0.072 },
      { year: 2024, province: 'AB', totalRecipients: 110000, averageLoan: 11500, totalDisbursed: 1260000000, cumulativeDefaultRate: 0.078 },
    ],
  },
  'education/cudo-data': {
    results: [
      { year: 2024, institution: 'University of Toronto', metric: 'Full-time Enrolment', value: 62000, unit: 'Students' },
      { year: 2024, institution: 'University of Toronto', metric: 'Research Funding', value: 1350000000, unit: 'CAD' },
      { year: 2024, institution: 'York University', metric: 'Full-time Enrolment', value: 42000, unit: 'Students' },
      { year: 2024, institution: 'University of Waterloo', metric: 'Co-op Placements', value: 22000, unit: 'Students' },
      { year: 2024, institution: 'Queen\'s University', metric: 'Full-time Enrolment', value: 25000, unit: 'Students' },
    ],
  },

  // ─── Social Programs ──────────────────────────────────────────

  'social-programs/ccb-data': {
    results: [
      { year: 2025, month: 1, riding: 'Toronto Centre', province: 'ON', families: 28500, averagePayment: 580, totalPaid: 16530000 },
      { year: 2025, month: 1, riding: 'Vancouver Granville', province: 'BC', families: 18200, averagePayment: 520, totalPaid: 9464000 },
      { year: 2025, month: 1, riding: 'Edmonton Strathcona', province: 'AB', families: 16500, averagePayment: 550, totalPaid: 9075000 },
      { year: 2025, month: 1, riding: 'Hull—Aylmer', province: 'QC', families: 14500, averagePayment: 560, totalPaid: 8120000 },
    ],
  },
  'social-programs/cpp-oas': {
    results: [
      { program: 'CPP', year: 2025, beneficiaries: 6400000, averageMonthlyBenefit: 816, totalAnnualExpenditure: 62600000000, province: 'Canada' },
      { program: 'OAS', year: 2025, beneficiaries: 7200000, averageMonthlyBenefit: 718, totalAnnualExpenditure: 62000000000, province: 'Canada' },
      { program: 'GIS', year: 2025, beneficiaries: 2100000, averageMonthlyBenefit: 520, totalAnnualExpenditure: 13100000000, province: 'Canada' },
    ],
  },
  'social-programs/ei-statistics': {
    results: [
      { year: 2025, month: 2, province: 'ON', claimsReceived: 125000, regularBeneficiaries: 85000, averageWeeklyBenefit: 520, unemploymentRate: 5.8 },
      { year: 2025, month: 2, province: 'QC', claimsReceived: 82000, regularBeneficiaries: 55000, averageWeeklyBenefit: 510, unemploymentRate: 4.9 },
      { year: 2025, month: 2, province: 'BC', claimsReceived: 45000, regularBeneficiaries: 31000, averageWeeklyBenefit: 505, unemploymentRate: 5.2 },
      { year: 2025, month: 2, province: 'AB', claimsReceived: 38000, regularBeneficiaries: 26000, averageWeeklyBenefit: 530, unemploymentRate: 6.1 },
    ],
  },
  'social-programs/poverty-data': {
    results: [
      { year: 2024, measure: 'LICO-AT', province: 'ON', povertyRate: 8.5, populationInPoverty: 1245000 },
      { year: 2024, measure: 'LIM-AT', province: 'ON', povertyRate: 12.8, populationInPoverty: 1875000 },
      { year: 2024, measure: 'MBM', province: 'ON', povertyRate: 9.2, populationInPoverty: 1350000 },
      { year: 2024, measure: 'LICO-AT', province: 'Canada', povertyRate: 8.2, populationInPoverty: 3250000 },
      { year: 2024, measure: 'MBM', province: 'Canada', povertyRate: 9.9, populationInPoverty: 3950000 },
    ],
  },

  // ─── Bank of Canada ──────────────────────────────────────────

  'bank-of-canada/rate-decisions': {
    results: [
      { date: '2025-04-16', overnightRate: 2.75, rateChange: 0.25, decision: 'Increase', bias: 'Data-dependent', voteSplit: { for: 6, against: 0 } },
      { date: '2025-03-05', overnightRate: 2.50, rateChange: 0.0, decision: 'Hold', bias: 'Cautious', voteSplit: { for: 5, against: 1 } },
      { date: '2025-01-22', overnightRate: 2.50, rateChange: -0.25, decision: 'Decrease', bias: 'Further cuts possible', voteSplit: { for: 6, against: 0 } },
      { date: '2024-12-11', overnightRate: 2.75, rateChange: -0.50, decision: 'Decrease', bias: 'Growth concerns dominate', voteSplit: { for: 6, against: 0 } },
    ],
  },
  'bank-of-canada/monetary-policy': {
    results: [
      { year: 2025, report: 'Monetary Policy Report — April 2025', published: '2025-04-16', gdpForecast2025: 1.5, gdpForecast2026: 2.2, inflationForecast2025: 2.2, keyMessage: 'Inflation moderating, economy absorbing slack' },
      { year: 2025, report: 'Monetary Policy Report — January 2025', published: '2025-01-22', gdpForecast2025: 1.3, gdpForecast2026: 2.5, inflationForecast2025: 2.4, keyMessage: 'Rate cuts supporting recovery' },
    ],
  },

  // ─── SEDI / Insider Trading ─────────────────────────────────

  'sedi/insider-transactions': {
    results: [
      { issuer: 'Royal Bank of Canada (RY)', insiderName: 'David McKay', role: 'CEO', transactionType: 'Disposition', transactionDate: '2025-04-01', sharesTraded: 15000, price: 172.50, value: 2587500, filingDate: '2025-04-03' },
      { issuer: 'Shopify Inc. (SHOP)', insiderName: 'Harley Finkelstein', role: 'President', transactionType: 'Acquisition', transactionDate: '2025-03-15', sharesTraded: 5000, options: true, filingDate: '2025-03-17' },
      { issuer: 'Brookfield Asset Management (BAM)', insiderName: 'Bruce Flatt', role: 'CEO', transactionType: 'Acquisition', transactionDate: '2025-04-10', sharesTraded: 25000, price: 68.75, value: 1718750, filingDate: '2025-04-14' },
    ],
  },

  // ─── Unions ─────────────────────────────────────────────────

  'unions/union-reports': {
    results: [
      { unionName: 'CUPE (Canadian Union of Public Employees)', year: 2024, membership: 715000, revenue: 185000000, assets: 450000000, sector: 'Public Sector' },
      { unionName: 'Unifor', year: 2024, membership: 315000, revenue: 95000000, assets: 280000000, sector: 'Private Sector' },
      { unionName: 'PSAC (Public Service Alliance of Canada)', year: 2024, membership: 230000, revenue: 75000000, assets: 195000000, sector: 'Federal Public Service' },
      { unionName: 'FTQ (Fédération des travailleurs et travailleuses du Québec)', year: 2024, membership: 600000, revenue: 140000000, assets: 350000000, sector: 'General' },
    ],
  },

  // ─── Universities ───────────────────────────────────────────

  'universities/university-data': {
    results: [
      { institution: 'University of Toronto', year: 2024, province: 'ON', totalRevenue: 3500000000, totalEnrolment: 62000, researchIncome: 1350000000, endowment: 4500000000 },
      { institution: 'McGill University', year: 2024, province: 'QC', totalRevenue: 1800000000, totalEnrolment: 39000, researchIncome: 780000000, endowment: 2000000000 },
      { institution: 'University of British Columbia', year: 2024, province: 'BC', totalRevenue: 2800000000, totalEnrolment: 58000, researchIncome: 780000000, endowment: 2600000000 },
      { institution: 'University of Alberta', year: 2024, province: 'AB', totalRevenue: 1800000000, totalEnrolment: 38000, researchIncome: 520000000, endowment: 1500000000 },
    ],
  },

  // ─── CRTC ──────────────────────────────────────────────────────

  'crtc/decisions': {
    results: [
      { year: 2025, number: 'CRTC 2025-50', type: 'Broadcasting', applicant: 'Bell Media Inc.', subject: 'Conditional licence renewal — CTV and CTV2 stations', decision: 'Approved with conditions', date: '2025-04-10' },
      { year: 2025, number: 'CRTC 2025-48', type: 'Telecom', applicant: 'Rogers Communications', subject: 'Wholesale mobile virtual network operator (MVNO) access', decision: 'Denied', date: '2025-04-05' },
      { year: 2025, number: 'CRTC 2025-32', type: 'Broadcasting', applicant: 'Canadian Broadcasting Corporation', subject: 'CBC licence renewal 2025-2030', decision: 'Approved with conditions', date: '2025-02-28' },
    ],
  },
  'crtc/ownership': {
    results: [
      { owner: 'Bell Canada Enterprises', sector: 'Broadcasting', outlets: ['CTV', 'CTV2', 'BNN Bloomberg', 'TSN', 'RDS'], radioStations: 90, marketShare: 35.2 },
      { owner: 'Rogers Communications', sector: 'Broadcasting', outlets: ['Citytv', 'Sportsnet', 'OMNI', 'FX Canada'], radioStations: 55, marketShare: 22.8 },
      { owner: 'Quebecor Media', sector: 'Broadcasting', outlets: ['TVA', 'TVA Sports', 'LCN', 'Canal Argent', 'TVAGroupe'], radioStations: 25, marketShare: 15.5 },
    ],
  },

  // ─── CRA Charity ─────────────────────────────────────────────

  'cra-charity/charity-search': {
    results: [
      { charityName: 'Canadian Cancer Society', businessNumber: '118829803RR0001', category: 'Health', year: 2024, revenue: 280000000, status: 'Active', city: 'Toronto', province: 'ON' },
      { charityName: 'United Way Centraide Canada', businessNumber: '119278414RR0001', category: 'Social Services', year: 2024, revenue: 520000000, status: 'Active', city: 'Ottawa', province: 'ON' },
      { charityName: 'Médecins Sans Frontières Canada', businessNumber: '135680708RR0001', category: 'International', year: 2024, revenue: 180000000, status: 'Active', city: 'Toronto', province: 'ON' },
      { charityName: "World Wildlife Fund Canada", businessNumber: '119304854RR0001', category: 'Environment', year: 2024, revenue: 65000000, status: 'Active', city: 'Toronto', province: 'ON' },
    ],
  },
  'cra-charity/political-spending': {
    results: [
      { year: 2024, charityBN: '118829803RR0001', charityName: 'Canadian Cancer Society', politicalSpending: 125000, totalRevenue: 280000000, percentOfRevenue: 0.045, activity: 'Advocacy on tobacco legislation' },
      { year: 2024, charityBN: '119278414RR0001', charityName: 'United Way Centraide Canada', politicalSpending: 50000, totalRevenue: 520000000, percentOfRevenue: 0.010, activity: 'Policy recommendations on poverty reduction' },
      { year: 2024, charityBN: '135680708RR0001', charityName: 'Médecins Sans Frontières Canada', politicalSpending: 0, totalRevenue: 180000000, percentOfRevenue: 0, activity: 'None reported' },
    ],
  },

  // ─── Provincial Regulators ─────────────────────────────────

  'provincial-regulators/regulator-search': {
    results: [
      { name: 'Ontario Securities Commission (OSC)', province: 'ON', category: 'Securities', website: 'https://www.osc.ca', description: 'Regulates Ontario capital markets' },
      { name: 'British Columbia Securities Commission', province: 'BC', category: 'Securities', website: 'https://www.bcsc.ca', description: 'Regulates BC capital markets' },
      { name: 'Law Society of Ontario', province: 'ON', category: 'Legal', website: 'https://lso.ca', description: 'Regulates Ontario lawyers and paralegals' },
      { name: 'College of Physicians and Surgeons of Ontario', province: 'ON', category: 'Health', website: 'https://www.cpso.on.ca', description: 'Regulates Ontario physicians and surgeons' },
      { name: 'Engineering and Geoscientists BC', province: 'BC', category: 'Engineering', website: 'https://www.egbc.ca', description: 'Regulates professional engineers in BC' },
    ],
  },
  'provincial-regulators/regulator-coverage': {
    results: [
      { province: 'ON', categories: 21, totalRegulators: 45, securities: 1, financialServices: 3, law: 2, policing: 1, engineering: 1, health: 8, education: 2 },
      { province: 'BC', categories: 19, totalRegulators: 38, securities: 1, financialServices: 2, law: 2, policing: 1, engineering: 1, health: 7, education: 2 },
      { province: 'QC', categories: 20, totalRegulators: 42, securities: 1, financialServices: 3, law: 2, policing: 1, engineering: 1, health: 8, education: 2 },
      { province: 'AB', categories: 18, totalRegulators: 35, securities: 1, financialServices: 2, law: 2, policing: 1, engineering: 1, health: 6, education: 2 },
    ],
  },

  // ─── A2AJ Legal API ─────────────────────────────────────────

  'a2aj/legal-search': {
    results: [
      { caseName: 'Reference re Greenhouse Gas Pollution Pricing Act', court: 'Supreme Court of Canada', citation: '2021 SCC 11', date: '2021-03-25', summary: 'Constitutional challenge to federal carbon pricing — upheld as valid federal law under POGG' },
      { caseName: 'R. v. Jordan', court: 'Supreme Court of Canada', citation: '2016 SCC 27', date: '2016-07-08', summary: 'Right to trial within reasonable time — presumptive ceiling of 18 months for provincial court, 30 months for superior court' },
      { caseName: 'Canada (Minister of Citizenship and Immigration) v. Vavilov', court: 'Supreme Court of Canada', citation: '2019 SCC 65', date: '2019-12-19', summary: 'Standard of review for administrative decisions — revised framework anchored in legislative intent' },
    ],
  },
  'a2aj/legal-fetch': {
    results: [
      { citation: '2021 SCC 11', title: 'Reference re Greenhouse Gas Pollution Pricing Act', court: 'Supreme Court of Canada', date: '2021-03-25', fullText: 'The Greenhouse Gas Pollution Pricing Act, SC 2018, c 12 (the Act)...', pageCount: 182, majority: '6-3' },
    ],
  },
  'a2aj/legal-coverage': {
    results: [
      { dataset: 'Supreme Court of Canada', docType: 'case', count: 8500, description: 'Full-text SCC decisions from 1876 to present' },
      { dataset: 'Federal Court of Appeal', docType: 'case', count: 18500, description: 'Full-text FCA decisions' },
      { dataset: 'Federal Court', docType: 'case', count: 42000, description: 'Full-text FC decisions' },
      { dataset: 'Ontario Court of Appeal', docType: 'case', count: 28000, description: 'Full-text ONCA decisions' },
      { dataset: 'Consolidated Federal Acts', docType: 'statute', count: 1200, description: 'Current federal statutes in XML format' },
      { dataset: 'Consolidated Federal Regulations', docType: 'regulation', count: 4500, description: 'Current federal regulations in XML format' },
    ],
  },

  // ─── Legislation ────────────────────────────────────────────

  'legislation/federal-acts': {
    results: [
      { title: 'Criminal Code of Canada', chapter: 'RSC 1985, c C-46', lastAmended: '2025-03-15', pages: 1850, departments: ['Justice Canada'], url: 'https://laws-lois.justice.gc.ca/eng/acts/c-46/' },
      { title: 'Income Tax Act', chapter: 'RSC 1985, c 1 (5th Supp.)', lastAmended: '2025-04-01', pages: 3200, departments: ['Finance Canada', 'CRA'], url: 'https://laws-lois.justice.gc.ca/eng/acts/i-3.3/' },
      { title: 'Immigration and Refugee Protection Act', chapter: 'SC 2001, c 27', lastAmended: '2025-02-20', pages: 280, departments: ['IRCC'], url: 'https://laws-lois.justice.gc.ca/eng/acts/i-2.5/' },
    ],
  },
  'legislation/federal-regulations': {
    results: [
      { title: 'Immigration and Refugee Protection Regulations', chapter: 'SOR/2002-227', lastAmended: '2025-03-01', pages: 450, enablingAct: 'Immigration and Refugee Protection Act' },
      { title: 'Food and Drug Regulations', chapter: 'CRC, c 870', lastAmended: '2025-02-15', pages: 620, enablingAct: 'Food and Drugs Act' },
      { title: 'Canadian Aviation Regulations', chapter: 'SOR/96-433', lastAmended: '2025-03-25', pages: 890, enablingAct: 'Aeronautics Act' },
    ],
  },
  'legislation/provincial-legislation': {
    results: [
      { province: 'ON', title: 'Building Ontario Act (Budget Measures), 2025', chapter: 'SO 2025, c 1', type: 'Act', lastAmended: '2025-04-01' },
      { province: 'ON', title: 'Highway Traffic Act', chapter: 'RSO 1990, c H.8', type: 'Act', lastAmended: '2025-03-15' },
      { province: 'BC', title: 'Municipalities Enabling and Validating Act (No. 5)', chapter: 'SBC 2024, c 45', type: 'Act', lastAmended: '2024-12-15' },
      { province: 'QC', title: 'Charter of the French Language', chapter: 'CQLR c C-11', type: 'Act', lastAmended: '2025-02-01' },
    ],
  },

  // ─── GoC Spending ──────────────────────────────────────────

  'goc-spending/contracts': {
    results: [
      { id: 'CONT-2024-001', year: 2018, department: 'Public Services and Procurement Canada', vendor: 'CGI Information Systems and Management Consulting Inc.', value: 28500000, description: 'IT transformation services for pay system replacement', awardDate: '2018-06-15' },
      { id: 'CONT-2024-002', year: 2018, department: 'Department of National Defence', vendor: 'Irving Shipbuilding Inc.', value: 45000000, description: 'AOPS class vessel maintenance and support', awardDate: '2018-09-01' },
      { id: 'CONT-2024-003', year: 2019, department: 'Health Canada', vendor: 'BD Canada', value: 8500000, description: 'Medical supply procurement for pandemic preparedness', awardDate: '2019-11-20' },
      { id: 'CONT-2024-004', year: 2018, department: 'Correctional Service Canada', vendor: 'Sodexo Canada Ltd.', value: 12000000, description: 'Food services at federal correctional institutions', awardDate: '2018-03-01' },
    ],
  },
  'goc-spending/spending-summary': {
    results: [
      { year: 2018, department: 'Public Services and Procurement Canada', totalValue: 12500000000, contractCount: 18500, topVendor: 'CGI Information Systems', topVendorValue: 28500000 },
      { year: 2018, department: 'Department of National Defence', totalValue: 18000000000, contractCount: 9500, topVendor: 'Irving Shipbuilding Inc.', topVendorValue: 45000000 },
      { year: 2018, department: 'Health Canada', totalValue: 2200000000, contractCount: 4200, topVendor: 'BD Canada', topVendorValue: 8500000 },
      { year: 2018, department: 'Royal Canadian Mounted Police', totalValue: 1500000000, contractCount: 3800, topVendor: 'General Dynamics', topVendorValue: 9500000 },
      { year: 2018, department: 'Global Affairs Canada', totalValue: 1800000000, contractCount: 5200, topVendor: 'Accenture Inc.', topVendorValue: 7200000 },
    ],
  },

} as const;

/* ------------------------------------------------------------------ */
/*  Helper: getMockResponse                                            */
/* ------------------------------------------------------------------ */

/**
 * Generate a full MapleSpike response envelope from mock data.
 * Returns the same shape as a real API endpoint: { success, data, meta, quality, citation }.
 */
export function getMockResponse(
  agent: string,
  action: string,
  ctx?: { requestId?: string; startTime?: number },
): {
  success: boolean;
  data: Record<string, unknown> | null;
  meta: Record<string, unknown>;
  quality: QualityMeta;
  citation: CitationMeta;
} {
  const key = `${agent}/${action}`;
  const data = MOCK_DATA_MAP[key];

  // Build a minimal build context for quality meta
  const mockCtx = {
    tenant: { id: 'dev', name: 'Dev User', emailVerified: true, tier: 'pro' as const, isActive: true, journalismMode: false },
    requestId: ctx?.requestId || 'mock-' + crypto.randomUUID().slice(0, 12),
    startTime: ctx?.startTime || Date.now(),
  };

  const citation: CitationMeta = enrichCitation({
    source_name: 'MapleSpike Mock Data',
    source_url: `https://api.maplespike.ca/v1/${agent}/${action}`,
    retrieved_at: new Date().toISOString(),
    data_hash: '',
    license: 'https://open.canada.ca/en/open-government-licence-canada',
    update_frequency: 'daily',
    original_format: 'JSON',
  });

  const quality: QualityMeta = buildQualityMeta(mockCtx);

  return {
    success: true,
    data: data || { results: [], message: `No mock data for ${agent}/${action}` },
    meta: {
      requestId: mockCtx.requestId,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      usage: { periodCalls: 0, periodLimit: 1000, tier: 'pro' },
      agent,
      action,
      authMethod: 'api-key',
      creditsCharged: 0,
      cacheStatus: 'mock',
      durationMs: 0,
    },
    quality,
    citation,
  };
}

/* ------------------------------------------------------------------ */
/*  Legacy compatibility (preserved for existing index.ts imports)     */
/* ------------------------------------------------------------------ */

export interface MockDataSources {
  [source: string]: Record<string, unknown>[];
}

export const MOCK_DATA_SOURCES: MockDataSources = {
  hoc: [
    { committee: 'FINA', name: 'Finance Committee', meeting: 135, date: '2024-11-15', inCamera: false, witnesses: ['Bank of Canada', 'Finance Canada'], interventionCount: 124 },
    { committee: 'OGGO', name: 'Government Operations', meeting: 78, date: '2024-11-14', inCamera: false, witnesses: ['Treasury Board', 'Public Services'], interventionCount: 89 },
    { committee: 'ETHI', name: 'Ethics Committee', meeting: 52, date: '2024-11-13', inCamera: true, witnesses: ['Ethics Commissioner'], interventionCount: 67 },
  ],
  senate: [
    { committee: 'SOCI', name: 'Social Affairs', meeting: 45, date: '2024-11-16', inCamera: false, witnesses: ['Health Canada'], interventionCount: 56 },
    { committee: 'RIDR', name: 'Indigenous Peoples', meeting: 22, date: '2024-11-14', inCamera: false, witnesses: ['CIRNAC', 'ISC'], interventionCount: 43 },
  ],
  lobbying: [
    { registrant: 'OpenMedia', client: 'Public Interest Advocacy Centre', subjectMatter: ['Telecommunications', 'Broadcasting'], communicationDate: '2024-11-10' },
    { registrant: 'Canadian Chamber of Commerce', client: 'Business Council of Canada', subjectMatter: ['Taxation', 'Trade'], communicationDate: '2024-11-08' },
  ],
  procurement: [
    { title: 'IT Security Services for DND', vendor: 'Lockheed Martin Canada', value: 12500000, awardDate: '2024-10-15' },
    { title: 'Medical Supplies for PHAC', vendor: 'BD Canada', value: 3400000, awardDate: '2024-10-12' },
  ],
  gazette: [
    { title: 'Regulations Amending the Food and Drug Regulations', department: 'Health Canada', date: '2024-11-16', type: 'Regulation' },
    { title: 'Order Designating the Minister of Public Safety for the Purpose of the Act', department: 'Justice', date: '2024-11-15', type: 'Order' },
  ],
  gic: [
    { title: 'Governor of the Bank of Canada', appointee: 'Tiff Macklem', department: 'Bank of Canada', date: '2024-05-01', type: 'Governor-in-Council Appointment' },
    { title: 'Commissioner of the CRTC', appointee: 'Vicky Eatrides', department: 'CRTC', date: '2024-01-15', type: 'Governor-in-Council Appointment' },
  ],
  elections: [
    { name: 'Canadian Labour Congress', type: 'Third Party', spending: 1250000, periodStart: '2024-01-01', periodEnd: '2024-12-31' },
    { name: 'Canadian Taxpayers Federation', type: 'Third Party', spending: 450000, periodStart: '2024-01-01', periodEnd: '2024-12-31' },
  ],
  oversight: [
    { body: 'Office of the Conflict of Interest and Ethics Commissioner', title: 'Trudeau Foundation Examination Report', date: '2024-10-01', type: 'Investigation Report' },
    { body: 'Commissioner of Lobbying', title: 'Annual Report 2023-2024', date: '2024-09-15', type: 'Annual Report' },
  ],
  canlii: [
    { caseName: 'Canada (Attorney General) v. Power', court: 'Supreme Court of Canada', date: '2024-11-08', citation: '2024 SCC 35' },
    { caseName: 'Reference re Impact Assessment Act', court: 'Supreme Court of Canada', date: '2024-10-13', citation: '2024 SCC 33' },
  ],
  corporate: [
    { name: 'Royal Bank of Canada', ticker: 'RY', industry: 'Banking', revenue: 57000000000, fiscalYear: 2024 },
    { name: 'Shopify Inc.', ticker: 'SHOP', industry: 'E-Commerce', revenue: 7600000000, fiscalYear: 2024 },
  ],
  influence: [
    { registrant: 'CGI Group', recipient: 'Minister of Innovation', subject: 'Digital Transformation', amount: null },
    { registrant: 'RBC', recipient: 'Minister of Finance', subject: 'Banking Regulation', amount: null },
  ],
  provincialLobbying: [
    { registrant: 'Ontario Power Generation', province: 'ON', subject: 'Energy Policy', date: '2024-11-01' },
    { registrant: 'BC Hydro', province: 'BC', subject: 'Clean Energy', date: '2024-10-28' },
  ],
  lmia: [
    { year: 2025, quarter: 1, program: 'TFWP', stream: 'Agricultural', positionsApproved: 12500, province: 'ON' },
    { year: 2025, quarter: 1, program: 'IMP', stream: 'Global Talent', positionsApproved: 8400, province: 'BC' },
  ],
  immigration: [
    { year: 2025, month: 1, category: 'Economic', province: 'ON', admissions: 14500 },
    { year: 2025, month: 1, category: 'Family', province: 'BC', admissions: 3200 },
  ],
};

export const ALL_MOCK_CATEGORIES = Object.keys(MOCK_DATA_SOURCES);

export function getMockData(source: string): Record<string, unknown>[] {
  return MOCK_DATA_SOURCES[source] || [];
}
