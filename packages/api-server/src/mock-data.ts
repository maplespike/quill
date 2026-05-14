/**
 * Mock Data — MapleSpike API
 *
 * Curated sample responses for the `_mock=true` query parameter.
 * This is an explicit user-facing feature for testing, demos, and
 * development — NOT a silent fallback for missing real data.
 *
 * When a client passes `_mock=true`, the API returns this curated
 * sample data instead of hitting live sources. Useful for:
 *   - Integration testing without network dependencies
 *   - Frontend development against known data shapes
 *   - Demo environments where live data isn't available
 */

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
