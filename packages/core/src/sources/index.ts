/**
 * CivicIntel Data Source Parsers
 *
 * Each parser handles a specific Canadian government data source:
 * - spending: CanadaBuys proactive disclosures + PSPC tender notices
 * - lobbying: Commissioner of Lobbying registrations + communications
 * - gac: Global Affairs Canada project browser + IATI XML
 * - ciec: CIEC disclosures + Elections Canada contributions
 */

export type { DisclosureSummary, DonorSummary, RecipientSummary } from "./ciec";
export { CIECParser } from "./ciec";
export type { CountrySummary, PartnerSummary } from "./gac";
export { GACParser } from "./gac";
export type {
	ClientSummary,
	LobbyistSummary,
	OfficialSummary,
} from "./lobbying";
export { LobbyingParser } from "./lobbying";
export type { DepartmentSummary, VendorSummary } from "./spending";
export { SpendingParser } from "./spending";

export type {
	ParseError,
	ParseMetadata,
	ParseResult,
	ParserConfig,
	SweepResult,
} from "./types";
export {
	extractXmlAttributes,
	extractXmlFields,
	extractXmlRecords,
	generateId,
	normalizeDate,
	normalizeName,
	nowISO,
	parseCsv,
	parseCsvToObjects,
	parseNumber,
} from "./types";
