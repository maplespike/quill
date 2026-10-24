// SPDX-License-Identifier: AGPL-3.0-only

export const IDS_BASE_URL = "https://api.worldbank.org/v2";

export const IDS_TIMEOUT_MS = 15_000;
export const IDS_PER_PAGE = 250;

export const IDS_USER_AGENT = "MapleSpike-IDS/1.0";

export const DEFAULT_COUNTRIES = [
  "CAN", "USA", "GBR", "DEU", "FRA", "JPN", "AUS", "NZL",
  "MEX", "BRA", "IND", "CHN", "ZAF", "NOR", "SWE", "CHE",
];

export const TOPIC_INDICATORS = {
  debt: {
    code: "debt",
    name: "Debt Statistics",
    indicators: [
      "DT.DOD.DLXF.CD",
      "DT.DOD.DECT.GN.ZS",
      "DT.DOD.DECT.CD",
      "DT.DOD.DSTC.CD",
      "DT.DOD.PVTG.CD",
      "DT.DOD.MWBG.CD",
      "DT.DOD.OFFT.CD",
      "DT.DOD.DPPG.CD",
      "DT.INT.DLXF.CD",
      "DT.INT.DECT.CD",
      "DT.AMT.DLXF.CD",
      "DT.AMT.DECT.CD",
      "DT.NFL.DLXF.CD",
      "DT.NFL.DECT.CD",
      "DT.TDS.DECT.CD",
      "DT.TDS.DLXF.CD",
    ],
  },
  flows: {
    code: "flows",
    name: "Financial Flows",
    indicators: [
      "DT.ODA.ODAT.GD.ZS",
      "DT.ODA.ODAT.CD",
      "DT.ODA.ALLD.CD",
      "DT.ODA.OATL.CD",
      "DT.ODA.OATL.KD",
      "DT.NFL.BLAT.CD",
      "DT.NFL.MLAT.CD",
      "DT.NFL.PBND.CD",
      "DT.NFL.PCBK.CD",
      "DT.NFL.PNGB.CD",
      "DT.NFL.DPNG.CD",
      "BX.KLT.DINV.WD.GD.ZS",
      "BX.KLT.DINV.CD.WD",
      "BM.KLT.DINV.CD.WD",
    ],
  },
  ibrd: {
    code: "ibrd",
    name: "IBRD/IDA Operations",
    indicators: [
      "DT.NFL.MIBR.CD",
      "DT.NFL.MIDA.CD",
      "DT.DIS.MIBR.CD",
      "DT.DIS.MIDA.CD",
      "DT.AMT.MIBR.CD",
      "DT.AMT.MIDA.CD",
      "DT.INT.MIBR.CD",
      "DT.INT.MIDA.CD",
    ],
  },
};

export const DEFAULT_INDICATORS = [
  "DT.DOD.DLXF.CD",
  "DT.DOD.DECT.GN.ZS",
  "DT.ODA.ODAT.GD.ZS",
  "BX.KLT.DINV.WD.GD.ZS",
  "DT.TDS.DECT.CD",
  "DT.NFL.DLXF.CD",
  "DT.INT.DECT.CD",
  "DT.AMT.DECT.CD",
];

export const CORE_INDICATORS: { code: string; name: string }[] = [
  { code: "DT.DOD.DLXF.CD", name: "External debt stocks, long-term (DOD, current US$)" },
  { code: "DT.DOD.DECT.GN.ZS", name: "External debt stocks (% of GNI)" },
  { code: "DT.DOD.DECT.CD", name: "External debt stocks, total (DOD, current US$)" },
  { code: "DT.ODA.ODAT.GD.ZS", name: "Net ODA received (% of GNI)" },
  { code: "DT.ODA.ODAT.CD", name: "Net ODA received (current US$)" },
  { code: "BX.KLT.DINV.WD.GD.ZS", name: "Foreign direct investment, net inflows (% of GDP)" },
  { code: "DT.TDS.DECT.CD", name: "Debt service on external debt, total (TDS, current US$)" },
  { code: "DT.NFL.DLXF.CD", name: "Net flows on external debt, long-term (NFL, current US$)" },
  { code: "DT.INT.DECT.CD", name: "Interest payments on external debt, total (INT, current US$)" },
  { code: "DT.AMT.DECT.CD", name: "Principal repayments on external debt, total (AMT, current US$)" },
];
