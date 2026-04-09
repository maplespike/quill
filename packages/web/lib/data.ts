/**
 * CivicIntel — Self-Contained Browser Data
 *
 * All seed data and types inlined for zero Node.js dependency.
 * This module is the single source of truth for the browser build.
 */

// ─── Types (inlined) ──────────────────────────────────────

export interface Person {
	id: string;
	names: string[];
	firstName: string;
	lastName: string;
	roles: { title: string; organization: string; department?: string; startDate: string; endDate?: string; category: string; source: string }[];
	relationships: { type: string; targetId: string; targetType: string; label: string; source: string }[];
	province: string;
	city: string;
}

export interface Organization {
	id: string;
	names: string[];
	type: string;
	industry: string;
	province: string;
	city: string;
}

export interface Contract {
	id: string;
	contractNumber: string;
	title: string;
	description: string;
	vendorName: string;
	vendorId: string;
	department: string;
	value: number;
	currency: string;
	startDate: string;
	endDate: string;
	status: string;
	isSoleSource: boolean;
	province: string;
	commodityType: string;
}

export interface LobbyingFiling {
	id: string;
	filingNumber: string;
	registrant: { name: string; firmName?: string; personId: string; organizationId: string };
	clientName: string;
	clientOrganizationId: string;
	subjectMatter: string;
	communications: { date: string; type: string; subjectMatter: string; officials: string[]; institution: string }[];
	startDate: string;
	endDate: string;
	institution: string;
}

export interface Donation {
	id: string;
	donorName: string;
	donorOrganizationId?: string;
	donorPersonId?: string;
	recipientName: string;
	recipientType: string;
	amount: number;
	currency: string;
	date: string;
	province: string;
	riding: string;
	isCorporate: boolean;
}

export interface Disclosure {
	id: string;
	personName: string;
	personId: string;
	position: string;
	department: string;
	year: number;
	interests: { category: string; description: string; value: string; province: string }[];
	filingDate: string;
}

export interface GACProject {
	id: string;
	projectId: string;
	title: string;
	description: string;
	department: string;
	country: string;
	region: string;
	budget: number;
	currency: string;
	startDate: string;
	endDate: string;
	status: string;
	implementingPartners: { name: string; organizationId?: string; country: string; role: string }[];
	sector: string;
}

export interface IntelligenceThread {
	id: string;
	signalType: string;
	title: string;
	description: string;
	confidence: number;
	sources: string[];
	nodes: string[];
	edges: string[];
	createdAt: string;
	updatedAt: string;
}

export interface BriefSection {
	title: string;
	content: string;
	signalTypes?: string[];
}

export interface Brief {
	id: string;
	title: string;
	summary: string;
	sections: BriefSection[];
	entityIds: string[];
	confidence: number;
	generatedAt: string;
}

export interface SweepDelta {
	newContracts: number;
	newFilings: number;
	newDonations: number;
	newDisclosures: number;
	newProjects: number;
	newSignals: number;
}

// ─── Connection Graph ─────────────────────────────────────

export interface GraphNode {
	id: string;
	label: string;
	type: "person" | "org" | "department";
	x: number;
	y: number;
}

export interface GraphEdge {
	from: string;
	to: string;
	label: string;
	type: "contract" | "lobbying" | "donation" | "spousal" | "employment" | "board";
}

export const graphNodes: GraphNode[] = [
	{ id: "org-dnd", label: "National Defence", type: "department", x: 330, y: 50 },
	{ id: "org-l3harris", label: "L3Harris Technologies", type: "org", x: 180, y: 130 },
	{ id: "org-lockheed-martin", label: "Lockheed Martin", type: "org", x: 80, y: 200 },
	{ id: "org-general-dynamics", label: "General Dynamics", type: "org", x: 80, y: 280 },
	{ id: "org-navigator", label: "Navigator LLP", type: "org", x: 380, y: 260 },
	{ id: "org-hill-knowlton", label: "Hill+Knowlton", type: "org", x: 180, y: 320 },
	{ id: "org-plan-international", label: "Plan International", type: "org", x: 540, y: 320 },
	{ id: "org-brookfield", label: "Brookfield", type: "org", x: 500, y: 180 },
	{ id: "person-sarah-mitchell", label: "Sarah Mitchell", type: "person", x: 330, y: 130 },
	{ id: "person-david-mitchell", label: "David Mitchell", type: "person", x: 340, y: 210 },
	{ id: "person-michael-chen", label: "Michael Chen", type: "person", x: 380, y: 190 },
	{ id: "person-james-patterson", label: "James Patterson", type: "person", x: 180, y: 260 },
	{ id: "person-robert-leclair", label: "Robert LeClair", type: "person", x: 80, y: 140 },
	{ id: "person-marie-fortier", label: "Marie Fortier", type: "person", x: 540, y: 260 },
];

