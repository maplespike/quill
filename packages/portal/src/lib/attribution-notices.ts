/**
 * Attribution notices shared across portal surfaces (site footer, the
 * /data-sources page, and their tests).
 *
 * These strings mirror statements required by the licences that cover sources
 * Quill ingests, plus the disclaimers this site carries. They are deliberately
 * kept in one module so the footer, the data-sources page, and the tests all
 * assert the same wording.
 *
 * This file is not legal advice. A change to a licence statement or required
 * notice is a compliance change: re-read the licence text, then update
 * DATA-LICENSES.md, docs/licensing-audit.md, and the tests together.
 */

/** OGL–Canada required attribution statement, official EN wording. */
export const OGL_CANADA_ATTRIBUTION_STATEMENT =
  'Contains information licensed under the Open Government Licence – Canada.';

/** OGL–Canada required attribution statement, official FR wording. */
export const OGL_CANADA_ATTRIBUTION_STATEMENT_FR =
  "Contient de l'information visée par la Licence du gouvernement ouvert – Canada.";

export const OGL_CANADA_LICENCE_URL =
  'https://open.canada.ca/en/open-government-licence-canada';

/** Lobbying registry open data licence, official attribution statement. */
export const LOBBYING_ODLA_ATTRIBUTION_STATEMENT =
  'Contains information licensed under the Open Data Licence Agreement — Office of the Commissioner of Lobbying.';

export const LOBBYING_ODLA_LICENCE_URL =
  'https://lobbycanada.gc.ca/en/open-data/open-data-licence-agreement/';

/** Statistics Canada Open Licence source notices, official wording. */
export const STATCAN_SOURCE_NOTICE =
  'Source: Statistics Canada, name of product, reference date. Reproduced and distributed on an "as is" basis with the permission of Statistics Canada.';
export const STATCAN_ADAPTED_NOTICE =
  'Adapted from Statistics Canada, name of product, reference date. This does not constitute an endorsement by Statistics Canada of this product.';
export const STATCAN_LICENCE_URL =
  'https://www.statcan.gc.ca/en/reference/licence';

/** House of Commons — Privacy, copyrights, disclaimers and important notices. */
export const HOC_TERMS_URL = 'https://www.ourcommons.ca/en/important-notices';

/** Senate of Canada — Intellectual property / reproduction permission. */
export const SENATE_IP_URL = 'https://sencanada.ca/en/intellectual-property';
export const SENATE_REPRODUCTION_URL =
  'https://sencanada.ca/en/important-notices/permission-regarding-reproduction/';

/** Reproduction of Federal Law Order (SI/97-5). */
export const RFLO_URL =
  'https://laws-lois.justice.gc.ca/eng/regulations/SI-97-5/FullText.html';

/** Government of Canada website terms (non-commercial / commercial reproduction). */
export const CANADA_TERMS_URL = 'https://www.canada.ca/en/transparency/terms.html';

/** Site-wide disclaimers. */
export const NON_ENDORSEMENT_DISCLAIMER =
  'Not affiliated with or endorsed by the Government of Canada.';
export const NON_ENDORSEMENT_DISCLAIMER_FR =
  "N'est pas affilié au gouvernement du Canada ni approuvé par celui-ci.";

/** Inline pointer shown next to attribution text. */
export const DATA_SOURCES_PATH = '/data-sources';
