import { z } from "zod";
import { ContractSchema, TenderSchema } from "../../schemas";
import type {
	Contract,
	ContractStatus,
	GovernmentSource,
	Tender,
	TenderStatus,
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
	normalizeDate,
	nowISO,
	parseCsvToObjects,
	parseNumber,
} from "../types";

/**
 * Federal Spending Parser — handles CanadaBuys proactive disclosure CSVs
 * and PSPC XML tender notices.
 */
export class SpendingParser {
	private config: ParserConfig;

	constructor(config?: Partial<ParserConfig>) {
		this.config = {
			source: "open_canada_contracts",
			maxRows: 0,
			skipErrors: true,
			timestamp: nowISO(),
			...config,
		};
	}

	/**
	 * Parse CanadaBuys proactive disclosure CSV.
	 * Expected columns: contract_number, title, vendor_name, vendor_id,
	 * department, contract_value, start_date, end_date, status, sole_source,
	 * province, commodity_type, description
	 */
	parseProactiveDisclosure(csvData: string): ParseResult<Contract> {
		const errors: ParseError[] = [];
		const data: Contract[] = [];
		const rows = parseCsvToObjects(csvData);
		const maxRows = this.config.maxRows || Infinity;
		const timestamp = this.config.timestamp || nowISO();

		for (let i = 0; i < rows.length && data.length < maxRows; i++) {
			const row = rows[i];
			const rowNum = i + 2; // 1-based + header

			try {
				const contract = this.normalizeContract(row);
				const validated = ContractSchema.parse(contract);
				data.push(validated as Contract);
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
					rawValue: row,
				});
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
	 * Parse PSPC XML tender notices.
	 * Expected structure: <notices><tender>...</tender></notices>
	 */
	parseTenderNotice(xmlData: string): ParseResult<Tender> {
		const errors: ParseError[] = [];
		const data: Tender[] = [];
		const timestamp = this.config.timestamp || nowISO();
		const records = extractXmlRecords(xmlData, "tender");

		for (let i = 0; i < records.length; i++) {
			const fragment = records[i];
			const rowNum = i + 1;

			try {
				const tender = this.normalizeTender(fragment);
				const validated = TenderSchema.parse(tender);
				data.push(validated as Tender);
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

	/** Map a raw CSV row to a Contract object */
	normalizeContract(raw: Record<string, string>): Contract {
		const now = nowISO();
		const contractValue = parseNumber(raw.contract_value ?? raw.value);
		const isSoleSource = parseSoleSource(raw.sole_source ?? raw.is_sole_source);

		return {
			id: generateId(),
			source: "open_canada_contracts",
			rawData: raw as Record<string, unknown>,
			createdAt: now,
			updatedAt: now,
			contractNumber: (raw.contract_number ?? "").trim(),
			title: (raw.title ?? "").trim(),
			description: (raw.description ?? "").trim(),
			vendorName: (raw.vendor_name ?? "").trim(),
			vendorId: raw.vendor_id?.trim() || undefined,
			department: (raw.department ?? "").trim(),
			value: contractValue,
			currency: "CAD",
			startDate: normalizeDate(raw.start_date),
			endDate: normalizeDate(raw.end_date) || undefined,
			status: mapContractStatus(raw.status),
			isSoleSource: isSoleSource,
			province: raw.province?.trim() || undefined,
			commodityType: raw.commodity_type?.trim() || undefined,
		};
	}

	/** Map an XML fragment to a Tender object */
	private normalizeTender(fragment: string): Tender {
		const now = nowISO();
		const get = (tag: string) => {
			const fields = extractXmlFields(fragment, tag);
			return fields[0] ?? "";
		};

		return {
			id: generateId(),
			source: "open_canada_contracts",
			rawData: { xmlFragment: fragment.substring(0, 500) },
			createdAt: now,
			updatedAt: now,
			solicitationNumber: get("solicitation_number"),
			title: get("title"),
			description: get("description"),
			department: get("department"),
			estimatedValue: parseNumber(get("estimated_value")) || undefined,
			currency: get("currency") || "CAD",
			publishDate: normalizeDate(get("publish_date")),
			closingDate: normalizeDate(get("closing_date")),
			status: mapTenderStatus(get("status")),
			isSoleSource: parseSoleSource(get("sole_source")),
			province: get("province") || undefined,
		};
	}
}

/** Map raw status strings to ContractStatus */
function mapContractStatus(raw?: string): ContractStatus {
	if (!raw) return "active";
	const lower = raw.toLowerCase().trim();
	if (lower.includes("complet") || lower.includes("closed")) return "completed";
	if (lower.includes("cancel")) return "cancelled";
	if (lower.includes("amend")) return "amended";
	if (lower.includes("pend")) return "pending";
	return "active";
}

/** Map raw status strings to TenderStatus */
function mapTenderStatus(raw?: string): TenderStatus {
	if (!raw) return "open";
	const lower = raw.toLowerCase().trim();
	if (lower.includes("clos") || lower.includes("expired")) return "closed";
	if (lower.includes("award")) return "awarded";
	if (lower.includes("cancel")) return "cancelled";
	if (lower.includes("amend")) return "amended";
	return "open";
}

/** Parse sole source indicator from various formats */
function parseSoleSource(val?: string): boolean {
	if (!val) return false;
	const lower = val.toLowerCase().trim();
	return lower === "yes" || lower === "true" || lower === "1" || lower === "y";
}