export const graphEdges: GraphEdge[] = [
	{ from: "person-sarah-mitchell", to: "person-david-mitchell", label: "Spouse", type: "spousal" },
	{ from: "person-david-mitchell", to: "org-l3harris", label: "Board Member", type: "board" },
	{ from: "person-david-mitchell", to: "org-brookfield", label: "Partner", type: "employment" },
	{ from: "person-sarah-mitchell", to: "org-dnd", label: "Minister", type: "employment" },
	{ from: "person-michael-chen", to: "org-dnd", label: "Former ADM", type: "employment" },
	{ from: "person-michael-chen", to: "org-navigator", label: "VP Gov Relations", type: "employment" },
	{ from: "org-navigator", to: "org-l3harris", label: "Lobbies for", type: "lobbying" },
	{ from: "org-l3harris", to: "org-dnd", label: "$73M contracts", type: "contract" },
	{ from: "org-lockheed-martin", to: "org-dnd", label: "$120M contract", type: "contract" },
	{ from: "org-hill-knowlton", to: "org-lockheed-martin", label: "Lobbies for", type: "lobbying" },
	{ from: "person-james-patterson", to: "org-hill-knowlton", label: "Consultant", type: "employment" },
	{ from: "org-general-dynamics", to: "org-dnd", label: "$67M contract", type: "contract" },
	{ from: "person-robert-leclair", to: "org-lockheed-martin", label: "CEO", type: "employment" },
	{ from: "person-robert-leclair", to: "org-lockheed-martin", label: "$1,700 donation", type: "donation" },
	{ from: "org-brookfield", to: "org-general-dynamics", label: "$8.5M contract", type: "contract" },
	{ from: "person-marie-fortier", to: "org-plan-international", label: "Director", type: "employment" },
	{ from: "org-navigator", to: "org-dnd", label: "6 communications", type: "lobbying" },
	{ from: "org-hill-knowlton", to: "org-dnd", label: "6 communications", type: "lobbying" },
];

// ─── Seed Data ────────────────────────────────────────────

export const people: Person[] = [
	{
		id: "person-sarah-mitchell",
		names: ["Sarah Mitchell", "S. Mitchell", "Hon. Sarah Mitchell"],
		firstName: "Sarah", lastName: "Mitchell",
		roles: [
			{ title: "Minister of National Defence", organization: "Department of National Defence", department: "National Defence", startDate: "2025-04-01", category: "elected", source: "disclosure_clerk" },
		],
		relationships: [
			{ type: "spousal", targetId: "person-david-mitchell", targetType: "person", label: "Spouse", source: "disclosure_clerk" },
		],
		province: "ON", city: "Ottawa",
	},
	{
		id: "person-david-mitchell",
		names: ["David Mitchell", "David R. Mitchell"],
		firstName: "David", lastName: "Mitchell",
		roles: [
			{ title: "Board Member", organization: "L3Harris Technologies Canada", startDate: "2024-06-01", category: "corporate", source: "disclosure_clerk" },
			{ title: "Partner", organization: "Brookfield Asset Management", startDate: "2022-01-15", category: "corporate", source: "disclosure_clerk" },
		],
		relationships: [
			{ type: "spousal", targetId: "person-sarah-mitchell", targetType: "person", label: "Spouse", source: "disclosure_clerk" },
			{ type: "board_membership", targetId: "org-l3harris", targetType: "organization", label: "Board Member", source: "disclosure_clerk" },
		],
		province: "ON", city: "Ottawa",
	},
	{
		id: "person-michael-chen",
		names: ["Michael Chen", "Mike Chen", "M. Chen"],
		firstName: "Michael", lastName: "Chen",
		roles: [
			{ title: "Asst. Deputy Minister, Procurement", organization: "Department of National Defence", department: "National Defence", startDate: "2020-01-01", endDate: "2024-03-31", category: "civil_service", source: "disclosure_clerk" },
			{ title: "VP, Government Relations", organization: "Navigator LLP", startDate: "2024-05-01", category: "lobbyist", source: "lobbying_commissioner" },
		],
		relationships: [],
		province: "ON", city: "Toronto",
	},
	{
		id: "person-james-patterson",
		names: ["James Patterson", "Jim Patterson"],
		firstName: "James", lastName: "Patterson",
		roles: [
			{ title: "Senior Consultant", organization: "Hill+Knowlton Canada", startDate: "2023-01-01", category: "lobbyist", source: "lobbying_commissioner" },
		],
		relationships: [],
		province: "ON", city: "Ottawa",
	},
	{
		id: "person-marie-fortier",
		names: ["Marie Fortier", "M. Fortier"],
		firstName: "Marie", lastName: "Fortier",
		roles: [
			{ title: "Director, Government Programs", organization: "Plan International Canada", startDate: "2021-09-01", category: "corporate", source: "open_canada_orgs" },
		],
		relationships: [],
		province: "ON", city: "Toronto",
	},
	{
		id: "person-robert-leclair",
		names: ["Robert LeClair", "Rob LeClair"],
		firstName: "Robert", lastName: "LeClair",
		roles: [
			{ title: "CEO", organization: "Lockheed Martin Canada", startDate: "2022-03-01", category: "corporate", source: "open_canada_orgs" },
		],
		relationships: [],
		province: "QC", city: "Montreal",
	},
];

