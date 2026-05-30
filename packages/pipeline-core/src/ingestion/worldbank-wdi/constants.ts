// SPDX-License-Identifier: AGPL-3.0-or-later

export const WDI_BASE_URL = 'https://api.worldbank.org/v2';

export const WDI_TIMEOUT_MS = 15_000;
export const WDI_MAX_RECORDS = 1000;
export const WDI_PER_PAGE = 250;

export const DEFAULT_COUNTRIES = [
  'CAN', 'USA', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS', 'NZL',
  'MEX', 'BRA', 'IND', 'CHN', 'ZAF', 'NOR', 'SWE', 'CHE',
];

export const DEFAULT_INDICATORS = [
  'NY.GDP.MKTP.CD',
  'NY.GDP.PCAP.CD',
  'SP.POP.TOTL',
  'SP.POP.GROW',
  'SH.XPD.CHEX.GD.ZS',
  'SE.XPD.TOTL.GD.ZS',
  'MS.MIL.XPND.GD.ZS',
  'GB.XPD.RSDV.GD.ZS',
  'NY.GNP.PCAP.CD',
  'SL.UEM.TOTL.ZS',
  'FP.CPI.TOTL.ZG',
  'DT.ODA.ODAT.GD.ZS',
  'BX.KLT.DINV.WD.GD.ZS',
  'NE.EXP.GNFS.ZS',
  'NE.IMP.GNFS.ZS',
];

export const WDI_USER_AGENT = 'MapleSpike-WDI/1.0';

export const TOPIC_INDICATORS = {
  economy: {
    code: 'economy',
    name: 'Economic Indicators',
    indicators: [
      'NY.GDP.MKTP.CD',
      'NY.GDP.PCAP.CD',
      'NY.GNP.PCAP.CD',
      'FP.CPI.TOTL.ZG',
      'SL.UEM.TOTL.ZS',
      'BX.KLT.DINV.WD.GD.ZS',
      'NE.EXP.GNFS.ZS',
      'NE.IMP.GNFS.ZS',
      'GC.TAX.TOTL.GD.ZS',
      'DT.DOD.DECT.GN.ZA',
    ],
  },
  social: {
    code: 'social',
    name: 'Social Indicators',
    indicators: [
      'SP.POP.TOTL',
      'SP.POP.GROW',
      'SP.DYN.TFRT.IN',
      'SP.DYN.LE00.IN',
      'SL.TLF.CACT.FE.ZS',
      'SL.TLF.CACT.MA.ZS',
      'SE.XPD.TOTL.GD.ZS',
      'SE.SEC.ENRL',
      'SI.POV.NAHC',
    ],
  },
  health: {
    code: 'health',
    name: 'Health Indicators',
    indicators: [
      'SH.XPD.CHEX.GD.ZS',
      'SH.DYN.MORT',
      'SH.STA.SUIC.P5',
      'SH.MED.BEDS.ZS',
      'SH.MED.PHYS.ZS',
      'SH.H2O.SAFE.ZS',
      'SH.STA.ANVC.ZS',
      'SP.DYN.IMRT.IN',
    ],
  },
  infrastructure: {
    code: 'infrastructure',
    name: 'Infrastructure Indicators',
    indicators: [
      'IT.NET.USER.ZS',
      'IT.CEL.SETS.P2',
      'EG.USE.ELEC.KH.PC',
      'EG.FEC.RNEW.ZS',
      'IS.SHP.GOOD.TU',
      'IS.AIR.DPTM',
      'TX.VAL.TECH.MF.ZS',
    ],
  },
  environment: {
    code: 'environment',
    name: 'Environmental Indicators',
    indicators: [
      'EN.ATM.CO2E.KT',
      'EN.ATM.METH.KT.CE',
      'EN.ATM.NOXE.KT.CE',
      'AG.LND.AGRI.ZS',
      'AG.LND.FRST.ZS',
      'ER.H2O.FWTL.ZS',
      'EG.USE.COMM.GD.PP.KD.OE',
    ],
  },
  governance: {
    code: 'governance',
    name: 'Governance Indicators',
    indicators: [
      'GB.XPD.RSDV.GD.ZS',
      'MS.MIL.XPND.GD.ZS',
      'GC.XPN.TOTL.GD.ZS',
      'GC.REV.XGRT.GD.ZS',
      'IQ.SCI.MTHD',
    ],
  },
};

export const CORE_INDICATORS: { code: string; name: string }[] = [
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