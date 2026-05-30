// SPDX-License-Identifier: AGPL-3.0-or-later

export const WDI_BASE_URL = 'https://api.worldbank.org/v2';

export const WDI_TIMEOUT_MS = 15_000;
export const WDI_MAX_RECORDS = 1000;
export const WDI_PER_PAGE = 250;

/** Default list of countries to fetch (ISO 3166-1 alpha-3 codes) */
export const DEFAULT_COUNTRIES = [
  'CAN', 'USA', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS', 'NZL',
  'MEX', 'BRA', 'IND', 'CHN', 'ZAF', 'NOR', 'SWE', 'CHE',
];

/** Default indicators to fetch */
export const DEFAULT_INDICATORS = [
  'NY.GDP.MKTP.CD',      // GDP (current US$)
  'NY.GDP.PCAP.CD',      // GDP per capita (current US$)
  'SP.POP.TOTL',         // Population, total
  'SP.POP.GROW',         // Population growth (annual %)
  'SH.XPD.CHEX.GD.ZS',   // Current health expenditure (% of GDP)
  'SE.XPD.TOTL.GD.ZS',   // Government expenditure on education, total (% of GDP)
  'MS.MIL.XPND.GD.ZS',   // Military expenditure (% of GDP)
  'GB.XPD.RSDV.GD.ZS',   // Research and development expenditure (% of GDP)
  'NY.GNP.PCAP.CD',      // GNI per capita (current US$)
  'SL.UEM.TOTL.ZS',      // Unemployment, total (% of total labor force)
  'FP.CPI.TOTL.ZG',      // Inflation, consumer prices (annual %)
  'DT.ODA.ODAT.GD.ZS',   // Net ODA received (% of GNI)
  'BX.KLT.DINV.WD.GD.ZS', // Foreign direct investment, net inflows (% of GDP)
  'NE.EXP.GNFS.ZS',      // Exports of goods and services (% of GDP)
  'NE.IMP.GNFS.ZS',      // Imports of goods and services (% of GDP)
];

export const WDI_USER_AGENT = 'MapleSpike-WDI/1.0';

import type { Indicator } from './types.js';

export const CORE_INDICATORS: Indicator[] = [
  { code: 'NY.GDP.MKTP.CD', name: 'GDP (current US$)' },
  { code: 'NY.GDP.PCAP.CD', name: 'GDP per capita' },
  { code: 'SP.POP.TOTL', name: 'Population total' },
  { code: 'SH.XPD.CHEX.GD.ZS', name: 'Health expenditure (% GDP)' },
  { code: 'SE.XPD.TOTL.GD.ZS', name: 'Education expenditure (% GDP)' },
  { code: 'MS.MIL.XPND.GD.ZS', name: 'Military expenditure (% GDP)' },
  { code: 'GB.XPD.RSDV.GD.ZS', name: 'R&D expenditure (% GDP)' },
  { code: 'NE.RSB.GNFS.ZS', name: 'Trade balance (% GDP)' },
  { code: 'BX.KLT.DINV.WD.GD.ZS', name: 'FDI net inflows (% GDP)' },
  { code: 'DT.ODA.ODAT.GD.ZS', name: 'Official development assistance (% GNI)' },
];
