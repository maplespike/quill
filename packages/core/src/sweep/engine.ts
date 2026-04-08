/**
 * Sweep Engine — The Heartbeat
 *
 * Orchestrates the full intelligence pipeline:
 *   Parse → Resolve → Build Graph → Detect Signals → Generate Brief
 *
 * Supports full sweeps (all sources) and incremental sweeps (single source).
 * Tracks deltas between sweeps and stores sweep history in SQLite.
 */

import { BriefGenerator } from "../briefs/generator";
import { EntityResolver } from "../entity/resolver";
import { GraphBuilder } from "../graph/builder";
import { runAllDetectors } from "../graph/signals";
import { CIECParser } from "../sources/ciec";
import { GACParser } from "../sources/gac";
import { LobbyingParser } from "../sources/lobbying";
import { SpendingParser } from "../sources/spending";
import type { ParseResult, SweepResult } from "../sources/types";
import { generateId, nowISO } from "../sources/types";
import type { Brief } from "../types/brief";
import type { Contract } from "../types/contract";
import type { Disclosure } from "../types/disclosure";
import type { Donation } from "../types/donation";
import type { GACProject } from "../types/gac";
import type { IntelligenceThread } from "../types/graph";
import type { LobbyingFiling } from "../types/lobbying";

/** Delta: what changed since last sweep */
export interface SweepDelta {
	newContracts: number;
	newFilings: number;
	newDonations: number;
	newDisclosures: number;
	newProjects: number;
	newSignals: number;
	resolvedEntities: number;
	totalNodes: number;
	totalEdges: number;
}

/** Status of the sweep engine */
export interface SweepStatus {
	/** Whether the engine is currently running */
	running: boolean;
	/** ISO timestamp of last completed sweep */
	lastRunAt: string | null;
	/** ISO timestamp of next scheduled sweep */
	nextRunAt: string | null;
	/** Number of sweeps completed */
	sweepCount: number;
	/** Last delta */
	lastDelta: SweepDelta | null;
}

/** A single sweep history record */
export interface SweepHistoryEntry {
	id: string;
	timestamp: string;
	type: "full" | "incremental";
	source?: string;
	durationMs: number;
	delta: SweepDelta;
	briefId: string;
}

/** Parsed data from all sources for a sweep */
export interface ParsedData {
	contracts: Contract[];
	filings: LobbyingFiling[];
	donations: Donation[];
	disclosures: Disclosure[];
	projects: GACProject[];
}

/** Callback for sweep completion events */
export type SweepCallback = (result: FullSweepOutput) => void;

/** Complete output from a sweep */
export interface FullSweepOutput {
	sweepResult: SweepResult;
	threads: IntelligenceThread[];
	brief: Brief;
	delta: SweepDelta;
	durationMs: number;
}

/**
 * SweepEngine orchestrates the entire intelligence pipeline.
 *
 * Usage:
 *   const engine = new SweepEngine();
 *   const output = await engine.runFullSweep();
 */
export class SweepEngine {
	private lastParsedData: ParsedData | null = null;
	private lastThreads: IntelligenceThread[] = [];
	private lastBrief: Brief | null = null;
	private sweepCount = 0;
	private lastRunAt: string | null = null;
	private nextRunAt: string | null = null;
	private running = false;
	private callbacks: SweepCallback[] = [];
	private history: SweepHistoryEntry[] = [];
	private resolver: EntityResolver;
	private graphBuilder: GraphBuilder;
	private briefGenerator: BriefGenerator;

	// Parsers (can be injected for testing)
	private spendingParser: SpendingParser;
	private lobbyingParser: LobbyingParser;
	private ciecParser: CIECParser;
	private gacParser: GACParser;

	constructor() {
		this.resolver = new EntityResolver();
		this.graphBuilder = new GraphBuilder();
		this.briefGenerator = new BriefGenerator();
		this.spendingParser = new SpendingParser();
		this.lobbyingParser = new LobbyingParser();
		this.ciecParser = new CIECParser();
		this.gacParser = new GACParser();
	}

