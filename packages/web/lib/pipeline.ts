/**
 * CivicIntel — Pipeline Initialization
 *
 * Generates pre-computed intelligence from seed data for the web app.
 * Uses mock thread generation since SQLite isn't available in the browser.
 */

import type {
	IntelligenceThread,
	Brief,
	Contract,
	LobbyingFiling,
	Donation,
	Disclosure,
	GACProject,
	Person,
	Organization,
} from "@civic-intel/core";
import {
	getSeedParsedData,
	seedPeople,
	seedOrganizations,
} from "@civic-intel/core/src/seed/data";

export interface PipelineResult {
	contracts: Contract[];
	filings: LobbyingFiling[];
	donations: Donation[];
	disclosures: Disclosure[];
	projects: GACProject[];
	people: Person[];
	organizations: Organization[];
	threads: IntelligenceThread[];
	brief: Brief | null;
	sweepDelta: {
		newContracts: number;
		newFilings: number;
		newDonations: number;
		newDisclosures: number;
		newProjects: number;
		newSignals: number;
	};
}

let _pipelineResult: PipelineResult | null = null;

export async function initializePipeline(): Promise<PipelineResult> {
	if (_pipelineResult) return _pipelineResult;

	const data = getSeedParsedData();
	const threads = generateMockThreads(data);
	const brief = generateMockBrief(threads);

	_pipelineResult = {
		contracts: data.contracts,
		filings: data.filings,
		donations: data.donations,
		disclosures: data.disclosures,
		projects: data.projects,
		people: seedPeople,
		organizations: seedOrganizations,
		threads,
		brief,
		sweepDelta: {
			newContracts: data.contracts.length,
			newFilings: data.filings.length,
			newDonations: data.donations.length,
			newDisclosures: data.disclosures.length,
			newProjects: data.projects.length,
			newSignals: threads.length,
		},
	};

	return _pipelineResult;
}

function generateMockThreads(data: {
	contracts: Contract[];
	filings: LobbyingFiling[];
}): IntelligenceThread[] {
	const now = new Date().toISOString();
	return [
		{
			id: "thread-procure-lobby-1",
			signalType: "procurement_lobbying_overlap",
			title: "L3Harris: Simultaneous Defence Contracts & Lobbying",
			description:
				"L3Harris Technologies holds active DND contracts while concurrently lobbying the Department of National Defence through Navigator LLP. Multiple sole-source contracts overlap with lobbying communication dates.",
			confidence: 0.85,
			sources: ["canadabuys", "lobbying_commissioner"],
			nodes: [
				"org-l3harris-technologies",
				"org-department-of-national-defence",
				"org-navigator-llp",
			],
			edges: [],
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "thread-revolve-1",
			signalType: "revolving_door",
			title: "Michael Chen: DND ADM → Navigator LLP → Lobbying DND",
			description:
				"Michael Chen served as Assistant Deputy Minister at DND, then joined Navigator LLP as Senior Consultant, and is now lobbying his former department on behalf of L3Harris Technologies.",
			confidence: 0.92,
			sources: ["ciec", "lobbying_commissioner"],
			nodes: [
				"person-michael-chen",
				"org-navigator-llp",
				"org-department-of-national-defence",
			],
			edges: [],
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "thread-spousal-1",
			signalType: "spousal_interest_proximity",
			title: "Sarah Mitchell: MP Spouse in Defence Contracting",
			description:
				"Sarah Mitchell, MP for Halifax West and member of the Standing Committee on National Defence, disclosed that her spouse David Mitchell is employed as Director of Government Relations at L3Harris Technologies — a major DND contractor.",
			confidence: 0.88,
			sources: ["ciec", "elections_canada"],
			nodes: [
				"person-sarah-mitchell",
				"person-david-mitchell",
				"org-l3harris-technologies",
			],
			edges: [],
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "thread-sole-1",
			signalType: "sole_source_heavy_lobbying",
			title: "Sole-Source DND Contract to L3Harris During Active Lobbying",
			description:
				"A $45M sole-source contract to L3Harris for F-35 simulator technology was awarded during a period of intense lobbying activity by Navigator LLP on behalf of L3Harris targeting DND.",
			confidence: 0.78,
			sources: ["canadabuys", "lobbying_commissioner"],
			nodes: [
				"org-l3harris-technologies",
				"org-department-of-national-defence",
				"org-navigator-llp",
			],
			edges: [],
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "thread-intl-1",
			signalType: "international_layering",
			title: "Plan International: GAC Funding & Lockheed Martin Partnership",
			description:
				"Plan International receives $12M in GAC funding for Philippines development while partnering with Lockheed Martin on STEM initiatives, creating a connection between defence contracting and international development.",
			confidence: 0.65,
			sources: ["gac", "canadabuys"],
			nodes: [
				"org-plan-international",
				"org-lockheed-martin",
				"org-global-affairs-canada",
			],
			edges: [],
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "thread-donate-1",
			signalType: "donation_proximity_correlation",
			title: "Conservative Party Donation from L3Harris VP Near Contract Award",
			description:
				"Robert Mitchell, VP at L3Harris Technologies, donated $1,500 to the Conservative Party of Canada within 60 days of L3Harris receiving a $45M sole-source DND contract.",
			confidence: 0.71,
			sources: ["elections_canada", "canadabuys"],
			nodes: ["person-robert-mitchell", "org-l3harris-technologies"],
			edges: [],
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "thread-mandate-1",
			signalType: "mandate_divergence",
			title: "Indigenous Procurement Mandate vs Defence Spending Reality",
			description:
				"The government's mandate to increase Indigenous procurement to 5% diverges significantly from DND spending patterns, where sole-source contracts continue to flow to large defence contractors.",
			confidence: 0.55,
			sources: ["canadabuys"],
			nodes: ["org-department-of-national-defence"],
			edges: [],
			createdAt: now,
			updatedAt: now,
		},
	];
}

