/**
 * Seed Data — Realistic Canadian Government Intelligence Data
 *
 * Produces interconnected data that generates "holy shit" connection threads
 * when run through the signal detection pipeline.
 *
 * Thread 1: Procurement-Lobbying Overlap
 *   L3Harris Technologies → $45M sole-source DND contract + lobbied DND 4x
 *
 * Thread 2: Revolving Door
 *   Michael Chen (former DND ADM) → now at Navigator LLP → lobbying DND for L3Harris
 *
 * Thread 3: Spousal Interest Proximity
 *   Minister Sarah Mitchell (DND) → spouse David Mitchell on L3Harris board
 *
 * Thread 4: Sole-Source + Heavy Lobbying
 *   Lockheed Martin Canada → $120M sole-source + Hill+Knowlton lobbied DND 6x
 *
 * Thread 5: International Layering
 *   Plan International Canada → GAC project ($18M) + domestic contract ($2.3M) + registered lobbying
 *
 * Thread 6: Donation-Proximity Correlation
 *   Brookfield Asset Management → donated to Liberal Party → government contract
 *
 * Thread 7: Mandate Divergence
 *   Mandate letter promises competitive bidding reform → sole-source contracts increased 40%
 */

import { generateId, nowISO } from "../sources/types";
import type { Contract } from "../types/contract";
import type { Disclosure, Interest } from "../types/disclosure";
import type { Donation } from "../types/donation";
import type { GACProject } from "../types/gac";
import type { LobbyingFiling } from "../types/lobbying";
import type { Organization } from "../types/organization";
import type { Person } from "../types/person";

// ─── Helper ───────────────────────────────────────────────
const ts = "2026-03-15T12:00:00.000Z";

// ─── People ───────────────────────────────────────────────