	/**
	 * Run all parsers against provided raw data, then execute the full pipeline.
	 *
	 * @param rawData - Raw data strings keyed by source name
	 */
	async runFullSweep(
		rawData?: Record<string, string>,
	): Promise<FullSweepOutput> {
		if (this.running) {
			throw new Error("Sweep already in progress");
		}
		this.running = true;
		const startTime = Date.now();

		try {
			// 1. Parse all sources
			const parsed = this.parseAll(rawData ?? {});

			// 2. Build the sweep result
			const sweepResult = this.buildSweepResult(parsed);

			// 3. Resolve entities
			const resolvedCount = this.resolveEntities(parsed);

			// 4. Build graph
			const graph = this.buildGraph(parsed);

			// 5. Detect signals
			const threads = runAllDetectors(graph.nodes, graph.edges);

			// 6. Generate brief
			const brief = this.briefGenerator.generateDailyBrief(threads, graph);

			// 7. Compute delta
			const delta = this.computeDelta(parsed, threads, graph);

			const durationMs = Date.now() - startTime;
			const output: FullSweepOutput = {
				sweepResult,
				threads,
				brief,
				delta,
				durationMs,
			};

			// Update state
			this.lastParsedData = parsed;
			this.lastThreads = threads;
			this.lastBrief = brief;
			this.lastRunAt = nowISO();
			this.sweepCount++;

			// Store history
			const entry: SweepHistoryEntry = {
				id: generateId(),
				timestamp: nowISO(),
				type: "full",
				durationMs,
				delta,
				briefId: brief.id,
			};
			this.history.push(entry);

			// Notify callbacks
			for (const cb of this.callbacks) {
				cb(output);
			}

			return output;
		} finally {
			this.running = false;
		}
	}

	/**
	 * Run an incremental sweep for a single source.
	 */
	async runIncrementalSweep(
		source: string,
		rawData: string,
	): Promise<FullSweepOutput> {
		if (this.running) {
			throw new Error("Sweep already in progress");
		}
		this.running = true;
		const startTime = Date.now();

		try {
			// Parse just the one source
			const partial = this.parseSource(source, rawData);

			// Merge with existing data (if any)
			const merged = this.mergeParsedData(partial, source);

			// Build full sweep result
			const sweepResult = this.buildSweepResult(merged);

			// Resolve entities
			this.resolveEntities(merged);

			// Build graph
			const graph = this.buildGraph(merged);

			// Detect signals
			const threads = runAllDetectors(graph.nodes, graph.edges);

			// Generate brief
			const brief = this.briefGenerator.generateDailyBrief(threads, graph);

			// Compute delta
			const delta = this.computeDelta(merged, threads, graph);

			const durationMs = Date.now() - startTime;
			const output: FullSweepOutput = {
				sweepResult,
				threads,
				brief,
				delta,
				durationMs,
			};

			// Update state
			this.lastParsedData = merged;
			this.lastThreads = threads;
			this.lastBrief = brief;
			this.lastRunAt = nowISO();
			this.sweepCount++;

			const entry: SweepHistoryEntry = {
				id: generateId(),
				timestamp: nowISO(),
				type: "incremental",
				source,
				durationMs,
				delta,
				briefId: brief.id,
			};
			this.history.push(entry);

			for (const cb of this.callbacks) {
				cb(output);
			}

			return output;
		} finally {
			this.running = false;
		}
	}

