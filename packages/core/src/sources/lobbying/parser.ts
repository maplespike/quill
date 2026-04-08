import { z } from "zod";
import {
	LobbyingCommunicationSchema,
	LobbyingFilingSchema,
} from "../../schemas";
import type {
	GovernmentSource,
	LobbyingCommunication,
	LobbyingFiling,
	Lobbyist,
} from "../../types";
import type {
	ParseError,
	ParseMetadata,
	ParseResult,
	ParserConfig,
} from "../types";
import { generateId, normalizeName, nowISO, parseCsvToObjects } from "../types";

/**
 * Lobbying Parser — handles Commissioner of Lobbying of Canada data.
 * Parses registration CSVs and monthly communication reports.
 */
export class LobbyingParser {
	private config: ParserConfig;

	constructor(config?: Partial<ParserConfig>) {
		this.config = {
			source: "lobbying_commissioner",
			maxRows: 0,
			skipErrors: true,
			timestamp: nowISO(),
			...config,
		};
	}

	/**
	 * Parse lobbying registration CSVs from the Commissioner of Lobbying.
	 * Expected columns: filing_number, registrant_name, registrant_firm,
	 * client_name, subject_matter, start_date, end_date, activities,
	 * institution, province
	 */
	parseRegistrations(csvData: string): ParseResult<LobbyingFiling> {
		const errors: ParseError[] = [];
		const data: LobbyingFiling[] = [];
		const rows = parseCsvToObjects(csvData);
		const maxRows = this.config.maxRows || Infinity;
		const timestamp = this.config.timestamp || nowISO();

		for (let i = 0; i < rows.length && data.length < maxRows; i++) {
			const row = rows[i];
			const rowNum = i + 2;

			try {
				const filing = this.normalizeRegistration(row);
				const validated = LobbyingFilingSchema.parse(filing);
				data.push(validated as LobbyingFiling);
			} catch (err) {
				const message =
					err instanceof z.ZodError
						? err.issues
								.map((e) => `${e.path.join(".")}: ${e.message}`)
								.join("; ")
						: String(err);
				errors.push({ row: rowNum, message, rawValue: row });
				if (!this.config.skipErrors) break;
			}
		}

		const metadata: ParseMetadata = {
			source: this.config.source as GovernmentSource,
			count: data.length,
			timestamp,
			format: "csv",
			totalRows: rows.length,
		};

		return { data, errors, metadata };
	}

	/**
	 * Parse monthly communication report CSVs.
	 * Expected columns: filing_number, communication_date, communication_type,
	 * subject_matter, officials, institution
	 */
	parseCommunications(csvData: string): ParseResult<LobbyingCommunication> {
		const errors: ParseError[] = [];
		const data: LobbyingCommunication[] = [];
		const rows = parseCsvToObjects(csvData);
		const maxRows = this.config.maxRows || Infinity;
		const timestamp = this.config.timestamp || nowISO();

		for (let i = 0; i < rows.length && data.length < maxRows; i++) {
			const row = rows[i];
			const rowNum = i + 2;

			try {
				const comm = this.normalizeCommunication(row);
				const validated = LobbyingCommunicationSchema.parse(comm);
				data.push(validated as LobbyingCommunication);
			} catch (err) {
				const message =
					err instanceof z.ZodError
						? err.issues
								.map((e) => `${e.path.join(".")}: ${e.message}`)
								.join("; ")
						: String(err);
				errors.push({ row: rowNum, message, rawValue: row });
				if (!this.config.skipErrors) break;
			}
		}

		const metadata: ParseMetadata = {
			source: this.config.source as GovernmentSource,
			count: data.length,
			timestamp,
			format: "csv",
			totalRows: rows.length,
		};

		return { data, errors, metadata };
	}

	private normalizeRegistration(row: Record<string, string>): LobbyingFiling {
		const now = nowISO();
		const registrant: Lobbyist = {
			name: normalizeName(row.registrant_name ?? ""),
			firmName: row.registrant_firm?.trim() || undefined,
		};

		return {
			id: generateId(),
			source: "lobbying_commissioner",
			rawData: row as Record<string, unknown>,
			createdAt: now,
			updatedAt: now,
			filingNumber: (row.filing_number ?? "").trim(),
			registrant,
			clientName: normalizeName(row.client_name ?? ""),
			clientOrganizationId: row.client_org_id?.trim() || undefined,
			subjectMatter: (row.subject_matter ?? "").trim(),
			communications: parseCommunicationList(row.communications),
			startDate: row.start_date?.trim() ?? "",
			endDate: row.end_date?.trim() ?? "",
			activities: parseActivities(row.activities),
			institution: (row.institution ?? "").trim(),
			province: row.province?.trim() || undefined,
		};
	}

	private normalizeCommunication(
		row: Record<string, string>,
	): LobbyingCommunication {
		return {
			date: row.communication_date?.trim() ?? "",
			type: mapCommunicationType(row.communication_type),
			subjectMatter: (row.subject_matter ?? "").trim(),
			officials: parseOfficials(row.officials),
			institution: (row.institution ?? "").trim(),
		};
	}
}

/** Map communication type from various formats */
function mapCommunicationType(raw?: string): LobbyingCommunication["type"] {
	if (!raw) return "other";
	const lower = raw.toLowerCase().trim();
	if (lower.includes("meeting") || lower.includes("in-person"))
		return "meeting";
	if (
		lower.includes("phone") ||
		lower.includes("call") ||
		lower.includes("teleconf")
	)
		return "call";
	if (lower.includes("email") || lower.includes("electronic")) return "email";
	if (lower.includes("letter") || lower.includes("written")) return "letter";
	if (lower.includes("conference") || lower.includes("event"))
		return "conference";
	return "other";
}

/** Parse semicolon-separated activities */
function parseActivities(raw?: string): string[] {
	if (!raw) return [];
	return raw
		.split(";")
		.map((a) => a.trim())
		.filter(Boolean);
}

/** Parse semicolon-separated communication entries */
function parseCommunicationList(raw?: string): LobbyingCommunication[] {
	if (!raw) return [];
	return raw.split(";").map((entry) => ({
		date: "",
		type: "other" as const,
		subjectMatter: entry.trim(),
		officials: [],
		institution: "",
	}));
}

/** Parse pipe-separated officials list */
function parseOfficials(raw?: string): string[] {
	if (!raw) return [];
	return raw
		.split("|")
		.map((o) => normalizeName(o))
		.filter(Boolean);
}