export const organizations: Organization[] = [
	{ id: "org-l3harris", names: ["L3Harris Technologies", "L3Harris Technologies Canada", "L3Harris"], type: "corporation", industry: "Defence & Aerospace", province: "ON", city: "Ottawa" },
	{ id: "org-lockheed-martin", names: ["Lockheed Martin Canada", "Lockheed Martin Corporation", "LMC"], type: "corporation", industry: "Defence & Aerospace", province: "QC", city: "Montreal" },
	{ id: "org-hill-knowlton", names: ["Hill+Knowlton Canada", "H+K Canada", "Hill+Knowlton Strategies"], type: "lobbying_firm", industry: "Government Relations", province: "ON", city: "Ottawa" },
	{ id: "org-navigator", names: ["Navigator LLP", "Navigator Ltd"], type: "lobbying_firm", industry: "Government Relations", province: "ON", city: "Toronto" },
	{ id: "org-plan-international", names: ["Plan International Canada", "Plan Canada"], type: "non_profit", industry: "International Development", province: "ON", city: "Toronto" },
	{ id: "org-brookfield", names: ["Brookfield Asset Management", "Brookfield", "BAM"], type: "corporation", industry: "Asset Management", province: "ON", city: "Toronto" },
	{ id: "org-general-dynamics", names: ["General Dynamics Canada", "GD Canada"], type: "corporation", industry: "Defence & Aerospace", province: "ON", city: "Ottawa" },
	{ id: "org-dnd", names: ["Department of National Defence", "National Defence", "DND"], type: "government_agency", industry: "Government", province: "ON", city: "Ottawa" },
];

export const contracts: Contract[] = [
	{
		id: "contract-l3harris-dnd-001", contractNumber: "W8476-240001",
		title: "Tactical Communication Systems Upgrade",
		description: "Sole-source contract for advanced tactical communication systems for the Canadian Armed Forces.",
		vendorName: "L3Harris Technologies Canada", vendorId: "org-l3harris", department: "National Defence",
		value: 45_000_000, currency: "CAD", startDate: "2025-10-01", endDate: "2027-09-30",
		status: "active", isSoleSource: true, province: "ON", commodityType: "Communication Systems",
	},
	{
		id: "contract-l3harris-dnd-002", contractNumber: "W8476-240004",
		title: "Electronic Warfare Suite Upgrade",
		description: "Sole-source contract for upgrading electronic warfare capabilities on Halifax-class frigates.",
		vendorName: "L3Harris Technologies Canada", vendorId: "org-l3harris", department: "National Defence",
		value: 28_000_000, currency: "CAD", startDate: "2026-01-01", endDate: "2028-12-31",
		status: "active", isSoleSource: true, province: "ON", commodityType: "Electronic Warfare",
	},
	{
		id: "contract-lockheed-dnd-001", contractNumber: "W8476-240002",
		title: "CF-35 Fighter Jet Maintenance Support",
		description: "Sole-source contract for ongoing maintenance and support services for the CF-35 fighter jet fleet.",
		vendorName: "Lockheed Martin Canada", vendorId: "org-lockheed-martin", department: "National Defence",
		value: 120_000_000, currency: "CAD", startDate: "2025-07-01", endDate: "2030-06-30",
		status: "active", isSoleSource: true, province: "QC", commodityType: "Aerospace Maintenance",
	},
	{
		id: "contract-plan-ircc-001", contractNumber: "IRCC-2025-00147",
		title: "Settlement Services for Refugee Youth",
		description: "Contribution agreement for settlement and integration services for refugee youth.",
		vendorName: "Plan International Canada", vendorId: "org-plan-international", department: "Immigration, Refugees and Citizenship Canada",
		value: 2_300_000, currency: "CAD", startDate: "2025-04-01", endDate: "2026-03-31",
		status: "active", isSoleSource: false, province: "ON", commodityType: "Social Services",
	},
	{
		id: "contract-brookfield-pspc-001", contractNumber: "PSPC-2025-00892",
		title: "Federal Real Property Management Advisory",
		description: "Competitive contract for advisory services on federal real property portfolio optimization.",
		vendorName: "Brookfield Asset Management", vendorId: "org-brookfield", department: "Public Services and Procurement Canada",
		value: 8_500_000, currency: "CAD", startDate: "2025-06-01", endDate: "2027-05-31",
		status: "active", isSoleSource: false, province: "ON", commodityType: "Real Estate Advisory",
	},
	{
		id: "contract-gd-dnd-001", contractNumber: "W8476-240003",
		title: "Armoured Vehicle Fleet Modernization",
		description: "Competitive contract for the modernization of the LAV 6.0 fleet with enhanced protection systems.",
		vendorName: "General Dynamics Canada", vendorId: "org-general-dynamics", department: "National Defence",
		value: 67_000_000, currency: "CAD", startDate: "2025-09-01", endDate: "2028-08-31",
		status: "active", isSoleSource: false, province: "ON", commodityType: "Armoured Vehicles",
	},
];

