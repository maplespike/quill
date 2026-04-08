/**
 * Shared parser types for CivicIntel data sources.
 * Every parser returns ParseResult<T> with validated data, errors, and metadata.
 */

import type { GovernmentSource } from "../types/base";

/** Configuration for instantiating a parser */
export interface ParserConfig {
	/** The government source this parser handles */
	source: GovernmentSource;
	/** Maximum number of rows to parse (0 = unlimited) */
	maxRows?: number;
	/** Skip rows that fail validation instead of collecting errors */
	skipErrors?: boolean;
	/** Optional ISO timestamp override (defaults to now) */
	timestamp?: string;
}

/** A single parse error from a row or field */
export interface ParseError {
	/** 1-based row number in the source data */
	row: number;
	/** Field that caused the error, if identifiable */
	field?: string;
	/** Human-readable error message */
	message: string;
	/** Raw value that caused the error */
	rawValue?: unknown;
}

/** Metadata about a parse run */
export interface ParseMetadata {
	/** Which government source was parsed */
	source: GovernmentSource;
	/** Number of successfully parsed records */
	count: number;
	/** ISO timestamp of when parsing completed */
	timestamp: string;
	/** Format of the input data */
	format: "csv" | "xml" | "html";
	/** Total rows/records in the input (including errored) */
	totalRows?: number;
}

/** Result of parsing a data source */
export interface ParseResult<T> {
	/** Successfully parsed and validated records */
	data: T[];
	/** Errors encountered during parsing */
	errors: ParseError[];
	/** Metadata about the parse run */
	metadata: ParseMetadata;
}

/** Result of a full sweep across multiple sources */
export interface SweepResult {
	/** Results keyed by source name */
	results: Record<string, ParseResult<unknown>>;
	/** Total records parsed across all sources */
	totalRecords: number;
	/** Total errors across all sources */
	totalErrors: number;
	/** ISO timestamp */
	timestamp: string;
}

/**
 * Minimal CSV row parser.
 * Handles quoted fields with embedded commas and double-quote escaping.
 */
export function parseCsv(csvData: string): string[][] {
	const lines: string[][] = [];
	let currentRow: string[] = [];
	let currentField = "";
	let inQuotes = false;
	let rowIdx = 0;
	let i = 0;

	while (i < csvData.length) {
		const ch = csvData[i];

		if (inQuotes) {
			if (ch === '"') {
				// Look ahead for escaped quote
				if (i + 1 < csvData.length && csvData[i + 1] === '"') {
					currentField += '"';
					i += 2;
					continue;
				}
				// End of quoted field
				inQuotes = false;
				i++;
				continue;
			}
			currentField += ch;
			i++;
		} else {
			if (ch === '"') {
				inQuotes = true;
				i++;
			} else if (ch === ",") {
				currentRow.push(currentField.trim());
				currentField = "";
				i++;
			} else if (ch === "\r") {
				// Handle \r\n or bare \r
				currentRow.push(currentField.trim());
				currentField = "";
				if (i + 1 < csvData.length && csvData[i + 1] === "\n") {
					i += 2;
				} else {
					i++;
				}
				if (
					currentRow.length > 0 &&
					!(currentRow.length === 1 && currentRow[0] === "")
				) {
					lines.push(currentRow);
					rowIdx++;
				}
				currentRow = [];
			} else if (ch === "\n") {
				currentRow.push(currentField.trim());
				currentField = "";
				if (
					currentRow.length > 0 &&
					!(currentRow.length === 1 && currentRow[0] === "")
				) {
					lines.push(currentRow);
					rowIdx++;
				}
				currentRow = [];
				i++;
			} else {
				currentField += ch;
				i++;
			}
		}
	}

	// Flush the last field and row
	if (currentField || currentRow.length > 0) {
		currentRow.push(currentField.trim());
		if (
			currentRow.length > 0 &&
			!(currentRow.length === 1 && currentRow[0] === "")
		) {
			lines.push(currentRow);
		}
	}

	return lines;
}

/**
 * Parse CSV string into array of objects using the first row as headers.
 */
