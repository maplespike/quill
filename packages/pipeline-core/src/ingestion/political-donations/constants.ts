// SPDX-License-Identifier: AGPL-3.0-only

export const DONATIONS_SOURCES = [
  { jurisdiction: 'federal', name: 'Elections Canada', url: 'https://api.elections.ca/political-finance/contributions' },
  { jurisdiction: 'ON', name: 'Elections Ontario', url: 'https://api.elections.on.ca/finance/contributions' },
  { jurisdiction: 'QC', name: 'Élections Québec', url: 'https://www.electionsquebec.qc.ca/api/donations' },
  { jurisdiction: 'BC', name: 'Elections BC', url: 'https://api.elections.bc.ca/finance/contributions' },
  { jurisdiction: 'AB', name: 'Elections Alberta', url: 'https://api.elections.ab.ca/finance/contributions' },
];

export const DONATIONS_TIMEOUT_MS = 15_000;
export const DONATIONS_USER_AGENT = 'MapleSpike-Donations/1.0';