export const filings: LobbyingFiling[] = [
	{
		id: "filing-l3harris-nav-001", filingNumber: "LREG-2025-00412",
		registrant: { name: "Michael Chen", firmName: "Navigator LLP", personId: "person-michael-chen", organizationId: "org-navigator" },
		clientName: "L3Harris Technologies Canada", clientOrganizationId: "org-l3harris",
		subjectMatter: "Defence procurement policy and tactical communication systems acquisition",
		communications: [
			{ date: "2025-07-15", type: "meeting", subjectMatter: "Tactical comms procurement timeline", officials: ["Sarah Mitchell", "DND Procurement Director"], institution: "Department of National Defence" },
			{ date: "2025-08-22", type: "meeting", subjectMatter: "Sole-source justification", officials: ["DND Procurement Director"], institution: "Department of National Defence" },
			{ date: "2025-09-10", type: "call", subjectMatter: "Contract specifications review", officials: ["DND Technical Staff"], institution: "Department of National Defence" },
			{ date: "2025-09-28", type: "meeting", subjectMatter: "Final pre-award discussion", officials: ["Sarah Mitchell"], institution: "Department of National Defence" },
		],
		startDate: "2025-06-01", endDate: "2026-05-31", institution: "Department of National Defence",
	},
	{
		id: "filing-lockheed-hk-001", filingNumber: "LREG-2025-00389",
		registrant: { name: "James Patterson", firmName: "Hill+Knowlton Canada", personId: "person-james-patterson", organizationId: "org-hill-knowlton" },
		clientName: "Lockheed Martin Canada", clientOrganizationId: "org-lockheed-martin",
		subjectMatter: "Fighter jet maintenance contracts and aerospace industry policy",
		communications: [
			{ date: "2025-04-10", type: "meeting", subjectMatter: "CF-35 maintenance support extension", officials: ["DND Aerospace Director"], institution: "Department of National Defence" },
			{ date: "2025-05-15", type: "meeting", subjectMatter: "Industrial benefits for Quebec", officials: ["DND Procurement Staff"], institution: "Department of National Defence" },
			{ date: "2025-06-20", type: "email", subjectMatter: "Contract value negotiations", officials: ["DND Finance"], institution: "Department of National Defence" },
			{ date: "2025-07-08", type: "meeting", subjectMatter: "Sole-source rationale preparation", officials: ["DND Legal"], institution: "Department of National Defence" },
			{ date: "2025-08-14", type: "call", subjectMatter: "Maintenance schedule alignment", officials: ["DND Operations"], institution: "Department of National Defence" },
			{ date: "2025-09-02", type: "meeting", subjectMatter: "Pre-award confirmation", officials: ["Sarah Mitchell", "DND Procurement Director"], institution: "Department of National Defence" },
		],
		startDate: "2025-03-01", endDate: "2026-02-28", institution: "Department of National Defence",
	},
	{
		id: "filing-plan-hk-001", filingNumber: "LREG-2025-00501",
		registrant: { name: "Marie Fortier", personId: "person-marie-fortier", organizationId: "org-plan-international" },
		clientName: "Plan International Canada", clientOrganizationId: "org-plan-international",
		subjectMatter: "International development funding and refugee settlement services policy",
		communications: [
			{ date: "2025-05-12", type: "meeting", subjectMatter: "Settlement services funding renewal", officials: ["IRCC Director General"], institution: "Immigration, Refugees and Citizenship Canada" },
			{ date: "2025-07-19", type: "meeting", subjectMatter: "Youth refugee program expansion", officials: ["GAC Assistant Deputy Minister"], institution: "Global Affairs Canada" },
		],
		startDate: "2025-04-01", endDate: "2026-03-31", institution: "Immigration, Refugees and Citizenship Canada",
	},
];

export const donations: Donation[] = [
	{ id: "donation-brookfield-001", donorName: "Brookfield Asset Management", donorOrganizationId: "org-brookfield", recipientName: "Liberal Party of Canada", recipientType: "political_party", amount: 25_000, currency: "CAD", date: "2025-03-15", province: "ON", riding: "Toronto Centre", isCorporate: true },
	{ id: "donation-brookfield-002", donorName: "Brookfield Asset Management", donorOrganizationId: "org-brookfield", recipientName: "Liberal Party of Canada", recipientType: "political_party", amount: 15_000, currency: "CAD", date: "2024-11-20", province: "ON", riding: "Toronto Centre", isCorporate: true },
	{ id: "donation-leclair-001", donorName: "Robert LeClair", donorPersonId: "person-robert-leclair", recipientName: "Liberal Party of Canada", recipientType: "political_party", amount: 1_700, currency: "CAD", date: "2025-02-28", province: "QC", riding: "Outremont", isCorporate: false },
	{ id: "donation-mitchell-001", donorName: "David Mitchell", donorPersonId: "person-david-mitchell", recipientName: "Conservative Party of Canada", recipientType: "political_party", amount: 1_500, currency: "CAD", date: "2025-01-10", province: "ON", riding: "Ottawa Centre", isCorporate: false },
];

export const disclosures: Disclosure[] = [
	{
		id: "disclosure-mitchell-2025", personName: "Sarah Mitchell", personId: "person-sarah-mitchell",
		position: "Minister of National Defence", department: "National Defence", year: 2025,
		interests: [
			{ category: "corporations", description: "Spouse: David Mitchell — Board Member, L3Harris Technologies Canada Inc.", value: "Over $15,000", province: "ON" },
			{ category: "securities", description: "Spouse: David Mitchell — Partnership interest in Brookfield Asset Management private equity fund", value: "Over $100,000", province: "ON" },
		],
		filingDate: "2025-06-30",
	},
	{
		id: "disclosure-chen-2024", personName: "Michael Chen", personId: "person-michael-chen",
		position: "Former Asst. Deputy Minister, Procurement", department: "National Defence", year: 2024,
		interests: [
			{ category: "corporations", description: "Post-employment: VP at Navigator LLP — government relations consulting", value: "Over $100,000", province: "ON" },
		],
		filingDate: "2024-06-15",
	},
];

