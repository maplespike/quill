// SPDX-License-Identifier: AGPL-3.0-only

export const COMTRADE_BASE_URL = 'https://comtrade.un.org/api/v2';
export const COMTRADE_PLUS_URL = 'https://comtradeplus.un.org/api/v2';

export const COMTRADE_TIMEOUT_MS = 30_000;
export const COMTRADE_MAX_RECORDS = 100_000;

export const COMTRADE_USER_AGENT = 'MapleSpike-Comtrade/1.0';

export const DEFAULT_REPORTER = 'CAN';
export const DEFAULT_PARTNERS = ['USA', 'GBR', 'CHN', 'MEX', 'JPN', 'DEU', 'FRA', 'IND', 'BRA', 'AUS'];
export const DEFAULT_PERIOD = new Date().getFullYear() - 1;