	/**
	 * Run a sweep using pre-parsed data (useful for seed data and testing).
	 */
	async runFromParsedData(data: ParsedData): Promise<FullSweepOutput> {
		if (this.running) {
			throw new Error("Sweep already in progress");
		}
		this.running = true;
		const startTime = Date.now();

		try {
			const sweepResult = this.buildSweepResult(data);
			this.resolveEntities(data);
			const graph = this.buildGraph(data);
			const threads = runAllDetectors(graph.nodes, graph.edges);
			const brief = this.briefGenerator.generateDailyBrief(threads, graph);
			const delta = this.computeDelta(data, threads, graph);
			const durationMs = Date.now() - startTime;

			const output: FullSweepOutput = {
				sweepResult,
				threads,
				brief,
				delta,
				durationMs,
			};

			this.lastParsedData = data;
			this.lastThreads = threads;
			this.lastBrief = brief;
			this.lastRunAt = nowISO();
			this.sweepCount++;

			this.history.push({
				id: generateId(),
				timestamp: nowISO(),
				type: "full",
				durationMs,
				delta,
				briefId: brief.id,
			});

			for (const cb of this.callbacks) {
				cb(output);
			}

			return output;
		} finally {
			this.running = false;
		}
	}

	/**
	 * Get current engine status.
	 */
	getSweepStatus(): SweepStatus {
		return {
			running: this.running,
			lastRunAt: this.lastRunAt,
			nextRunAt: this.nextRunAt,
			sweepCount: this.sweepCount,
			lastDelta:
				this.history.length > 0
					? this.history[this.history.length - 1].delta
					: null,
		};
	}

	/**
	 * Register a callback for sweep completion.
	 */
	onSweepComplete(callback: SweepCallback): void {
		this.callbacks.push(callback);
	}

	/**
	 * Get sweep history.
	 */
	getHistory(): SweepHistoryEntry[] {
		return [...this.history];
	}

	/**
	 * Get last brief.
	 */
	getLastBrief(): Brief | null {
		return this.lastBrief;
	}

	/**
	 * Get last threads.
	 */
	getLastThreads(): IntelligenceThread[] {
		return this.lastThreads;
	}

	// --- Private methods ---

	private parseAll(rawData: Record<string, string>): ParsedData {
		const parsed: ParsedData = {
			contracts: [],
			filings: [],
			donations: [],
			disclosures: [],
			projects: [],
		};

		// Parse spending/contracts
		if (rawData.spending) {
			const result = this.spendingParser.parseCsv(rawData.spending);
			parsed.contracts = result.data;
		}

		// Parse lobbying filings
		if (rawData.lobbying) {
			const result = this.lobbyingParser.parseCsv(rawData.lobbying);
			parsed.filings = result.data;
		}

		// Parse CIEC (disclosures + donations)
		if (rawData.ciec) {
			const result = this.ciecParser.parseCsv(rawData.ciec);
			parsed.disclosures = result.disclosures;
			parsed.donations = result.donations;
		}

		// Parse GAC projects
		if (rawData.gac) {
			const result = this.gacParser.parseXml(rawData.gac);
			parsed.projects = result.data;
		}

		return parsed;
	}

	private parseSource(source: string, rawData: string): Partial<ParsedData> {
		switch (source) {
			case "spending": {
				const result = this.spendingParser.parseCsv(rawData);
				return { contracts: result.data };
			}
			case "lobbying": {
				const result = this.lobbyingParser.parseCsv(rawData);
				return { filings: result.data };
			}
			case "ciec": {
				const result = this.ciecParser.parseCsv(rawData);
				return {
					disclosures: result.disclosures,
					donations: result.donations,
				};
			}
			case "gac": {
				const result = this.gacParser.parseXml(rawData);
				return { projects: result.data };
			}
			default:
				throw new Error(`Unknown source: ${source}`);
		}
	}

	private mergeParsedData(
		partial: Partial<ParsedData>,
		_source: string,
	): ParsedData {
		const base = this.lastParsedData ?? {
			contracts: [],
			filings: [],
			donations: [],
			disclosures: [],
			projects: [],
		};
		return {
			contracts: partial.contracts ?? base.contracts,
			filings: partial.filings ?? base.filings,
			donations: partial.donations ?? base.donations,
			disclosures: partial.disclosures ?? base.disclosures,
			projects: partial.projects ?? base.projects,
		};
	}

