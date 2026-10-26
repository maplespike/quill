// SPDX-License-Identifier: AGPL-3.0-only

export const WGI_BASE_URL = "https://api.worldbank.org/v2";

export const WGI_TIMEOUT_MS = 15_000;
export const WGI_PER_PAGE = 250;

export const WGI_USER_AGENT = "MapleSpike-WGI/1.0";

export const DEFAULT_COUNTRIES = [
  "CAN", "USA", "GBR", "DEU", "FRA", "JPN", "AUS", "NZL",
  "MEX", "BRA", "IND", "CHN", "ZAF", "NOR", "SWE", "CHE",
];

export const WGI_INDICATORS = [
  { code: "VA.EST", name: "Voice and Accountability", description: "Extent to which a country's citizens are able to participate in selecting their government, as well as freedom of expression, freedom of association, and a free media." },
  { code: "PV.EST", name: "Political Stability and Absence of Violence/Terrorism", description: "Likelihood of political instability and/or politically-motivated violence, including terrorism." },
  { code: "GE.EST", name: "Government Effectiveness", description: "Quality of public services, the quality of the civil service and the degree of its independence from political pressures, the quality of policy formulation and implementation, and the credibility of the government's commitment to such policies." },
  { code: "RQ.EST", name: "Regulatory Quality", description: "Ability of the government to formulate and implement sound policies and regulations that permit and promote private sector development." },
  { code: "RL.EST", name: "Rule of Law", description: "Extent to which agents have confidence in and abide by the rules of society, and in particular the quality of contract enforcement, property rights, the police, and the courts, as well as the likelihood of crime and violence." },
  { code: "CC.EST", name: "Control of Corruption", description: "Extent to which public power is exercised for private gain, including both petty and grand forms of corruption, as well as 'capture' of the state by elites and private interests." },
];

export const DEFAULT_INDICATORS = WGI_INDICATORS.map(i => i.code);
