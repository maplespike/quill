// SPDX-License-Identifier: AGPL-3.0-only

export const PARLIAMENT_SOURCES = {
  house: {
    label: 'House of Commons',
    url: 'https://www.ourcommons.ca/Members/en/votes',
    dataEndpoint: 'https://api.ourcommons.ca/votes',
  },
  senate: {
    label: 'Senate',
    url: 'https://sencanada.ca/en/senators/votes',
    dataEndpoint: 'https://api.sencanada.ca/votes',
  },
} as const;

export const PARLIAMENT_TIMEOUT_MS = 20_000;
export const PARLIAMENT_USER_AGENT = 'MapleSpike-Parliament/1.0';
