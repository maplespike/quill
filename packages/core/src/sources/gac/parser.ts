import { z } from "zod";
import { GACProjectSchema } from "../../schemas";
import type {
	GACProject,
	GACProjectStatus,
	GovernmentSource,
	ImplementingPartner,
} from "../../types";
import type {
	ParseError,
	ParseMetadata,
	ParseResult,
	ParserConfig,
} from "../types";
import {
	extractXmlFields,
	extractXmlRecords,
	generateId,
	normalizeName,
	nowISO,
	parseCsvToObjects,
	parseNumber,
} from "../types";

/**
 * GAC International Parser — handles Global Affairs Canada project data.
 * Parses GAC Project Browser CSV exports and IATI standard XML.
 */
export class GACParser {
	private config: ParserConfig;

	constructor(config?: Partial<ParserConfig>) {
		this.config = {
			source: "gac_projects",
			maxRows: 0,
			skipErrors: true,
			timestamp: nowISO(),
			...config,
		};
	}

	/**
	 * Parse GAC Project Browser CSV.
	 * Expected columns: project_id, title, description, department, country,
	 * region, budget, start_date, end_date, status, implementing_partners, sector
	 */
	parseProjectBrowser(csvData: string): ParseResult<GACProject> {
		const errors: ParseError[] = [];
		const data: GACProject[] = [];
		const rows = parseCsvToObjects(csvData);
		const maxRows = this.config.maxRows || Infinity;
		const timestamp = this.config.timestamp || nowISO();

		for (let i = 0; i < rows.length && data.length < maxRows; i++) {
			const row = rows[i];
			const rowNum = i + 2;

			try {
				const project = this.normalizeProject(row);
				const validated = GACProjectSchema.parse(project);
				data.push(validated as GACProject);
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
	 * Parse IATI standard XML for GAC projects.
	 * IATI uses <iati-activity> elements with nested <participating-org> tags.
	 */
	parseIATIXml(xmlData: string): ParseResult<GACProject> {
		const errors: ParseError[] = [];
		const data: GACProject[] = [];
		const timestamp = this.config.timestamp || nowISO();
		const records = extractXmlRecords(xmlData, "iati-activity");

		for (let i = 0; i < records.length; i++) {
			const fragment = records[i];
			const rowNum = i + 1;

			try {
				const project = this.normalizeIATIProject(fragment);
				const validated = GACProjectSchema.parse(project);
				data.push(validated as GACProject);
			} catch (err) {
				const message =
					err instanceof z.ZodError
						? err.issues
								.map((e) => `${e.path.join(".")}: ${e.message}`)
								.join("; ")
						: String(err);
				errors.push({
					row: rowNum,
					message,
					rawValue: fragment.substring(0, 200),
				});
				if (!this.config.skipErrors) break;
			}
		}

		const metadata: ParseMetadata = {
			source: this.config.source as GovernmentSource,
			count: data.length,
			timestamp,
			format: "xml",
			totalRows: records.length,
		};

		return { data, errors, metadata };
	}

	private normalizeProject(row: Record<string, string>): GACProject {
		const now = nowISO();
		const partners = parseImplementingPartners(row.implementing_partners);

		return {
			id: generateId(),
			source: "gac_projects",
			rawData: row as Record<string, unknown>,
			createdAt: now,
			updatedAt: now,
			projectId: (row.project_id ?? "").trim(),
			title: (row.title ?? "").trim(),
			description: (row.description ?? "").trim(),
			department: (row.department ?? "Global Affairs Canada").trim(),
			country: (row.country ?? "").trim(),
			region: (row.region ?? "").trim(),
			budget: parseNumber(row.budget),
			currency: "CAD",
			startDate: row.start_date?.trim() ?? "",
			endDate: row.end_date?.trim() || undefined,
			status: mapGACStatus(row.status),
			implementingPartners: partners,
			sector: row.sector?.trim() || undefined,
		};
	}

	private normalizeIATIProject(fragment: string): GACProject {
		const now = nowISO();
		const get = (tag: string) => {
			const fields = extractXmlFields(fragment, tag);
			return fields[0] ?? "";
		};

		// Extract IATI identifiers
		const iatiIdentifier = get("iati-identifier");
		const title = get("title");
		const description = get("description");

		// Extract recipient countries
		const countries = extractXmlFields(fragment, "recipient-country");
		const country = countries[0]?.trim() ?? "";

		// Extract budget
		const budget = parseNumber(get("value"));

		// Extract dates
		const startDate = get("activity-date");
		const endDate = get("end-date");

		// Extract implementing partners from participating-org tags
		const partners = extractIATIPartners(fragment);

		return {
			id: generateId(),
			source: "gac_projects",
			rawData: { iatiXml: fragment.substring(0, 500) },
			createdAt: now,
			updatedAt: now,
			projectId: iatiIdentifier || generateId(),
			title,
			description,
			department: "Global Affairs Canada",
			country,
			region: mapRegion(country),
			budget,
			currency: "CAD",
			startDate: startDate,
			endDate: endDate || undefined,
			status: "active" as GACProjectStatus,
			implementingPartners: partners,
			sector: get("sector") || undefined,
		};
	}
}

/** Map GAC project status */
function mapGACStatus(raw?: string): GACProjectStatus {
	if (!raw) return "active";
	const lower = raw.toLowerCase().trim();
	if (lower.includes("complet") || lower.includes("closed")) return "completed";
	if (lower.includes("cancel")) return "cancelled";
	if (lower.includes("pipeline") || lower.includes("planned"))
		return "pipeline";
	if (lower.includes("suspend")) return "suspended";
	return "active";
}

/** Map country to region */
function mapRegion(country: string): string {
	const regionMap: Record<string, string> = {
		Ukraine: "Europe",
		Bangladesh: "South Asia",
		Ethiopia: "Sub-Saharan Africa",
		Mozambique: "Sub-Saharan Africa",
		Jordan: "Middle East",
		Colombia: "Latin America",
		Haiti: "Latin America",
		Indonesia: "Southeast Asia",
		Philippines: "Southeast Asia",
		Kenya: "Sub-Saharan Africa",
		Nigeria: "Sub-Saharan Africa",
		Ghana: "Sub-Saharan Africa",
		Senegal: "Sub-Saharan Africa",
		Mali: "Sub-Saharan Africa",
		Tanzania: "Sub-Saharan Africa",
		Afghanistan: "South Asia",
		Palestine: "Middle East",
		Lebanon: "Middle East",
		Iraq: "Middle East",
		Bolivia: "Latin America",
		Peru: "Latin America",
		Vietnam: "Southeast Asia",
		Myanmar: "Southeast Asia",
		Cambodia: "Southeast Asia",
	};
	return regionMap[country] ?? "Other";
}

/** Parse semicolon-separated implementing partners from CSV */
function parseImplementingPartners(raw?: string): ImplementingPartner[] {
	if (!raw) return [];
	return raw
		.split(";")
		.map((entry) => {
			const parts = entry.split("|").map((s) => s.trim());
			return {
				name: normalizeName(parts[0] ?? ""),
				country: parts[1] ?? "Canada",
				role: parts[2] ?? "Implementing Partner",
			};
		})
		.filter((p) => p.name.length > 0);
}

/** Extract implementing partners from IATI XML participating-org elements */
function extractIATIPartners(fragment: string): ImplementingPartner[] {
	const partners: ImplementingPartner[] = [];
	const records = extractXmlRecords(fragment, "participating-org");

	for (const record of records) {
		const name = record.trim();
		if (name) {
			partners.push({
				name: normalizeName(name),
				country: "International",
				role: "Implementing Partner",
			});
		}
	}

	return partners;
}