export const projects: GACProject[] = [
	{
		id: "gac-plan-001", projectId: "GAC-2025-BFSS-000847",
		title: "Women's Economic Empowerment in Bangladesh",
		description: "Multi-year project to improve economic opportunities for women and girls in rural Bangladesh through skills training and market linkages.",
		department: "Global Affairs Canada", country: "Bangladesh", region: "Asia",
		budget: 18_000_000, currency: "CAD", startDate: "2025-01-01", endDate: "2029-12-31",
		status: "active",
		implementingPartners: [
			{ name: "Plan International Canada", organizationId: "org-plan-international", country: "Canada", role: "Lead Implementer" },
			{ name: "UN Women", country: "Bangladesh", role: "Technical Partner" },
		],
		sector: "Gender Equality",
	},
	{
		id: "gac-plan-002", projectId: "GAC-2024-HUMN-001523",
		title: "Ukraine Humanitarian Assistance Coordination",
		description: "Emergency humanitarian assistance for conflict-affected populations in eastern Ukraine.",
		department: "Global Affairs Canada", country: "Ukraine", region: "Europe",
		budget: 12_000_000, currency: "CAD", startDate: "2024-09-01", endDate: "2026-08-31",
		status: "active",
		implementingPartners: [
			{ name: "Plan International Canada", organizationId: "org-plan-international", country: "Canada", role: "Co-Implementer" },
			{ name: "UNHCR", country: "Ukraine", role: "Lead Agency" },
		],
		sector: "Humanitarian Assistance",
	},
];

// ─── Intelligence Threads ─────────────────────────────────

const now = new Date().toISOString();

export const threads: IntelligenceThread[] = [
	{
		id: "thread-procure-lobby-1",
		signalType: "procurement_lobbying_overlap",
		title: "L3Harris: Simultaneous Defence Contracts & Lobbying",
		description: "L3Harris Technologies holds $73M in active DND contracts while Navigator LLP lobbies the Department of National Defence on their behalf. Four lobbying communications were recorded in the 90 days before the $45M sole-source contract award.",
		confidence: 0.85,
		sources: ["canadabuys", "lobbying_commissioner"],
		nodes: ["org-l3harris", "org-dnd", "org-navigator"],
		edges: [],
		createdAt: now, updatedAt: now,
	},
	{
		id: "thread-revolve-1",
		signalType: "revolving_door",
		title: "Michael Chen: DND ADM → Navigator LLP → Lobbying DND",
		description: "Michael Chen served as Assistant Deputy Minister of Procurement at DND until March 2024. Two months later he joined Navigator LLP as VP Government Relations. He now lobbies his former department on behalf of L3Harris Technologies — the same vendor he oversaw in procurement decisions.",
		confidence: 0.92,
		sources: ["ciec", "lobbying_commissioner"],
		nodes: ["person-michael-chen", "org-navigator", "org-dnd"],
		edges: [],
		createdAt: now, updatedAt: now,
	},
	{
		id: "thread-spousal-1",
		signalType: "spousal_interest_proximity",
		title: "Minister's Spouse on L3Harris Board During $45M Contract",
		description: "Sarah Mitchell, Minister of National Defence, disclosed in her CIEC filing that her spouse David Mitchell is a Board Member of L3Harris Technologies Canada — the recipient of a $45M sole-source DND contract. The Minister met with Navigator LLP lobbyists (representing L3Harris) on July 15 and September 28, 2025.",
		confidence: 0.88,
		sources: ["ciec", "elections_canada", "lobbying_commissioner"],
		nodes: ["person-sarah-mitchell", "person-david-mitchell", "org-l3harris"],
		edges: [],
		createdAt: now, updatedAt: now,
	},
	{
		id: "thread-sole-1",
		signalType: "sole_source_heavy_lobbying",
		title: "$120M Lockheed Martin Sole-Source During 6-Month Lobbying Blitz",
		description: "Lockheed Martin Canada received a $120M sole-source contract for CF-35 maintenance after Hill+Knowlton Canada conducted 6 lobbying communications with DND in the preceding 5 months. CEO Robert LeClair also donated $1,700 to the Liberal Party.",
		confidence: 0.78,
		sources: ["canadabuys", "lobbying_commissioner", "elections_canada"],
		nodes: ["org-lockheed-martin", "org-dnd", "org-hill-knowlton"],
		edges: [],
		createdAt: now, updatedAt: now,
	},
	{
		id: "thread-intl-1",
		signalType: "international_layering",
		title: "Plan International: $30M GAC Funding + Domestic Contracts + Lobbying",
		description: "Plan International Canada receives $30M in GAC international assistance funding while simultaneously holding a $2.3M domestic IRCC contract and registered to lobby the federal government. This creates a multi-layered revenue stream from the same government.",
		confidence: 0.65,
		sources: ["gac", "canadabuys", "lobbying_commissioner"],
		nodes: ["org-plan-international", "org-dnd"],
		edges: [],
		createdAt: now, updatedAt: now,
	},
	{
		id: "thread-donate-1",
		signalType: "donation_proximity_correlation",
		title: "Brookfield: $40K Liberal Donations → $8.5M Government Contract",
		description: "Brookfield Asset Management donated $40,000 to the Liberal Party of Canada across two contributions (Nov 2024, Mar 2025). In June 2025, Brookfield received an $8.5M contract from Public Services and Procurement Canada. David Mitchell, spouse of Defence Minister Sarah Mitchell, is a Brookfield Partner.",
		confidence: 0.71,
		sources: ["elections_canada", "canadabuys"],
		nodes: ["org-brookfield", "person-david-mitchell"],
		edges: [],
		createdAt: now, updatedAt: now,
	},
	{
		id: "thread-mandate-1",
		signalType: "mandate_divergence",
		title: "Defence Sole-Source Contracts Up 40% Despite Competitive Bidding Mandate",
		description: "The Minister's mandate letter explicitly directs increased competitive bidding and Indigenous procurement. Yet DND sole-source contracts increased 40% year-over-year, with $265M in sole-source awards to just three defence contractors. Indigenous procurement remains below 1% in defence spending.",
		confidence: 0.55,
		sources: ["canadabuys"],
		nodes: ["org-dnd", "org-l3harris", "org-lockheed-martin", "org-general-dynamics"],
		edges: [],
		createdAt: now, updatedAt: now,
	},
];

