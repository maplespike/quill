import { z } from "zod";
import { DisclosureSchema, DonationSchema } from "../../schemas";
import type {
	Disclosure,
	Donation,
	GovernmentSource,
	Interest,
	InterestCategory,
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
	parseNumber,
} from "../types";

/**
 * CIEC + Elections Canada Parser.
 * Handles:
 * - Commissioner of Information and Ethics Canada (CIEC) public disclosure summaries (HTML)
 * - Elections Canada bulk contribution data (XML)
 */
export class CIECParser {
	private config: ParserConfig;

	constructor(config?: Partial<ParserConfig>) {
		this.config = {
			source: "disclosure_clerk",
			maxRows: 0,
			skipErrors: true,
			timestamp: nowISO(),
			...config,
		};
	}

	/**
	 * Parse CIEC public disclosure summary HTML.
	 * Extracts structured disclosure data from the public summary pages.
	 * Input is simplified HTML with predictable structure.
	 */
	parseDisclosureSummary(html: string): ParseResult<Disclosure> {
		const errors: ParseError[] = [];
		const data: Disclosure[] = [];
		const timestamp = this.config.timestamp || nowISO();

		// Extract disclosure blocks from HTML
		const disclosureBlocks = extractDisclosureBlocks(html);

		for (let i = 0; i < disclosureBlocks.length; i++) {
			const block = disclosureBlocks[i];
			const rowNum = i + 1;

			try {
				const disclosure = this.normalizeDisclosure(block);
				const validated = DisclosureSchema.parse(disclosure);
				data.push(validated as Disclosure);
			} catch (err) {
				const message =
					err instanceof z.ZodError
						? err.issues
								.map((e) => `${e.path.join(".")}: ${e.message}`)
								.join("; ")
						: String(err);
				errors.push({ row: rowNum, message, rawValue: block });
				if (!this.config.skipErrors) break;
			}
		}

		const metadata: ParseMetadata = {
			source: "disclosure_clerk" as GovernmentSource,
			count: data.length,
			timestamp,
			format: "html",
			totalRows: disclosureBlocks.length,
		};

		return { data, errors, metadata };
	}

	/**
	 * Parse Elections Canada bulk contribution XML.
	 * Expected structure: <contributions><contribution>...</contribution></contributions>
	 */
	parseContributions(xmlData: string): ParseResult<Donation> {
		const errors: ParseError[] = [];
		const data: Donation[] = [];
		const timestamp = this.config.timestamp || nowISO();
		const records = extractXmlRecords(xmlData, "contribution");

		for (let i = 0; i < records.length; i++) {
			const fragment = records[i];
			const rowNum = i + 1;

			try {
				const donation = this.normalizeDonation(fragment);
				const validated = DonationSchema.parse(donation);
				data.push(validated as Donation);
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
			source: "elections_canada" as GovernmentSource,
			count: data.length,
			timestamp,
			format: "xml",
			totalRows: records.length,
		};

		return { data, errors, metadata };
	}

	private normalizeDisclosure(block: DisclosureBlock): Disclosure {
		const now = nowISO();

		return {
			id: generateId(),
			source: "disclosure_clerk",
			rawData: block as unknown as Record<string, unknown>,
			createdAt: now,
			updatedAt: now,
			personName: normalizeName(block.personName),
			personId: block.personId || undefined,
			position: block.position,
			department: block.department,
			year: block.year,
			interests: block.interests,
			province: block.province || undefined,
			filingDate: block.filingDate,
		};
	}

	private normalizeDonation(fragment: string): Donation {
		const now = nowISO();
		const get = (tag: string) => {
			const fields = extractXmlFields(fragment, tag);
			return fields[0] ?? "";
		};

		const donorType = get("donor_type");
		const isCorporate =
			donorType.toLowerCase().includes("corporat") ||
			donorType.toLowerCase().includes("union") ||
			donorType.toLowerCase().includes("organization");

		return {
			id: generateId(),
			source: "elections_canada",
			rawData: { xmlFragment: fragment.substring(0, 500) },
			createdAt: now,
			updatedAt: now,
			donorName: normalizeName(get("donor_name")),
			donorPersonId: get("donor_person_id") || undefined,
			donorOrganizationId: get("donor_org_id") || undefined,
			recipientName: get("recipient_name"),
			recipientType: mapRecipientType(get("recipient_type")),
			amount: parseNumber(get("amount")),
			currency: "CAD",
			date: get("date"),
			province: get("province") || undefined,
			riding: get("riding") || undefined,
			isCorporate,
		};
	}
}

/** Internal representation of a parsed HTML disclosure block */
interface DisclosureBlock {
	personName: string;
	personId?: string;
	position: string;
	department: string;
	year: number;
	interests: Interest[];
	province?: string;
	filingDate: string;
}

/**
 * Extract disclosure blocks from simplified HTML.
 * Looks for <div class="disclosure"> blocks with structured child elements.
 */
function extractDisclosureBlocks(html: string): DisclosureBlock[] {
	const blocks: DisclosureBlock[] = [];

	// Extract records between disclosure tags
	const disclosureRegex =
		/<div[^>]*class="disclosure"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="disclosure"|$)/gi;
	let match: RegExpExecArray | null;