function generateMockBrief(threads: IntelligenceThread[]): Brief {
	return {
		id: "brief-daily",
		title: "CivicIntel Daily Brief",
		summary:
			threads.length +
			" intelligence signals detected across federal data sources. Key focus: L3Harris Technologies appears in procurement, lobbying, and disclosure data simultaneously.",
		sections: [
			{
				title: "What Changed",
				content:
					threads.length +
					" signals detected across federal data. " +
					threads.filter((t) => t.confidence > 0.7).length +
					" high-confidence, " +
					threads.filter((t) => t.confidence > 0.4 && t.confidence <= 0.7).length +
					" medium-confidence. Key: L3Harris Technologies appears in procurement, lobbying, and disclosure data simultaneously.",
				signalTypes: ["procurement_lobbying_overlap" as const],
			},
			{
				title: "Active Signals",
				content:
					"Procurement-lobbying overlap detected for L3Harris ↔ DND. Revolving door: Michael Chen (former DND ADM) now lobbying DND via Navigator LLP. Spousal interest: MP Sarah Mitchell's spouse works at L3Harris.",
				signalTypes: [
					"procurement_lobbying_overlap" as const,
					"revolving_door" as const,
					"spousal_interest_proximity" as const,
				],
			},
			{
				title: "Connection Highlights",
				content:
					"L3Harris Technologies, Navigator LLP, and DND form a tightly connected cluster across contracts, lobbying filings, and CIEC disclosures. Michael Chen is the connective tissue between Navigator LLP and DND.",
			},
			{
				title: "Mandate Watch",
				content:
					"Indigenous procurement target (5%) remains unmet in defence spending. Sole-source contracts continue to dominate DND procurement patterns.",
			},
			{
				title: "Spending Pulse",
				content:
					"$152M+ in active DND contracts detected. L3Harris holds $87M in contracts. Lockheed Martin holds $65M. Significant concentration in defence sector.",
			},
			{
				title: "Lobbying Pulse",
				content:
					"Navigator LLP is the most active lobbying firm targeting DND. L3Harris is the top client. Communication reports show weekly contact with senior DND officials.",
			},
		],
		entityIds: threads.flatMap((t) => t.nodes),
		confidence: threads.length > 0 ? threads[0].confidence : 0,
		generatedAt: new Date().toISOString(),
	};
}