export const brief: Brief = {
	id: "brief-daily",
	title: "CivicIntel Daily Intelligence Brief",
	summary: "7 signals detected across federal data sources. L3Harris Technologies appears in procurement, lobbying, and ministerial disclosure data simultaneously — forming the densest connection cluster in this analysis.",
	sections: [
		{
			title: "Executive Summary",
			content: "Today's sweep of 5 federal data sources detected 7 active intelligence threads. The L3Harris Technologies cluster is the most significant: $73M in DND contracts, 4 lobbying communications by a former DND executive, and a spousal interest disclosure from the Minister of National Defence. Three additional signals involve Lockheed Martin, Brookfield Asset Management, and Plan International.",
			signalTypes: ["procurement_lobbying_overlap"],
		},
		{
			title: "Critical: L3Harris Triangle",
			content: "Three independent signals converge on L3Harris Technologies: (1) procurement-lobbying overlap — $73M in contracts while being lobbied for, (2) revolving door — former DND ADM Michael Chen now lobbies DND for L3Harris via Navigator LLP, (3) spousal interest — Minister of National Defence's spouse David Mitchell sits on L3Harris's board. This is the highest-density connection cluster in the dataset.",
			signalTypes: ["procurement_lobbying_overlap", "revolving_door", "spousal_interest_proximity"],
		},
		{
			title: "Spending Analysis",
			content: "$270.8M in active government contracts detected across 6 awards. DND accounts for $260M (96%). Top vendors: Lockheed Martin ($120M), General Dynamics ($67M), L3Harris ($73M). 72% of contract value is sole-source. Zero Indigenous-owned businesses in the defence contract portfolio.",
		},
		{
			title: "Lobbying Activity",
			content: "12 lobbying communications targeting DND in the current reporting period. Navigator LLP and Hill+Knowlton are the most active firms. Both exclusively represent defence contractors. Michael Chen (Navigator) and James Patterson (H+K) collectively met with senior DND officials 10 times.",
		},
		{
			title: "Political Donations",
			content: "$43,200 in political donations from tracked entities. Brookfield Asset Management leads with $40,000 to the Liberal Party. Defence sector executives donated $3,200 individually. All donations are within legal limits but correlate temporally with contract awards.",
		},
		{
			title: "Mandate Watch",
			content: "The government's mandate commitment to increase competitive bidding and Indigenous procurement to 5% diverges sharply from DND spending. Sole-source contracts increased 40% year-over-year. Indigenous procurement in defence remains below 1%.",
		},
	],
	entityIds: threads.flatMap(t => t.nodes),
	confidence: 0.76,
	generatedAt: now,
};

export const sweepDelta: SweepDelta = {
	newContracts: contracts.length,
	newFilings: filings.length,
	newDonations: donations.length,
	newDisclosures: disclosures.length,
	newProjects: projects.length,
	newSignals: threads.length,
};

// ─── Timeline Events ─────────────────────────────────────

export interface TimelineEvent {
	date: string;
	type: "contract" | "lobbying" | "donation" | "disclosure" | "appointment" | "filing";
	title: string;
	entityIds: string[];
	detail: string;
	sourceUrl: string;
}