export function parseCsvToObjects(csvData: string): Record<string, string>[] {
	const rows = parseCsv(csvData);
	if (rows.length === 0) return [];

	const headers = rows[0];
	const objects: Record<string, string>[] = [];

	for (let r = 1; r < rows.length; r++) {
		const obj: Record<string, string> = {};
		for (let c = 0; c < headers.length; c++) {
			obj[headers[c]] = rows[r][c] ?? "";
		}
		objects.push(obj);
	}

	return objects;
}

/**
 * Minimal XML tag extractor.
 * Extracts child text content from XML tags. Not a full XML parser —
 * handles the structured XML formats typical of government data feeds.
 */
export function extractXmlFields(xml: string, tag: string): string[] {
	const results: string[] = [];
	const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
	let match: RegExpExecArray | null;
	while ((match = regex.exec(xml)) !== null) {
		results.push(match[1].trim());
	}
	return results;
}

/**
 * Extract attributes from XML opening tags.
 */
export function extractXmlAttributes(
	xml: string,
	tag: string,
): Record<string, string>[] {
	const results: Record<string, string>[] = [];
	const regex = new RegExp(`<${tag}([^>]*)(?:\\/>|>)`, "gi");
	let match: RegExpExecArray | null;
	while ((match = regex.exec(xml)) !== null) {
		const attrString = match[1];
		const attrs: Record<string, string> = {};
		const attrRegex = /(\w+)="([^"]*)"/g;
		let attrMatch: RegExpExecArray | null;
		while ((attrMatch = attrRegex.exec(attrString)) !== null) {
			attrs[attrMatch[1]] = attrMatch[2];
		}
		results.push(attrs);
	}
	return results;
}

/**
 * Extract all records between repeating parent tags.
 * Returns array of XML fragments for each record.
 */
export function extractXmlRecords(xml: string, recordTag: string): string[] {
	const results: string[] = [];
	const regex = new RegExp(
		`<${recordTag}[^>]*>([\\s\\S]*?)<\\/${recordTag}>`,
		"gi",
	);
	let match: RegExpExecArray | null;
	while ((match = regex.exec(xml)) !== null) {
		results.push(match[1]);
	}
	return results;
}

/** Generate a UUID v4 */
export function generateId(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/** Get current ISO datetime string */
export function nowISO(): string {
	return new Date().toISOString();
}

/** Parse a number from a string, stripping currency symbols and commas */
export function parseNumber(val: string | undefined | null): number {
	if (!val) return 0;
	const cleaned = val.replace(/[$,\s]/g, "").replace(/CAD/i, "");
	const num = Number.parseFloat(cleaned);
	return Number.isNaN(num) ? 0 : num;
}

/** Normalize a date string to ISO format */
export function normalizeDate(val: string | undefined | null): string {
	if (!val) return "";
	// Try ISO already
	if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
		return val.substring(0, 10);
	}
	// Try DD/MM/YYYY
	const dmy = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
	if (dmy) {
		const [, d, m, y] = dmy;
		return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
	}
	// Try MM/DD/YYYY (US format - less common in Canadian data)
	const mdy = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
	if (mdy) {
		// ambiguous - assume DD/MM/YYYY for Canadian data
		return val;
	}
	// Try Month DD, YYYY
	const spelled = val.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
	if (spelled) {
		const months: Record<string, string> = {
			january: "01",
			february: "02",
			march: "03",
			april: "04",
			may: "05",
			june: "06",
			july: "07",
			august: "08",
			september: "09",
			october: "10",
			november: "11",
			december: "12",
			jan: "01",
			feb: "02",
			mar: "03",
			apr: "04",
			jun: "06",
			jul: "07",
			aug: "08",
			sep: "09",
			oct: "10",
			nov: "11",
			dec: "12",
		};
		const m = months[spelled[1].toLowerCase()];
		if (m) {
			return `${spelled[3]}-${m}-${spelled[2].padStart(2, "0")}`;
		}
	}
	return val;
}

/** Clean and normalize a person/org name */
export function normalizeName(name: string): string {
	return name
		.trim()
		.replace(/\s+/g, " ")
		.replace(/^["']|["']$/g, "")
		.trim();
}