	while ((match = disclosureRegex.exec(html)) !== null) {
		const content = match[1];
		const block = parseDisclosureContent(content);
		if (block) blocks.push(block);
	}

	// Also try simpler table-row-like format
	if (blocks.length === 0) {
		const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
		while ((match = rowRegex.exec(html)) !== null) {
			const cells = match[1];
			const block = parseTableRowDisclosure(cells);
			if (block) blocks.push(block);
		}
	}

	return blocks;
}

/** Parse content from a disclosure div */
function parseDisclosureContent(content: string): DisclosureBlock | null {
	const getField = (label: string): string => {
		const regex = new RegExp(
			`<span[^>]*class="field"[^>]*data-name="${label}"[^>]*>([\\s\\S]*?)<\\/span>`,
			"i",
		);
		const m = regex.exec(content);
		return m ? m[1].trim() : "";
	};

	const personName = getField("person_name") || getField("name");
	if (!personName) return null;

	// Extract interests
	const interests = parseInterestsFromHtml(content);

	return {
		personName,
		personId: getField("person_id") || undefined,
		position: getField("position"),
		department: getField("department"),
		year: Number.parseInt(getField("year")) || new Date().getFullYear(),
		interests,
		province: getField("province") || undefined,
		filingDate: getField("filing_date") || getField("date"),
	};
}

/** Parse a table row into a disclosure block */
function parseTableRowDisclosure(cells: string): DisclosureBlock | null {
	const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
	const values: string[] = [];
	let cellMatch: RegExpExecArray | null;
	while ((cellMatch = cellRegex.exec(cells)) !== null) {
		values.push(cellMatch[1].trim());
	}

	// Expect: person_name, position, department, year, interests, province, filing_date
	if (values.length < 4) return null;

	return {
		personName: values[0],
		position: values[1],
		department: values[2],
		year: Number.parseInt(values[3]) || new Date().getFullYear(),
		interests: parseInterestsFromText(values[4] ?? ""),
		province: values[5] || undefined,
		filingDate: values[6] ?? "",
	};
}

/** Parse interests from HTML interest elements */
function parseInterestsFromHtml(content: string): Interest[] {
	const interests: Interest[] = [];
	const interestRegex = /<div[^>]*class="interest"[^>]*>([\s\S]*?)<\/div>/gi;
	let match: RegExpExecArray | null;

	while ((match = interestRegex.exec(content)) !== null) {
		const interestHtml = match[1];
		const catMatch = /data-category="([^"]*)"/i.exec(interestHtml);
		const descMatch = /data-description="([^"]*)"/i.exec(interestHtml);
		const valMatch = /data-value="([^"]*)"/i.exec(interestHtml);

		if (descMatch) {
			interests.push({
				category: mapInterestCategory(catMatch?.[1]),
				description: descMatch[1],
				value: valMatch?.[1],
			});
		}
	}

	return interests;
}

/** Parse interests from pipe-separated text */
function parseInterestsFromText(text: string): Interest[] {
	if (!text) return [];
	return text
		.split("|")
		.map((entry) => {
			const parts = entry.split(";").map((s) => s.trim());
			return {
				category: mapInterestCategory(parts[0]),
				description: parts[1] ?? parts[0],
				value: parts[2],
			};
		})
		.filter((i) => i.description);
}

/** Map raw interest category string to InterestCategory */
function mapInterestCategory(raw?: string): InterestCategory {
	if (!raw) return "other";
	const lower = raw.toLowerCase().trim();
	if (lower.includes("real property") || lower.includes("property"))
		return "real_property";
	if (
		lower.includes("securities") ||
		lower.includes("stock") ||
		lower.includes("shares")
	)
		return "securities";
	if (lower.includes("corporation")) return "corporations";
	if (lower.includes("partnership")) return "partnerships";
	if (lower.includes("liabilit") || lower.includes("debt"))
		return "liabilities";
	return "other";
}

/** Map Elections Canada recipient type */
function mapRecipientType(raw?: string): Donation["recipientType"] {
	if (!raw) return "political_party";
	const lower = raw.toLowerCase().trim();
	if (lower.includes("leadership")) return "leadership_candidate";
	if (lower.includes("nomination")) return "nomination_contestant";
	if (lower.includes("candidate")) return "candidate";
	if (
		lower.includes("riding") ||
		lower.includes("association") ||
		lower.includes("eda")
	)
		return "riding_association";
	if (lower.includes("third")) return "third_party";
	return "political_party";
}