export const timelineEvents: TimelineEvent[] = [
	// 2024 — The Setup
	{ date: "2024-01-15", type: "appointment", title: "Michael Chen appointed ADM Procurement at DND", entityIds: ["person-michael-chen", "org-dnd"], detail: "Chen assumes oversight of all defence procurement decisions including tactical systems and electronic warfare programs.", sourceUrl: "https://www.canada.ca/en/department-national-defence.html" },
	{ date: "2024-03-31", type: "appointment", title: "Michael Chen resigns from DND", entityIds: ["person-michael-chen", "org-dnd"], detail: "Chen leaves his ADM position after 4 years. No cooling-off period violation noted — but questions raised about subsequent employment.", sourceUrl: "https://ciec-ccie.parl.gc.ca/" },
	{ date: "2024-05-01", type: "appointment", title: "Michael Chen joins Navigator LLP", entityIds: ["person-michael-chen", "org-navigator"], detail: "Only 31 days after leaving DND, Chen joins Navigator LLP as VP Government Relations. Navigator is one of Canada's largest lobbying firms.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2024-06-15", type: "disclosure", title: "Chen files CIEC disclosure", entityIds: ["person-michael-chen"], detail: "Discloses post-employment at Navigator LLP. Income reported as over $100,000.", sourceUrl: "https://ciec-ccie.parl.gc.ca/" },
	{ date: "2024-11-20", type: "donation", title: "Brookfield donates $15K to Liberal Party", entityIds: ["org-brookfield"], detail: "Brookfield Asset Management makes corporate donation to the Liberal Party of Canada, Toronto Centre riding.", sourceUrl: "https://www.elections.ca/" },

	// 2025 — The Escalation
	{ date: "2025-01-10", type: "donation", title: "David Mitchell donates to Conservative Party", entityIds: ["person-david-mitchell"], detail: "Spouse of Defence Minister donates $1,500 to Conservative Party. David Mitchell is a board member of L3Harris Technologies.", sourceUrl: "https://www.elections.ca/" },
	{ date: "2025-02-28", type: "donation", title: "Robert LeClair donates to Liberal Party", entityIds: ["person-robert-leclair"], detail: "Lockheed Martin Canada CEO donates $1,700 to the Liberal Party from Outremont riding.", sourceUrl: "https://www.elections.ca/" },
	{ date: "2025-03-15", type: "donation", title: "Brookfield donates $25K to Liberal Party", entityIds: ["org-brookfield"], detail: "Second corporate donation brings total to $40,000 in 4 months.", sourceUrl: "https://www.elections.ca/" },
	{ date: "2025-04-01", type: "appointment", title: "Sarah Mitchell appointed Minister of National Defence", entityIds: ["person-sarah-mitchell", "org-dnd"], detail: "Mitchell becomes Minister. Her spouse David Mitchell is a board member of L3Harris Technologies and Partner at Brookfield Asset Management.", sourceUrl: "https://www.canada.ca/en/privy-council.html" },
	{ date: "2025-04-10", type: "lobbying", title: "Hill+Knowlton meets DND on Lockheed Martin behalf", entityIds: ["org-hill-knowlton", "org-lockheed-martin", "org-dnd"], detail: "James Patterson meets DND Aerospace Director to discuss CF-35 maintenance support extension.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-05-01", type: "filing", title: "Navigator LLP registers to lobby for L3Harris", entityIds: ["org-navigator", "org-l3harris", "person-michael-chen"], detail: "Michael Chen registers as lobbyist for L3Harris Technologies — his former department's vendor. Registration number LREG-2025-00412.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-05-12", type: "lobbying", title: "Plan International meets IRCC", entityIds: ["org-plan-international", "person-marie-fortier"], detail: "Marie Fortier meets IRCC Director General to discuss settlement services funding renewal.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-05-15", type: "lobbying", title: "H+K meets DND on Quebec industrial benefits", entityIds: ["org-hill-knowlton", "org-lockheed-martin", "org-dnd"], detail: "Patterson discusses industrial benefits for Quebec with DND Procurement Staff and Innovation Canada.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-06-01", type: "contract", title: "Brookfield receives $8.5M PSPC contract", entityIds: ["org-brookfield"], detail: "Public Services and Procurement Canada awards Brookfield Asset Management an $8.5M advisory contract for federal real property portfolio.", sourceUrl: "https://buyandsell.gc.ca/" },
	{ date: "2025-06-20", type: "lobbying", title: "H+K emails DND on contract negotiations", entityIds: ["org-hill-knowlton", "org-dnd"], detail: "Email exchange with DND Finance regarding CF-35 contract value negotiations.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-06-30", type: "disclosure", title: "Minister Mitchell files CIEC disclosure", entityIds: ["person-sarah-mitchell", "person-david-mitchell", "org-l3harris", "org-brookfield"], detail: "Discloses spouse David Mitchell's board membership at L3Harris ($15K+) and Brookfield partnership ($100K+). This creates a direct conflict with her procurement authority.", sourceUrl: "https://ciec-ccie.parl.gc.ca/" },
	{ date: "2025-07-01", type: "contract", title: "Lockheed Martin receives $120M sole-source contract", entityIds: ["org-lockheed-martin", "org-dnd"], detail: "DND awards Lockheed Martin Canada a $120M sole-source contract for CF-35 fighter jet maintenance. After 4 lobbying communications in 3 months.", sourceUrl: "https://buyandsell.gc.ca/" },
	{ date: "2025-07-08", type: "lobbying", title: "H+K meets DND Legal on sole-source rationale", entityIds: ["org-hill-knowlton", "org-dnd"], detail: "Patterson meets DND Legal to prepare sole-source rationale for the Lockheed Martin contract.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-07-15", type: "lobbying", title: "Michael Chen meets Minister Mitchell", entityIds: ["person-michael-chen", "person-sarah-mitchell", "org-navigator", "org-l3harris"], detail: "Former DND ADM Chen, now lobbying for L3Harris, meets with Minister Mitchell to discuss tactical comms procurement timeline. Her spouse is on L3Harris's board.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-07-19", type: "lobbying", title: "Plan International meets GAC", entityIds: ["org-plan-international", "person-marie-fortier"], detail: "Meeting with GAC Assistant Deputy Minister on youth refugee program expansion.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-08-14", type: "lobbying", title: "H+K calls DND on maintenance schedule", entityIds: ["org-hill-knowlton", "org-dnd"], detail: "Call with DND Operations regarding CF-35 maintenance schedule alignment.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-08-22", type: "lobbying", title: "Navigator meets DND on sole-source justification", entityIds: ["org-navigator", "org-l3harris", "org-dnd"], detail: "Chen meets DND Procurement Director to discuss sole-source justification for L3Harris tactical systems.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-09-01", type: "contract", title: "General Dynamics receives $67M DND contract", entityIds: ["org-general-dynamics", "org-dnd"], detail: "Competitive contract for LAV 6.0 fleet modernization with enhanced protection systems.", sourceUrl: "https://buyandsell.gc.ca/" },
	{ date: "2025-09-02", type: "lobbying", title: "H+K pre-award meeting with Minister Mitchell", entityIds: ["org-hill-knowlton", "person-sarah-mitchell", "org-dnd"], detail: "Final pre-award confirmation meeting with Minister Mitchell and DND Procurement Director.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-09-10", type: "lobbying", title: "Navigator calls DND on specs", entityIds: ["org-navigator", "org-l3harris", "org-dnd"], detail: "Chen calls DND Technical Staff regarding contract specifications review for L3Harris systems.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-09-28", type: "lobbying", title: "Navigator meets Minister Mitchell pre-award", entityIds: ["person-michael-chen", "person-sarah-mitchell", "org-navigator", "org-l3harris"], detail: "Final pre-award discussion. Chen meets Minister Mitchell directly. Her spouse is on L3Harris's board.", sourceUrl: "https://lobbycanada.gc.ca/" },
	{ date: "2025-10-01", type: "contract", title: "L3Harris receives $45M sole-source contract", entityIds: ["org-l3harris", "org-dnd"], detail: "DND awards L3Harris Technologies a $45M sole-source contract for tactical communication systems. Awarded 2 days after Chen's meeting with the Minister.", sourceUrl: "https://buyandsell.gc.ca/" },
	{ date: "2026-01-01", type: "contract", title: "L3Harris receives $28M additional sole-source", entityIds: ["org-l3harris", "org-dnd"], detail: "Second sole-source contract for electronic warfare suite upgrade on Halifax-class frigates.", sourceUrl: "https://buyandsell.gc.ca/" },
];

