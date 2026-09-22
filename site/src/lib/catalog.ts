export type ModuleEntry = {
  id: string;
  name: string;
  group: string;
  jurisdiction: string;
  source: string;
};

export const MODULES: ModuleEntry[] = [
  { id: "ircc", name: "IRCC immigration", group: "Federal core", jurisdiction: "Federal", source: "Immigration, Refugees and Citizenship Canada" },
  { id: "statcan", name: "StatCan WDS", group: "Federal core", jurisdiction: "Federal", source: "Statistics Canada" },
  { id: "hc", name: "Health Canada", group: "Federal core", jurisdiction: "Federal", source: "Health Canada" },
  { id: "cra", name: "CRA charity registry", group: "Federal core", jurisdiction: "Federal", source: "Canada Revenue Agency" },
  { id: "budget", name: "Federal budget", group: "Federal core", jurisdiction: "Federal", source: "Department of Finance" },
  { id: "ati", name: "Access to information", group: "Federal core", jurisdiction: "Federal", source: "open.canada.ca" },
  { id: "hoc", name: "House committees", group: "Parliament", jurisdiction: "Federal", source: "House of Commons" },
  { id: "senate", name: "Senate committees", group: "Parliament", jurisdiction: "Federal", source: "Senate of Canada" },
  { id: "hansard", name: "Hansard", group: "Parliament", jurisdiction: "Federal", source: "Parliament of Canada" },
  { id: "gazette", name: "Canada Gazette", group: "Parliament", jurisdiction: "Federal", source: "Canada Gazette" },
  { id: "legis", name: "LEGISinfo", group: "Parliament", jurisdiction: "Federal", source: "Parliament of Canada" },
  { id: "gic", name: "GIC appointments", group: "Parliament", jurisdiction: "Federal", source: "Governor in Council" },
  { id: "oag", name: "Auditor General", group: "Oversight", jurisdiction: "Federal", source: "Office of the Auditor General" },
  { id: "pbo", name: "Parliamentary Budget Officer", group: "Oversight", jurisdiction: "Federal", source: "PBO" },
  { id: "ethics", name: "Ethics Commissioner", group: "Oversight", jurisdiction: "Federal", source: "Office of the Conflict of Interest and Ethics Commissioner" },
  { id: "ocl", name: "Lobbying registry", group: "Corporate and influence", jurisdiction: "Federal", source: "Office of the Commissioner of Lobbying" },
  { id: "buys", name: "CanadaBuys", group: "Corporate and influence", jurisdiction: "Federal", source: "Public Services and Procurement Canada" },
  { id: "sedi", name: "SEDI insider trades", group: "Corporate and influence", jurisdiction: "Federal", source: "System for Electronic Disclosure by Insiders" },
  { id: "corps", name: "Corporations Canada", group: "Corporate and influence", jurisdiction: "Federal", source: "Corporations Canada" },
  { id: "legislatures", name: "Provincial and territorial legislatures", group: "Provinces and cities", jurisdiction: "13 jurisdictions", source: "Legislative assemblies" },
  { id: "ckan", name: "Provincial CKAN portals", group: "Provinces and cities", jurisdiction: "13 jurisdictions", source: "Provincial open-data portals" },
  { id: "regulators", name: "Regulators", group: "Provinces and cities", jurisdiction: "Provincial", source: "273 regulators, 21 categories" },
  { id: "cities", name: "Municipal open data", group: "Provinces and cities", jurisdiction: "Municipal", source: "19 direct cities, CKAN federation" },
  { id: "canlii", name: "CanLII", group: "Justice and live feeds", jurisdiction: "Federal and provincial", source: "CanLII" },
  { id: "a2aj", name: "A2AJ decisions", group: "Justice and live feeds", jurisdiction: "Federal and provincial", source: "A2AJ" },
  { id: "laws", name: "Justice Canada legislation", group: "Justice and live feeds", jurisdiction: "Federal", source: "Justice Canada" },
  { id: "eccc", name: "Weather alerts", group: "Justice and live feeds", jurisdiction: "Federal", source: "Environment and Climate Change Canada" },
  { id: "cbsa", name: "Border wait times", group: "Justice and live feeds", jurisdiction: "Federal", source: "Canada Border Services Agency" },
];

export const GROUPS = [
  "Federal core",
  "Parliament",
  "Oversight",
  "Corporate and influence",
  "Provinces and cities",
  "Justice and live feeds",
] as const;