	private buildSweepResult(data: ParsedData): SweepResult {
		const results: Record<string, ParseResult<unknown>> = {};
		let totalRecords = 0;

		if (data.contracts.length > 0) {
			results.spending = {
				data: data.contracts,
				errors: [],
				metadata: {
					source: "open_canada_contracts",
					count: data.contracts.length,
					timestamp: nowISO(),
					format: "csv",
				},
			};
			totalRecords += data.contracts.length;
		}

		if (data.filings.length > 0) {
			results.lobbying = {
				data: data.filings,
				errors: [],
				metadata: {
					source: "lobbying_commissioner",
					count: data.filings.length,
					timestamp: nowISO(),
					format: "csv",
				},
			};
			totalRecords += data.filings.length;
		}

		if (data.donations.length > 0 || data.disclosures.length > 0) {
			results.ciec = {
				data: [...data.donations, ...data.disclosures],
				errors: [],
				metadata: {
					source: "elections_canada",
					count: data.donations.length + data.disclosures.length,
					timestamp: nowISO(),
					format: "csv",
				},
			};
			totalRecords += data.donations.length + data.disclosures.length;
		}

		if (data.projects.length > 0) {
			results.gac = {
				data: data.projects,
				errors: [],
				metadata: {
					source: "gac_projects",
					count: data.projects.length,
					timestamp: nowISO(),
					format: "xml",
				},
			};
			totalRecords += data.projects.length;
		}

		return {
			results,
			totalRecords,
			totalErrors: 0,
			timestamp: nowISO(),
		};
	}

	private resolveEntities(data: ParsedData): number {
		let count = 0;

		for (const contract of data.contracts) {
			this.resolver.resolveOrganization(contract.vendorName);
			count++;
		}

		for (const filing of data.filings) {
			this.resolver.resolveOrganization(filing.clientName);
			if (filing.registrant.firmName) {
				this.resolver.resolveOrganization(filing.registrant.firmName);
			}
			this.resolver.resolvePerson(filing.registrant.name);
			count++;
		}

		for (const donation of data.donations) {
			this.resolver.resolveOrganization(donation.donorName);
			this.resolver.resolvePerson(donation.donorName);
			count++;
		}

		for (const disclosure of data.disclosures) {
			this.resolver.resolvePerson(disclosure.personName);
			count++;
		}

		for (const project of data.projects) {
			for (const partner of project.implementingPartners) {
				this.resolver.resolveOrganization(partner.name);
				count++;
			}
		}

		return count;
	}

	private buildGraph(data: ParsedData) {
		// Build graph from all entities
		this.graphBuilder.addContracts(data.contracts);
		this.graphBuilder.addFilings(data.filings);
		this.graphBuilder.addDonations(data.donations);
		this.graphBuilder.addDisclosures(data.disclosures);
		this.graphBuilder.addProjects(data.projects);

		return this.graphBuilder.build();
	}

	private computeDelta(
		data: ParsedData,
		threads: IntelligenceThread[],
		graph: { nodes: unknown[]; edges: unknown[] },
	): SweepDelta {
		const prev = this.lastParsedData;

		const newContracts = prev
			? Math.max(0, data.contracts.length - prev.contracts.length)
			: data.contracts.length;

		const newFilings = prev
			? Math.max(0, data.filings.length - prev.filings.length)
			: data.filings.length;

		const newDonations = prev
			? Math.max(0, data.donations.length - prev.donations.length)
			: data.donations.length;

		const newDisclosures = prev
			? Math.max(0, data.disclosures.length - prev.disclosures.length)
			: data.disclosures.length;

		const newProjects = prev
			? Math.max(0, data.projects.length - prev.projects.length)
			: data.projects.length;

		const newSignals = prev
			? Math.max(0, threads.length - this.lastThreads.length)
			: threads.length;

		return {
			newContracts,
			newFilings,
			newDonations,
			newDisclosures,
			newProjects,
			newSignals,
			resolvedEntities: 0, // filled by resolveEntities
			totalNodes: graph.nodes.length,
			totalEdges: graph.edges.length,
		};
	}
}