export const seedPeople: Person[] = [
	{
		id: "person-sarah-mitchell",
		names: ["Sarah Mitchell", "S. Mitchell", "Hon. Sarah Mitchell"],
		firstName: "Sarah",
		lastName: "Mitchell",
		roles: [
			{
				title: "Minister of National Defence",
				organization: "Department of National Defence",
				department: "National Defence",
				startDate: "2025-04-01",
				category: "elected",
				source: "disclosure_clerk",
			},
		],
		relationships: [
			{
				type: "spousal",
				targetId: "person-david-mitchell",
				targetType: "person",
				label: "Spouse",
				source: "disclosure_clerk",
			},
		],
		province: "ON",
		city: "Ottawa",
		source: "disclosure_clerk",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "person-david-mitchell",
		names: ["David Mitchell", "David R. Mitchell"],
		firstName: "David",
		lastName: "Mitchell",
		roles: [
			{
				title: "Board Member",
				organization: "L3Harris Technologies Canada",
				startDate: "2024-06-01",
				category: "corporate",
				source: "disclosure_clerk",
			},
			{
				title: "Partner",
				organization: "Brookfield Asset Management",
				startDate: "2022-01-15",
				category: "corporate",
				source: "disclosure_clerk",
			},
		],
		relationships: [
			{
				type: "spousal",
				targetId: "person-sarah-mitchell",
				targetType: "person",
				label: "Spouse",
				source: "disclosure_clerk",
			},
			{
				type: "board_membership",
				targetId: "org-l3harris",
				targetType: "organization",
				label: "Board Member",
				source: "disclosure_clerk",
			},
		],
		province: "ON",
		city: "Ottawa",
		source: "disclosure_clerk",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "person-michael-chen",
		names: ["Michael Chen", "Mike Chen", "M. Chen"],
		firstName: "Michael",
		lastName: "Chen",
		roles: [
			{
				title: "Assistant Deputy Minister, Procurement",
				organization: "Department of National Defence",
				department: "National Defence",
				startDate: "2020-01-01",
				endDate: "2024-03-31",
				category: "civil_service",
				source: "disclosure_clerk",
			},
			{
				title: "Vice President, Government Relations",
				organization: "Navigator LLP",
				startDate: "2024-05-01",
				category: "lobbyist",
				source: "lobbying_commissioner",
			},
		],
		relationships: [],
		province: "ON",
		city: "Toronto",
		source: "lobbying_commissioner",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "person-james-patterson",
		names: ["James Patterson", "Jim Patterson"],
		firstName: "James",
		lastName: "Patterson",
		roles: [
			{
				title: "Senior Consultant",
				organization: "Hill+Knowlton Canada",
				startDate: "2023-01-01",
				category: "lobbyist",
				source: "lobbying_commissioner",
			},
		],
		relationships: [],
		province: "ON",
		city: "Ottawa",
		source: "lobbying_commissioner",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "person-marie-fortier",
		names: ["Marie Fortier", "M. Fortier"],
		firstName: "Marie",
		lastName: "Fortier",
		roles: [
			{
				title: "Director, Government Programs",
				organization: "Plan International Canada",
				startDate: "2021-09-01",
				category: "corporate",
				source: "open_canada_orgs",
			},
		],
		relationships: [],
		province: "ON",
		city: "Toronto",
		source: "open_canada_orgs",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "person-robert-leclair",
		names: ["Robert LeClair", "Rob LeClair"],
		firstName: "Robert",
		lastName: "LeClair",
		roles: [
			{
				title: "CEO",
				organization: "Lockheed Martin Canada",
				startDate: "2022-03-01",
				category: "corporate",
				source: "open_canada_orgs",
			},
		],
		relationships: [],
		province: "QC",
		city: "Montreal",
		source: "open_canada_orgs",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
];

// ─── Organizations ────────────────────────────────────────

export const seedOrganizations: Organization[] = [
	{
		id: "org-l3harris",
		names: ["L3Harris Technologies", "L3Harris Technologies Canada", "L3Harris", "L-3 Harris"],
		type: "corporation",
		registrations: [
			{ number: "INC-4521", jurisdiction: "Canada", type: "federal", status: "active", dateFiled: "2020-01-15", source: "open_canada_orgs" },
		],
		industry: "Defence & Aerospace",
		province: "ON",
		city: "Ottawa",
		source: "open_canada_orgs",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "org-lockheed-martin",
		names: ["Lockheed Martin Canada", "Lockheed Martin Corporation", "Lockheed Martin", "LMC"],
		type: "corporation",
		registrations: [
			{ number: "INC-3892", jurisdiction: "Canada", type: "federal", status: "active", dateFiled: "2018-06-20", source: "open_canada_orgs" },
		],
		industry: "Defence & Aerospace",
		province: "QC",
		city: "Montreal",
		source: "open_canada_orgs",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "org-hill-knowlton",
		names: ["Hill+Knowlton Canada", "Hill and Knowlton", "H+K Canada", "Hill+Knowlton Strategies"],
		type: "lobbying_firm",
		registrations: [
			{ number: "LOBBY-0042", jurisdiction: "Canada", type: "federal", status: "active", dateFiled: "2015-01-01", source: "lobbying_commissioner" },
		],
		industry: "Government Relations",
		province: "ON",
		city: "Ottawa",
		source: "lobbying_commissioner",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "org-navigator",
		names: ["Navigator LLP", "Navigator", "Navigator Ltd"],
		type: "lobbying_firm",
		registrations: [
			{ number: "LOBBY-0118", jurisdiction: "Canada", type: "federal", status: "active", dateFiled: "2017-03-15", source: "lobbying_commissioner" },
		],
		industry: "Government Relations",
		province: "ON",
		city: "Toronto",
		source: "lobbying_commissioner",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "org-plan-international",
		names: ["Plan International Canada", "Plan Canada", "Plan International"],
		type: "non_profit",
		registrations: [
			{ number: "NP-7823", jurisdiction: "Canada", type: "federal", status: "active", dateFiled: "2010-09-01", source: "open_canada_orgs" },
		],
		industry: "International Development",
		province: "ON",
		city: "Toronto",
		source: "open_canada_orgs",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "org-brookfield",
		names: ["Brookfield Asset Management", "Brookfield", "BAM"],
		type: "corporation",
		registrations: [
			{ number: "INC-1001", jurisdiction: "Canada", type: "federal", status: "active", dateFiled: "2005-01-01", source: "open_canada_orgs" },
		],
		industry: "Asset Management",
		province: "ON",
		city: "Toronto",
		source: "open_canada_orgs",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "org-general-dynamics",
		names: ["General Dynamics Canada", "General Dynamics", "GD Canada"],
		type: "corporation",
		registrations: [
			{ number: "INC-2245", jurisdiction: "Canada", type: "federal", status: "active", dateFiled: "2012-04-15", source: "open_canada_orgs" },
		],
		industry: "Defence & Aerospace",
		province: "ON",
		city: "Ottawa",
		source: "open_canada_orgs",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "org-dnd",
		names: ["Department of National Defence", "National Defence", "DND", "National Defence and the Canadian Armed Forces"],
		type: "government_agency",
		registrations: [],
		industry: "Government",
		province: "ON",
		city: "Ottawa",
		source: "open_canada_orgs",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
];

// ─── Contracts ────────────────────────────────────────────

export const seedContracts: Contract[] = [
	// Thread 1 + 3: L3Harris sole-source DND contract (spousal interest + procurement-lobbying overlap)
	{
		id: "contract-l3harris-dnd-001",
		contractNumber: "W8476-240001",
		title: "Tactical Communication Systems Upgrade",
		description: "Sole-source contract for the procurement of advanced tactical communication systems for the Canadian Armed Forces.",
		vendorName: "L3Harris Technologies Canada",
		vendorId: "org-l3harris",
		department: "National Defence",
		value: 45_000_000,
		currency: "CAD",
		startDate: "2025-10-01",
		endDate: "2027-09-30",
		status: "active",
		isSoleSource: true,
		province: "ON",
		commodityType: "Communication Systems",
		source: "open_canada_contracts",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	// Thread 4: Lockheed Martin sole-source + heavy lobbying
	{
		id: "contract-lockheed-dnd-001",
		contractNumber: "W8476-240002",
		title: "CF-35 Fighter Jet Maintenance Support",
		description: "Sole-source contract for ongoing maintenance and support services for the CF-35 fighter jet fleet.",
		vendorName: "Lockheed Martin Canada",
		vendorId: "org-lockheed-martin",
		department: "National Defence",
		value: 120_000_000,
		currency: "CAD",
		startDate: "2025-07-01",
		endDate: "2030-06-30",
		status: "active",
		isSoleSource: true,
		province: "QC",
		commodityType: "Aerospace Maintenance",
		source: "open_canada_contracts",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	// Thread 5: Plan International domestic contract
	{
		id: "contract-plan-ircc-001",
		contractNumber: "IRCC-2025-00147",
		title: "Settlement Services for Refugee Youth",
		description: "Contribution agreement for settlement and integration services for refugee youth in Ontario and British Columbia.",
		vendorName: "Plan International Canada",
		vendorId: "org-plan-international",
		department: "Immigration, Refugees and Citizenship Canada",
		value: 2_300_000,
		currency: "CAD",
		startDate: "2025-04-01",
		endDate: "2026-03-31",
		status: "active",
		isSoleSource: false,
		province: "ON",
		commodityType: "Social Services",
		source: "open_canada_contracts",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	// Thread 6: Brookfield contract
	{
		id: "contract-brookfield-pspc-001",
		contractNumber: "PSPC-2025-00892",
		title: "Federal Real Property Management Advisory",
		description: "Competitive contract for advisory services on federal real property portfolio optimization.",
		vendorName: "Brookfield Asset Management",
		vendorId: "org-brookfield",
		department: "Public Services and Procurement Canada",
		value: 8_500_000,
		currency: "CAD",
		startDate: "2025-06-01",
		endDate: "2027-05-31",
		status: "active",
		isSoleSource: false,
		province: "ON",
		commodityType: "Real Estate Advisory",
		source: "open_canada_contracts",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	// Additional contracts for depth
	{
		id: "contract-gd-dnd-001",
		contractNumber: "W8476-240003",
		title: "Armoured Vehicle Fleet Modernization",
		description: "Competitive contract for the modernization of the LAV 6.0 fleet with enhanced protection systems.",
		vendorName: "General Dynamics Canada",
		vendorId: "org-general-dynamics",
		department: "National Defence",
		value: 67_000_000,
		currency: "CAD",
		startDate: "2025-09-01",
		endDate: "2028-08-31",
		status: "active",
		isSoleSource: false,
		province: "ON",
		commodityType: "Armoured Vehicles",
		source: "open_canada_contracts",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "contract-l3harris-dnd-002",
		contractNumber: "W8476-240004",
		title: "Electronic Warfare Suite Upgrade",
		description: "Sole-source contract for upgrading electronic warfare capabilities on Halifax-class frigates.",
		vendorName: "L3Harris Technologies Canada",
		vendorId: "org-l3harris",
		department: "National Defence",
		value: 28_000_000,
		currency: "CAD",
		startDate: "2026-01-01",
		endDate: "2028-12-31",
		status: "active",
		isSoleSource: true,
		province: "ON",
		commodityType: "Electronic Warfare",
		source: "open_canada_contracts",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
];

// ─── Lobbying Filings ─────────────────────────────────────

export const seedFilings: LobbyingFiling[] = [
	// Thread 1: L3Harris lobbying DND (procurement-lobbying overlap)
	{
		id: "filing-l3harris-nav-001",
		filingNumber: "LREG-2025-00412",
		registrant: {
			name: "Michael Chen",
			firmName: "Navigator LLP",
			personId: "person-michael-chen",
			organizationId: "org-navigator",
		},
		clientName: "L3Harris Technologies Canada",
		clientOrganizationId: "org-l3harris",
		subjectMatter: "Defence procurement policy and tactical communication systems acquisition",
		communications: [
			{ date: "2025-07-15", type: "meeting", subjectMatter: "Tactical comms procurement timeline", officials: ["Sarah Mitchell", "DND Procurement Director"], institution: "Department of National Defence" },
			{ date: "2025-08-22", type: "meeting", subjectMatter: "Sole-source justification for tactical systems", officials: ["DND Procurement Director"], institution: "Department of National Defence" },
			{ date: "2025-09-10", type: "call", subjectMatter: "Contract specifications review", officials: ["DND Technical Staff"], institution: "Department of National Defence" },
			{ date: "2025-09-28", type: "meeting", subjectMatter: "Final pre-award discussion", officials: ["Sarah Mitchell"], institution: "Department of National Defence" },
		],
		startDate: "2025-06-01",
		endDate: "2026-05-31",
		activities: ["Meeting with officials", "Policy advice", "Procurement strategy"],
		institution: "Department of National Defence",
		province: "ON",
		source: "lobbying_commissioner",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	// Thread 4: Lockheed Martin lobbying DND via Hill+Knowlton
	{
		id: "filing-lockheed-hk-001",
		filingNumber: "LREG-2025-00389",
		registrant: {
			name: "James Patterson",
			firmName: "Hill+Knowlton Canada",
			personId: "person-james-patterson",
			organizationId: "org-hill-knowlton",
		},
		clientName: "Lockheed Martin Canada",
		clientOrganizationId: "org-lockheed-martin",
		subjectMatter: "Fighter jet maintenance contracts and aerospace industry policy",
		communications: [
			{ date: "2025-04-10", type: "meeting", subjectMatter: "CF-35 maintenance support extension", officials: ["DND Aerospace Director"], institution: "Department of National Defence" },
			{ date: "2025-05-15", type: "meeting", subjectMatter: "Industrial benefits for Quebec", officials: ["DND Procurement Staff", "Innovation Canada"], institution: "Department of National Defence" },
			{ date: "2025-06-20", type: "email", subjectMatter: "Contract value negotiations", officials: ["DND Finance"], institution: "Department of National Defence" },
			{ date: "2025-07-08", type: "meeting", subjectMatter: "Sole-source rationale preparation", officials: ["DND Legal"], institution: "Department of National Defence" },
			{ date: "2025-08-14", type: "call", subjectMatter: "Maintenance schedule alignment", officials: ["DND Operations"], institution: "Department of National Defence" },
			{ date: "2025-09-02", type: "meeting", subjectMatter: "Pre-award confirmation meeting", officials: ["Sarah Mitchell", "DND Procurement Director"], institution: "Department of National Defence" },
		],
		startDate: "2025-03-01",
		endDate: "2026-02-28",
		activities: ["Meeting with officials", "Contract advice", "Industry advocacy"],
		institution: "Department of National Defence",
		province: "ON",
		source: "lobbying_commissioner",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	// Thread 5: Plan International lobbying
	{
		id: "filing-plan-hk-001",
		filingNumber: "LREG-2025-00501",
		registrant: {
			name: "Marie Fortier",
			personId: "person-marie-fortier",
			organizationId: "org-plan-international",
		},
		clientName: "Plan International Canada",
		clientOrganizationId: "org-plan-international",
		subjectMatter: "International development funding and refugee settlement services policy",
		communications: [
			{ date: "2025-05-12", type: "meeting", subjectMatter: "Settlement services funding renewal", officials: ["IRCC Director General"], institution: "Immigration, Refugees and Citizenship Canada" },
			{ date: "2025-07-19", type: "meeting", subjectMatter: "Youth refugee program expansion", officials: ["GAC Assistant Deputy Minister"], institution: "Global Affairs Canada" },
		],
		startDate: "2025-04-01",
		endDate: "2026-03-31",
		activities: ["Meeting with officials", "Funding advocacy"],
		institution: "Immigration, Refugees and Citizenship Canada",
		province: "ON",
		source: "lobbying_commissioner",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
];

// ─── GAC Projects ─────────────────────────────────────────

export const seedProjects: GACProject[] = [
	// Thread 5: Plan International GAC project (international layering)
	{
		id: "gac-plan-001",
		projectId: "GAC-2025-BFSS-000847",
		title: "Women's Economic Empowerment in Bangladesh",
		description: "Multi-year project to improve economic opportunities for women and girls in rural Bangladesh through skills training, microfinance access, and market linkages.",
		department: "Global Affairs Canada",
		country: "Bangladesh",
		region: "Asia",
		budget: 18_000_000,
		currency: "CAD",
		startDate: "2025-01-01",
		endDate: "2029-12-31",
		status: "active",
		implementingPartners: [
			{ name: "Plan International Canada", organizationId: "org-plan-international", country: "Canada", role: "Lead Implementer" },
			{ name: "UN Women", country: "Bangladesh", role: "Technical Partner" },
			{ name: "BRAC", country: "Bangladesh", role: "Local Partner" },
		],
		sector: "Gender Equality",
		source: "gac_projects",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "gac-plan-002",
		projectId: "GAC-2024-HUMN-001523",
		title: "Ukraine Humanitarian Assistance Coordination",
		description: "Emergency humanitarian assistance for conflict-affected populations in eastern Ukraine, including shelter, WASH, and protection services.",
		department: "Global Affairs Canada",
		country: "Ukraine",
		region: "Europe",
		budget: 12_000_000,
		currency: "CAD",
		startDate: "2024-09-01",
		endDate: "2026-08-31",
		status: "active",
		implementingPartners: [
			{ name: "Plan International Canada", organizationId: "org-plan-international", country: "Canada", role: "Co-Implementer" },
			{ name: "UNHCR", country: "Ukraine", role: "Lead Agency" },
		],
		sector: "Humanitarian Assistance",
		source: "gac_projects",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
];

// ─── Donations ────────────────────────────────────────────

export const seedDonations: Donation[] = [
	// Thread 6: Brookfield donation
	{
		id: "donation-brookfield-001",
		donorName: "Brookfield Asset Management",
		donorOrganizationId: "org-brookfield",
		recipientName: "Liberal Party of Canada",
		recipientType: "political_party",
		amount: 25_000,
		currency: "CAD",
		date: "2025-03-15",
		province: "ON",
		riding: "Toronto Centre",
		isCorporate: true,
		source: "elections_canada",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "donation-brookfield-002",
		donorName: "Brookfield Asset Management",
		donorOrganizationId: "org-brookfield",
		recipientName: "Liberal Party of Canada",
		recipientType: "political_party",
		amount: 15_000,
		currency: "CAD",
		date: "2024-11-20",
		province: "ON",
		riding: "Toronto Centre",
		isCorporate: true,
		source: "elections_canada",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "donation-leclair-001",
		donorName: "Robert LeClair",
		donorPersonId: "person-robert-leclair",
		recipientName: "Liberal Party of Canada",
		recipientType: "political_party",
		amount: 1_700,
		currency: "CAD",
		date: "2025-02-28",
		province: "QC",
		riding: "Outremont",
		isCorporate: false,
		source: "elections_canada",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
];

// ─── Disclosures (CIEC) ──────────────────────────────────

export const seedDisclosures: Disclosure[] = [
	// Thread 3: Sarah Mitchell's CIEC disclosure showing spousal interest
	{
		id: "disclosure-mitchell-2025",
		personName: "Sarah Mitchell",
		personId: "person-sarah-mitchell",
		position: "Minister of National Defence",
		department: "National Defence",
		year: 2025,
		interests: [
			{
				category: "corporations",
				description: "Spouse: David Mitchell — Board Member, L3Harris Technologies Canada Inc.",
				value: "Over $15,000",
				province: "ON",
			},
			{
				category: "securities",
				description: "Spouse: David Mitchell — Partnership interest in Brookfield Asset Management private equity fund",
				value: "Over $100,000",
				province: "ON",
			},
		],
		province: "ON",
		filingDate: "2025-06-30",
		source: "disclosure_clerk",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
	{
		id: "disclosure-chen-2024",
		personName: "Michael Chen",
		personId: "person-michael-chen",
		position: "Former Assistant Deputy Minister, Procurement",
		department: "National Defence",
		year: 2024,
		interests: [
			{
				category: "corporations",
				description: "Post-employment: Vice President at Navigator LLP — government relations consulting",
				value: "Over $100,000",
				province: "ON",
			},
		],
		province: "ON",
		filingDate: "2024-06-15",
		source: "disclosure_clerk",
		rawData: {},
		createdAt: ts,
		updatedAt: ts,
	},
];

// ─── Full Parsed Data ─────────────────────────────────────

export function getSeedParsedData() {
	return {
		contracts: seedContracts,
		filings: seedFilings,
		donations: seedDonations,
		disclosures: seedDisclosures,
		projects: seedProjects,
	};
}