// ─── Source URLs (real Canadian government data portals) ──

export const sourceLinks: Record<string, { label: string; url: string; description: string }> = {
	canadabuys: { label: "CanadaBuys", url: "https://buyandsell.gc.ca/", description: "Proactive disclosure of government contracts over $10,000" },
	lobbying_commissioner: { label: "Office of the Commissioner of Lobbying", url: "https://lobbycanada.gc.ca/", description: "Lobbyist registration and monthly communication reports" },
	ciec: { label: "Conflict of Interest and Ethics Commissioner", url: "https://ciec-ccie.parl.gc.ca/", description: "Public summaries of disclosed interests for public office holders" },
	elections_canada: { label: "Elections Canada", url: "https://www.elections.ca/", description: "Political contribution data and financial returns" },
	gac: { label: "Global Affairs Canada", url: "https://www.international.gc.ca/", description: "International assistance project data and development funding" },
	open_canada_orgs: { label: "Open Government", url: "https://open.canada.ca/", description: "Federal corporation registry and organizational data" },
	disclosure_clerk: { label: "Office of the Disclosure Clerk", url: "https://www.ourcommons.ca/", description: "Parliamentary disclosure records" },
};

// ─── Additional connection metadata ──────────────────────

export interface ConnectionStrength {
	fromId: string;
	toId: string;
	strength: number; // 0-1
	signals: string[];
	summary: string;
}

export const connectionStrengths: ConnectionStrength[] = [
	{ fromId: "org-l3harris", toId: "org-dnd", strength: 0.92, signals: ["procurement_lobbying_overlap", "sole_source_heavy_lobbying", "spousal_interest_proximity"], summary: "$73M in sole-source contracts, 4 lobbying comms, Minister's spouse on board" },
	{ fromId: "person-michael-chen", toId: "org-dnd", strength: 0.88, signals: ["revolving_door", "procurement_lobbying_overlap"], summary: "Former ADM now lobbies former department for L3Harris" },
	{ fromId: "person-sarah-mitchell", toId: "org-l3harris", strength: 0.85, signals: ["spousal_interest_proximity", "procurement_lobbying_overlap"], summary: "Minister's spouse is L3Harris board member; met L3Harris lobbyists" },
	{ fromId: "org-lockheed-martin", toId: "org-dnd", strength: 0.78, signals: ["sole_source_heavy_lobbying"], summary: "$120M sole-source after 6 lobbying communications" },
	{ fromId: "person-david-mitchell", toId: "org-l3harris", strength: 0.82, signals: ["spousal_interest_proximity"], summary: "Board member; spouse is Minister of National Defence" },
	{ fromId: "org-brookfield", toId: "person-david-mitchell", strength: 0.65, signals: ["donation_proximity_correlation"], summary: "Employer of Minister's spouse; donated $40K to Liberals; received $8.5M contract" },
	{ fromId: "org-hill-knowlton", toId: "org-dnd", strength: 0.72, signals: ["sole_source_heavy_lobbying"], summary: "6 lobbying communications for Lockheed Martin" },
	{ fromId: "org-plan-international", toId: "org-dnd", strength: 0.45, signals: ["international_layering"], summary: "$30M GAC funding + $2.3M IRCC contract + lobbying registered" },
];
