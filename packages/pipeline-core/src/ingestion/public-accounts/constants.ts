// SPDX-License-Identifier: AGPL-3.0-only

export const ACCOUNT_CATEGORIES = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'expense', label: 'Expenses' },
  { id: 'asset', label: 'Assets' },
  { id: 'liability', label: 'Liabilities' },
  { id: 'debt', label: 'Debt' },
] as const;

export const PUBLIC_ACCOUNTS_SOURCES = [
  { level: 'federal', name: 'Government of Canada', url: 'https://api.canada.ca/public-accounts' },
  { level: 'ON', name: 'Government of Ontario', url: 'https://api.ontario.ca/public-accounts' },
  { level: 'QC', name: 'Government of Quebec', url: 'https://api.quebec.ca/public-accounts' },
  { level: 'BC', name: 'Government of British Columbia', url: 'https://api.bc.ca/public-accounts' },
  { level: 'AB', name: 'Government of Alberta', url: 'https://api.alberta.ca/public-accounts' },
];

export const PUBLIC_ACCOUNTS_TIMEOUT_MS = 20_000;
export const PUBLIC_ACCOUNTS_USER_AGENT = 'MapleSpike-PublicAccounts/1.0';
