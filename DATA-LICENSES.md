---
last-reviewed: 2026-10-14
status: reference
---

# Data licences, attribution, and required notices

**This document is not legal advice and is not a licence.** It records the publisher terms that Quill's source families are published under, as review leads, and the attribution statements and notices that apply when source material is reused. It does not assert that a source prohibits reuse, and it does not clear any use. Where a publisher declares terms with the data, the declaration and its scope govern; verify per dataset and per use. See [`docs/licensing-audit.md`](./docs/licensing-audit.md) for the audit context and [`data-source-licenses.json`](./data-source-licenses.json) for the machine-readable inventory whose index appears below.

The site footer and the `/data-sources` page on the portal surface the statements in this file; the portal renders them from `packages/portal/src/lib/attribution-notices.ts`. This file and that module must stay in sync.

## Publisher groups and applicable terms

| Publisher group | Quill sources in this group (examples) | Terms / licence | Required attribution or notice | Limits to check |
| --- | --- | --- | --- | --- |
| Government of Canada open data | open.canada.ca / CKAN datasets: Proactive Publication – Contracts, Federal Corporations, Grants and Contributions, CRA lists of charities, and other datasets licensed `ca-ogl-lgo` | [Open Government Licence – Canada 2.0](https://open.canada.ca/en/open-government-licence-canada) | `Contains information licensed under the Open Government Licence – Canada.` plus a link to the licence; pass through any provider-specific statement the dataset carries | Excludes personal information, third-party rights the provider cannot license, the provider's names/crests/logos/official symbols, and other IP; no implied endorsement |
| Statistics Canada | StatCan WDS series (CPI, GDP, labour, population, trade) and StatCan tables | [Statistics Canada Open Licence](https://www.statcan.gc.ca/en/reference/licence) | `Source: Statistics Canada, <product>, <reference date>. Reproduced and distributed on an "as is" basis with the permission of Statistics Canada.` (and the adapted form for value-added products) | Accurate reproduction; no endorsement implication; no merging or linking to identify individuals, businesses, or organizations; official symbols need written TBS authorization |
| House of Commons | Committee evidence and minutes, Hansard transcripts, votes, LEGISinfo | [Important notices — Speaker's Permission](https://www.ourcommons.ca/en/important-notices) | Reproduction permitted only if accurate and not presented as official; **the permission does not extend to commercial purpose or financial gain**; briefs may need author authorization | Paid use needs authorization from the Office of the Speaker — see the flag in the audit report |
| Senate of Canada | Senate committee proceedings, Senate debates | [Intellectual property — Permission Regarding Reproduction](https://sencanada.ca/en/intellectual-property) | Accurate, not presented as official, **no use for purposes of financial gain**; non-commercial reproduction must name the Senate as author, include the title, and link the original | Commercial reproduction prohibited without written permission; third-party material may need separate permission |
| Canada Gazette | Parts I–III (proposed regulations, enacted regulations, Acts of Parliament) | [Government of Canada terms and conditions](https://www.canada.ca/en/transparency/terms.html); enactments via the [Reproduction of Federal Law Order](https://laws-lois.justice.gc.ca/eng/regulations/SI-97-5/FullText.html) | RFLO: reproduce freely, verify accuracy, never present as an official version; other items follow the terms page (non-commercial reproduction conditions; commercial permission from the responsible institution) | Gazette items vary; department-produced content is per institution |
| Office of the Commissioner of Lobbying | Lobbying Registrations dataset (`ca-odla-aldg`, publisher-declared on open.canada.ca) | [Open Data Licence Agreement](https://lobbycanada.gc.ca/en/open-data/open-data-licence-agreement/) | `Contains information licensed under the Open Data Licence Agreement — Office of the Commissioner of Lobbying.` | Same exclusions as the federal OGL, including personal information |
| CanadaBuys / procurement | Tender notices, contract history, standing offers | canadabuys.canada.ca; the contracts dataset is covered by OGL where declared | OGL statement where the dataset declares it | Site terms for non-dataset pages; per-dataset declarations |
| Corporations Canada | Federal corporation records (JSON datasets) | [Accessing federal corporation JSON datasets](https://ised-isde.canada.ca/site/corporations-canada/en/accessing-federal-corporation-json-datasets); dataset offered under OGL where declared | OGL statement where the dataset declares it | Do not assume OGL for every corporation field |
| CanLII | Case law | [Terms of use](https://www.canlii.org/info/terms.html) | Terms restrict certain automated and bulk uses — verify before harvesting or republishing | Not OGL; review required |
| A2AJ | 116K+ court and tribunal decisions | [a2aj.ca](https://a2aj.ca/) | Follow the terms published for the specific dataset or API | Review per dataset |
| Provincial & territorial | 13 legislatures, 13 CKAN portals, 273 regulators | Per-portal licences, e.g. [Alberta](https://open.alberta.ca/licence), [British Columbia](https://www2.gov.bc.ca/gov/content/data/open-data/open-government-licence-bc), [Ontario](https://www.ontario.ca/page/open-government-licence-ontario), [Québec](https://www.donneesquebec.ca/licence/) | Follow each provincial licence's attribution statement | Provincial licences are distinct from each other and from the federal OGL |
| Municipal | 19 city open data portals plus CKAN federation | Per-city licences, e.g. [Toronto](https://www.toronto.ca/city-government/data-research-maps/open-data/open-data-licence/), [Vancouver](https://opendata.vancouver.ca/pages/licence) | Follow the city licence's attribution requirements | No blanket municipal licence |
| Courts, tribunals & legal | Provincial court sites, federal tribunals | Individual terms; federal decisions covered by the RFLO | RFLO conditions for federal decisions; check provincial terms | Mixed — review per source |
| Elections & political finance | Elections Canada datasets, provincial registries | [Elections Canada](https://www.elections.ca/content.aspx?section=pol&dir=can&document=index&lang=e) pages and terms; statutory restrictions | Follow each source's statutory terms | No OGL inference |
| Regulators & oversight bodies | OSFI, CRTC, Competition Bureau, OAG, PBO, Ethics/Lobbying/Privacy Commissioners | Each institution's publication terms | Conditions per institution; OGL only where declared | Mixed — review per dataset |
| Real-time feeds | ECCC weather alerts (CAP-CP), CBSA wait times | Source-specific open licences and API conditions | Preserve each feed's conditions and attribution | Verify per feed |
| International organisations | UN, OECD, World Bank, IMF, WHO | [UN terms](https://www.un.org/en/about-us/terms-of-use), [OECD terms](https://www.oecd.org/en/about/terms-conditions.html), [World Bank dataset terms](https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets) | Follow the organization's terms for attribution | Independent terms — review per dataset |
| News media (RSS) | CBC, Postmedia, regional outlets | Publisher site terms, e.g. the [CBC terms of use](https://www.cbc.ca/terms-of-use) | Feeds are used for discovery and headline indexing; no full-text republication without a licence | RSS availability is not a content licence |
| Think tanks & NGOs (RSS) | 31+ think-tank and NGO feeds | Publisher site terms | RSS availability is not a content licence | Review per publisher |
| Securities & filings | SEDAR+, SEDI, provincial securities regulators | Regulator terms | Issuer and third-party copyrights possible | Review automated use |

## Required notices (full wording)

### Open Government Licence – Canada

> Contains information licensed under the Open Government Licence – Canada.

French: `Contient de l'information visée par la Licence du gouvernement ouvert – Canada.` — <https://open.canada.ca/en/open-government-licence-canada>

### Lobbying registry open data licence

> Contains information licensed under the Open Data Licence Agreement — Office of the Commissioner of Lobbying.

<https://lobbycanada.gc.ca/en/open-data/open-data-licence-agreement/>

### Statistics Canada Open Licence

> Source: Statistics Canada, name of product, reference date. Reproduced and distributed on an "as is" basis with the permission of Statistics Canada.

> Adapted from Statistics Canada, name of product, reference date. This does not constitute an endorsement by Statistics Canada of this product.

<https://www.statcan.gc.ca/en/reference/licence>

### House of Commons — Speaker's Permission (excerpt)

> Reproduction of the proceedings of the House of Commons and its Committees, in whole or in part and in any medium, is hereby permitted provided that the reproduction is accurate and is not presented as official. This permission does not extend to reproduction, distribution or use for commercial purpose of financial gain. [...] All copyrights therein are also reserved.

<https://www.ourcommons.ca/en/important-notices>

### Senate of Canada — Permission Regarding Reproduction (excerpt)

> Reproduction of the proceedings of the Senate and its committees, in whole or in part and in any medium, is hereby permitted provided that the reproduction is not presented as official and is accurate [...] This permission does not extend to any use for purposes of financial gain. [...] All copyrights of the proceedings of the Senate and its committees are also reserved.

> Commercial reproduction: Unless otherwise specified, reproduction of materials on the Senate website, either in whole or in part, for the purposes of commercial redistribution is prohibited except with written permission from us.

<https://sencanada.ca/en/intellectual-property>

### Reproduction of Federal Law Order (SI/97-5)

> Anyone may, without charge or request for permission, reproduce enactments and consolidations of enactments of the Government of Canada, and decisions and reasons for decisions of federally-constituted courts and administrative tribunals, provided due diligence is exercised in ensuring the accuracy of the materials reproduced and the reproduction is not represented as an official version.

<https://laws-lois.justice.gc.ca/eng/regulations/SI-97-5/FullText.html>

### Official symbols and non-endorsement

> The official symbols of the Government of Canada, including the Canada wordmark, the Arms of Canada, and the flag symbol may not be reproduced, whether for commercial or non-commercial purposes, without prior written authorization.

<https://www.canada.ca/en/transparency/terms.html>

Quill carries this site-wide disclaimer: **Not affiliated with or endorsed by the Government of Canada.**

## Personal information

- The Open Government Licence – Canada and the lobbying open data licence **do not grant any right to use personal information** (as defined in section 3 of the *Privacy Act*). Dataset records — for example charity or lobbying registrations — can include individuals' names; that does not make the personal information licensed.
- PIPEDA governs Quill's own handling of personal information in the course of commercial activity; the portal privacy policy describes that handling and the privacy contact.
- Quill's terms of service prohibit using the service to extract personal information about identifiable individuals.
- The Statistics Canada Open Licence additionally prohibits merging or linking information to identify an individual person, business, or organization.
- Whether a particular field in a source dataset is "personal information" under the *Privacy Act* is a dataset-level question that requires legal review; this file records the obligation, not the determination.

## Product policy enforced from this inventory

Some sources carry terms that do not permit the product to serve or
reproduce their material beyond strictly bounded forms. The inventory
records a `policy` block for those families, and the runtime enforces it in
[`packages/pipeline-core/src/shared/source-policy.ts`](./packages/pipeline-core/src/shared/source-policy.ts):

- `commercialUse: false` + `discoveryOnly: true` — discovery only in all tiers:
  metadata, short factual summaries, and links to the official source. No
  full-text reproduction; excluded from bulk export and paid API tiers.
- `linkOnly: true` — citations, metadata, and links only; content bodies are
  dropped and summaries are cut to a 300-character excerpt.
- `aggregateOnly: true` — the data is never linked or merged for entity
  resolution and never presented as identifying an individual, business, or
  organization; the required Statistics Canada notices ride with served records.
- `minimizePersonalInformation: true` — personal contact details and similar
  fields are minimized at the service boundary; individuals appear only in
  their public or professional capacity as published by the source.
- `notOfficialVersion: true` — every served record carries the
  "not an official version" notice (Reproduction of Federal Law Order).

Compliance is checked in CI by
[`scripts/gates/check-source-compliance.mjs`](./scripts/gates/check-source-compliance.mjs):
it fails when a source lacks a licence entry, when the runtime table drifts
from this inventory, when `commercialUse: false` is not paired with
discovery-only handling, or when the paid-tier enforcement hooks are removed.

To request a correction or removal of a personal-information record, email
privacy@maplespike.ca (see the privacy policy for the process).

Not legal advice.

## Complete source-family index (generated)

This index is generated from [`data-source-licenses.json`](./data-source-licenses.json). The notes above and in that file are review leads, not clearance.

<!-- BEGIN GENERATED SOURCE INDEX -->

| Source family | Publisher terms lead | Enforced policy |
| --- | --- | --- |
| `a2aj` | https://a2aj.ca/ | — |
| `ab-courts` | https://open.alberta.ca/licence | — |
| `ab-economic` | https://open.alberta.ca/licence | — |
| `ab-education` | https://open.alberta.ca/licence | — |
| `ab-energy-regulator` | https://open.alberta.ca/licence | — |
| `ab-health` | https://open.alberta.ca/licence | — |
| `ab-immigration` | https://open.alberta.ca/licence | — |
| `ab-infrastructure` | https://open.alberta.ca/licence | — |
| `agriculture` | https://open.canada.ca/en/open-government-licence-canada | — |
| `ati` | https://open.canada.ca/en/open-government-licence-canada | — |
| `attestation` | https://quill.maplespike.ca/ | — |
| `au-abs` | https://www.abs.gov.au/about/legislation-and-policy/copyright | — |
| `bank-of-canada` | https://www.bankofcanada.ca/terms/ | — |
| `bc-assessment` | https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc | — |
| `bc-corporate-registry` | https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc | — |
| `bc-courts` | https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc | — |
| `bc-economic` | https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc | — |
| `bc-education` | https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc | — |
| `bc-health` | https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc | — |
| `bc-immigration` | https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc | — |
| `bc-infrastructure` | https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc | — |
| `bc-translink` | https://www.translink.ca/about-us/doing-business-with-translink/open-data | — |
| `calgary-transit` | https://data.calgary.ca/terms | — |
| `canlii` | https://www.canlii.org/info/terms.html | link-only |
| `cipo` | https://ised-isde.canada.ca/site/canadian-intellectual-property-office/en | — |
| `cmhc` | https://www.cmhc-schl.gc.ca/copyright | — |
| `committees` | https://open.canada.ca/en/open-government-licence-canada | non-commercial, discovery-only |
| `corporate` | https://open.canada.ca/en/open-government-licence-canada | — |
| `corporate-filings` | https://open.canada.ca/en/open-government-licence-canada | — |
| `cra-charity` | https://www.canada.ca/en/revenue-agency/services/charities-giving/charities-listings.html | pii-minimized |
| `criminal-justice` | https://open.canada.ca/en/open-government-licence-canada | — |
| `cross-reference` | _no single terms URL recorded — see the source family note_ | — |
| `crown-corporations` | _no single terms URL recorded — see the source family note_ | — |
| `crtc` | https://open.canada.ca/en/open-government-licence-canada | — |
| `culture` | https://open.canada.ca/en/open-government-licence-canada | — |
| `defence` | https://open.canada.ca/en/open-government-licence-canada | — |
| `edmonton-budget` | https://data.edmonton.ca/terms | — |
| `edmonton-transit` | https://data.edmonton.ca/terms | — |
| `education-research` | https://open.canada.ca/en/open-government-licence-canada | — |
| `elections` | https://www.elections.ca/content.aspx?section=pol&dir=can&document=index&lang=e | — |
| `emergency-management` | _no single terms URL recorded — see the source family note_ | — |
| `energy` | https://open.canada.ca/en/open-government-licence-canada | — |
| `eurostat` | https://ec.europa.eu/eurostat/about-us/policies/copyright | — |
| `fao-faostat` | https://www.fao.org/contact-us/terms/en/ | — |
| `federal` | https://open.canada.ca/en/open-government-licence-canada | — |
| `federal-auditor-general` | https://www.oag-bvg.gc.ca/internet/English/terms_e_373.html | — |
| `federal-budget` | https://open.canada.ca/en/open-government-licence-canada | — |
| `federal-grants` | https://open.canada.ca/en/open-government-licence-canada | — |
| `federal-immigration-irb` | https://www.irb-cisr.gc.ca/en/legal-policy/Pages/terms.aspx | — |
| `federal-lobbying-monthly` | https://open.canada.ca/en/open-government-licence-canada | pii-minimized |
| `federal-parliamentary-budget` | https://www.pbo-dpb.ca/en/copyright | — |
| `federal-privacy-commissioner` | https://www.priv.gc.ca/en/terms/ | — |
| `federal-procurement` | https://open.canada.ca/en/open-government-licence-canada | — |
| `federal-tribunals` | _no single terms URL recorded — see the source family note_ | — |
| `financial-regulation` | https://open.canada.ca/en/open-government-licence-canada | — |
| `fire-emergency` | _no single terms URL recorded — see the source family note_ | — |
| `fisheries` | https://open.canada.ca/en/open-government-licence-canada | — |
| `gazette` | https://www.canada.ca/en/canadian-heritage/services/crown-copyright-request.html | not-official-version |
| `gc-standards` | https://open.canada.ca/en/open-government-licence-canada | — |
| `geospatial` | https://open.canada.ca/en/open-government-licence-canada | — |
| `gic` | https://open.canada.ca/en/open-government-licence-canada | — |
| `global-canada` | https://www.international.gc.ca/transparency-transparence/terms-conditions.aspx?lang=eng | — |
| `goc-spending` | https://open.canada.ca/en/open-government-licence-canada | — |
| `gtfs-transit` | _no single terms URL recorded — see the source family note_ | — |
| `health-canada` | https://open.canada.ca/en/open-government-licence-canada | — |
| `health-data` | _no single terms URL recorded — see the source family note_ | — |
| `housing-data` | https://www.cmhc-schl.gc.ca/copyright | — |
| `ilo-labour` | https://www.ilo.org/global/copyright/lang--en/index.htm | — |
| `immigration` | https://open.canada.ca/en/open-government-licence-canada | — |
| `impact-assessment` | https://www.canada.ca/en/impact-assessment-agency/corporate/terms-conditions.html | — |
| `indigenous-demographics` | _no single terms URL recorded — see the source family note_ | — |
| `indigenous-financial-transparency` | _no single terms URL recorded — see the source family note_ | — |
| `indigenous-land-claims` | _no single terms URL recorded — see the source family note_ | — |
| `indigenous-relations` | _no single terms URL recorded — see the source family note_ | — |
| `indigenous-services-directory` | _no single terms URL recorded — see the source family note_ | — |
| `influence` | https://open.canada.ca/en/open-government-licence-canada | pii-minimized |
| `ircc` | https://open.canada.ca/en/open-government-licence-canada | — |
| `ircc-family-sponsorship` | https://open.canada.ca/en/open-government-licence-canada | — |
| `isc` | https://open.canada.ca/en/open-government-licence-canada | — |
| `isc-programs` | https://open.canada.ca/en/open-government-licence-canada | — |
| `legislation` | https://ised-isde.canada.ca/site/canadian-intellectual-property-office/en/guide-copyright | not-official-version |
| `library` | _no single terms URL recorded — see the source family note_ | — |
| `lmia` | https://open.canada.ca/en/open-government-licence-canada | — |
| `mb-budget` | https://www.gov.mb.ca/openmb/terms.html | — |
| `mb-education` | https://www.gov.mb.ca/openmb/terms.html | — |
| `mb-health` | https://www.gov.mb.ca/openmb/terms.html | — |
| `mb-hydro` | https://www.gov.mb.ca/openmb/terms.html | — |
| `mb-labour` | https://www.gov.mb.ca/openmb/terms.html | — |
| `mb-mpi` | https://www.mpi.mb.ca/terms-of-use/ | — |
| `media-broadcasting` | _no single terms URL recorded — see the source family note_ | link-only |
| `montreal-council` | https://donnees.montreal.ca/licence | — |
| `municipal` | _no single terms URL recorded — see the source family note_ | — |
| `municipal-long-tail` | _no single terms URL recorded — see the source family note_ | — |
| `municipal-portals` | _no single terms URL recorded — see the source family note_ | — |
| `nb-education` | https://www2.gnb.ca/content/gnb/en/departments/finance/open_data.html | — |
| `nb-energy` | https://www2.gnb.ca/content/gnb/en/departments/finance/open_data.html | — |
| `nb-health` | https://www2.gnb.ca/content/gnb/en/departments/finance/open_data.html | — |
| `nb-labour` | https://www2.gnb.ca/content/gnb/en/departments/finance/open_data.html | — |
| `ngo-influence-rss` | _no single terms URL recorded — see the source family note_ | link-only |
| `nl-budget` | https://opendata.gov.nl.ca/public/opendata/page/?page-id=licence | — |
| `nl-education` | https://opendata.gov.nl.ca/public/opendata/page/?page-id=licence | — |
| `nl-energy` | https://opendata.gov.nl.ca/public/opendata/page/?page-id=licence | — |
| `nl-health` | https://opendata.gov.nl.ca/public/opendata/page/?page-id=licence | — |
| `npri` | https://open.canada.ca/en/open-government-licence-canada | — |
| `nrcan` | https://open.canada.ca/en/open-government-licence-canada | — |
| `ns-budget` | https://data.novascotia.ca/terms | — |
| `ns-education` | https://data.novascotia.ca/terms | — |
| `ns-health` | https://data.novascotia.ca/terms | — |
| `ns-labour` | https://data.novascotia.ca/terms | — |
| `nt-health-social` | https://www.gov.nt.ca/en/legal | — |
| `nt-open-government` | https://www.gov.nt.ca/en/legal | — |
| `nu-bureau-statistics` | https://www.gov.nu.ca/en | — |
| `nu-statcan` | https://www.statcan.gc.ca/en/terms-conditions/open-licence | aggregate-only |
| `nz-stats` | https://www.stats.govt.nz/about-us/copyright/ | — |
| `oecd` | https://www.oecd.org/en/about/terms-conditions.html | — |
| `oecd-stat` | https://www.oecd.org/en/about/terms-conditions.html | — |
| `on-courts` | https://www.ontario.ca/page/ontario-open-data-terms-use | — |
| `on-economic` | https://www.ontario.ca/page/ontario-open-data-terms-use | — |
| `on-education` | https://www.ontario.ca/page/ontario-open-data-terms-use | — |
| `on-health` | https://www.ontario.ca/page/ontario-open-data-terms-use | — |
| `on-immigration` | https://www.ontario.ca/page/ontario-open-data-terms-use | — |
| `on-infrastructure` | https://www.ontario.ca/page/ontario-open-data-terms-use | — |
| `ontario-land-registry` | https://www.ontario.ca/page/ontario-open-data-terms-use | — |
| `ontario-lobbying` | https://www.ontario.ca/page/ontario-open-data-terms-use | pii-minimized |
| `ontario-provincial` | https://www.ontario.ca/page/ontario-open-data-terms-use | — |
| `ontario-securities-commission` | https://www.osc.ca/en/about-us/terms-use | — |
| `opencorporates` | https://opencorporates.com/terms | — |
| `openparliament` | https://www.ourcommons.ca/en/important-notices | non-commercial, discovery-only |
| `ottawa-oc-transpo` | https://open.ottawa.ca/pages/open-data-licence | — |
| `oversight` | _no single terms URL recorded — see the source family note_ | — |
| `parks` | _no single terms URL recorded — see the source family note_ | — |
| `parliamentary-voting` | https://www.ourcommons.ca/en/open-data | non-commercial, discovery-only |
| `pe-agriculture` | https://www.princeedwardisland.ca/en/information/finance/open-data | — |
| `pe-budget` | https://www.princeedwardisland.ca/en/information/finance/open-data | — |
| `pe-education` | https://www.princeedwardisland.ca/en/information/finance/open-data | — |
| `pe-health` | https://www.princeedwardisland.ca/en/information/finance/open-data | — |
| `pharmaceuticals` | https://open.canada.ca/en/open-government-licence-canada | — |
| `police-data` | _no single terms URL recorded — see the source family note_ | — |
| `policing-security` | _no single terms URL recorded — see the source family note_ | — |
| `political-donations` | https://www.elections.ca/content.aspx?section=pol&dir=can&document=index&lang=e | pii-minimized |
| `proactive-disclosure` | https://open.canada.ca/en/open-government-licence-canada | — |
| `provincial` | _no single terms URL recorded — see the source family note_ | — |
| `provincial-legislatures` | _no single terms URL recorded — see the source family note_ | — |
| `provincial-lobbying` | _no single terms URL recorded — see the source family note_ | pii-minimized |
| `provincial-orgs` | _no single terms URL recorded — see the source family note_ | — |
| `provincial-regulators` | _no single terms URL recorded — see the source family note_ | — |
| `public-accounts` | https://open.canada.ca/en/open-government-licence-canada | — |
| `qc-courts` | https://www.donneesquebec.ca/licence/ | — |
| `qc-economic` | https://www.donneesquebec.ca/licence/ | — |
| `qc-education` | https://www.donneesquebec.ca/licence/ | — |
| `qc-health` | https://www.donneesquebec.ca/licence/ | — |
| `qc-immigration` | https://www.donneesquebec.ca/licence/ | — |
| `qc-infrastructure` | https://www.donneesquebec.ca/licence/ | — |
| `quebec-lobbying` | https://www.donneesquebec.ca/licence/ | pii-minimized |
| `real-estate` | _no single terms URL recorded — see the source family note_ | — |
| `real-time-feeds` | _no single terms URL recorded — see the source family note_ | — |
| `regional-authorities` | _no single terms URL recorded — see the source family note_ | — |
| `science-research` | _no single terms URL recorded — see the source family note_ | — |
| `sedar-plus` | https://www.sedarplus.ca/ | link-only |
| `sedi` | https://www.sedi.ca/ | link-only |
| `sk-agriculture` | https://www.saskatchewan.ca/government/about-government/open-government | — |
| `sk-budget` | https://www.saskatchewan.ca/government/about-government/open-government | — |
| `sk-crown-corps` | _no single terms URL recorded — see the source family note_ | — |
| `sk-education` | https://www.saskatchewan.ca/government/about-government/open-government | — |
| `sk-health` | https://www.saskatchewan.ca/government/about-government/open-government | — |
| `sk-labour` | https://www.saskatchewan.ca/government/about-government/open-government | — |
| `social-programs` | _no single terms URL recorded — see the source family note_ | — |
| `species-at-risk` | https://open.canada.ca/en/open-government-licence-canada | — |
| `statcan` | https://www.statcan.gc.ca/en/terms-conditions/open-licence | aggregate-only |
| `telecommunications` | https://crtc.gc.ca/eng/terms.htm | — |
| `toronto-budget` | https://www.toronto.ca/city-government/data-research-maps/open-data/open-data-licence/ | — |
| `toronto-building-permits` | https://www.toronto.ca/city-government/data-research-maps/open-data/open-data-licence/ | — |
| `toronto-police` | https://www.toronto.ca/city-government/data-research-maps/open-data/open-data-licence/ | — |
| `transport-infrastructure` | https://open.canada.ca/en/open-government-licence-canada | — |
| `ttc` | https://open.toronto.ca/open-data-licence/ | — |
| `uk-hansard` | https://www.parliament.uk/site-information/copyright/ | — |
| `uk-ons` | https://www.ons.gov.uk/methodology/geography/licences | — |
| `un` | https://www.un.org/en/about-us/terms-of-use | — |
| `un-comtrade` | https://comtradeapi.un.org/ | — |
| `undp-hdi` | https://hdr.undp.org/terms-use | — |
| `undp-hdr` | https://hdr.undp.org/terms-use | — |
| `unesco-uis` | https://uis.unesco.org/en/copyright | — |
| `unhcr-refugee` | https://www.unhcr.org/terms-and-conditions | — |
| `unhcr-refugees` | https://www.unhcr.org/terms-and-conditions | — |
| `unions` | _no single terms URL recorded — see the source family note_ | — |
| `universities` | _no single terms URL recorded — see the source family note_ | — |
| `us-cia` | https://www.cia.gov/about/terms-of-use/ | — |
| `us-sec-edgar` | https://www.sec.gov/submit-filings/filer-support-resources/how-do-i-guides/understand-edgar | — |
| `utilities` | _no single terms URL recorded — see the source family note_ | — |
| `vancouver-council` | https://opendata.vancouver.ca/pages/licence | — |
| `veterans` | https://open.canada.ca/en/open-government-licence-canada | — |
| `who-gho` | https://www.who.int/about/policies/publishing/copyright | — |
| `winnipeg-budget` | https://data.winnipeg.ca/terms | — |
| `winnipeg-transit` | https://data.winnipeg.ca/terms | — |
| `worldbank-ids` | https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets | — |
| `worldbank-wdi` | https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets | — |
| `worldbank-wgi` | https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets | — |
| `yt-education` | https://yukon.ca/en/your-government/open-government/open-government-licence-yukon | — |
| `yt-energy-mines` | https://yukon.ca/en/your-government/open-government/open-government-licence-yukon | — |
| `yt-environment` | https://yukon.ca/en/your-government/open-government/open-government-licence-yukon | — |
| `yt-geological` | https://yukon.ca/en/your-government/open-government/open-government-licence-yukon | — |
| `yt-government` | https://yukon.ca/en/your-government/open-government/open-government-licence-yukon | — |
| `yt-health` | https://yukon.ca/en/your-government/open-government/open-government-licence-yukon | — |
| `yt-statistics` | https://yukon.ca/en/your-government/open-government/open-government-licence-yukon | — |

<!-- END GENERATED SOURCE INDEX -->

## Maintenance

- Regenerate the index: `node scripts/generate-data-licenses.mjs`.
- Verify (drift + invariants + required notices): `node --test scripts/test-data-licenses.mjs`.
- Gate (CI + `pnpm run test:source-compliance`): `node scripts/gates/check-source-compliance.mjs` — fails when a source lacks a licence entry, when the runtime policy table drifts from this inventory, or when the paid-tier enforcement hooks are removed.
- The publisher-group table, notices, and personal-information sections are reviewed manually. Every edit is a compliance change: re-read the licence text, then update `packages/portal/src/lib/attribution-notices.ts` and its tests together with the portal pages.
