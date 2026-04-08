/**
 * CivicIntel — Social Store
 *
 * Manages state for verification, annotations, investigations,
 * expertise, and watch parties.
 */

import { create } from "zustand";
import type {
	Verification,
	Annotation,
	Investigation,
	ShareableBrief,
	CitizenProfile,
	Badge,
	AnalysisSession,
	TrustLevel,
} from "@civic-intel/core";

// ── Mock citizen profile (current user) ───────────────────
const CURRENT_CITIZEN: CitizenProfile = {
	id: "citizen-001",
	name: "Alex Thompson",
	handle: "@alex_t",
	trustLevel: "analyst",
	verificationScore: 78,
	domainTags: ["Defence Procurement", "Lobbying Analysis"],
	badges: [
		{
			id: "b1",
			name: "First Verification",
			description: "Verified your first connection",
			icon: "✓",
			earnedAt: "2024-01-15",
		},
		{
			id: "b2",
			name: "10 Sources Linked",
			description: "Linked 10 primary sources",
			icon: "📚",
			earnedAt: "2024-03-01",
		},
	],
	contributions: 34,
	joinedAt: "2023-06-01",
};

// ── Seed social data ──────────────────────────────────────

const SEED_VERIFICATIONS: Verification[] = [
	{
		id: "v1",
		threadId: "thread-procure-lobby-1",
		type: "verify",
		citizenId: "citizen-002",
		citizenName: "Marie Chen",
		sourceUrl: "https://buyandsell.gc.ca/procurement-data/contract-12345",
		description: "Confirmed via CanadaBuys proactive disclosure. Contract C-2024-12345 was sole-source to L3Harris for F-35 simulators, awarded same month as Navigator LLP lobbying filings.",
		confidenceVote: 0.9,
		createdAt: "2024-11-15T10:30:00Z",
		upvotes: 12,
		downvotes: 1,
	},
	{
		id: "v2",
		threadId: "thread-revolve-1",
		type: "verify",
		citizenId: "citizen-003",
		citizenName: "James Wilson",
		sourceUrl: "https://ciec-ccie.parl.gc.ca/publicsummary/456",
		description: "CIEC public summary #456 confirms Michael Chen disclosed his prior DND employment when registering as a lobbyist.",
		confidenceVote: 0.95,
		createdAt: "2024-11-14T14:20:00Z",
		upvotes: 18,
		downvotes: 0,
	},
	{
		id: "v3",
		threadId: "thread-spousal-1",
		type: "extend",
		citizenId: "citizen-004",
		citizenName: "Priya Patel",
		sourceUrl: "https://www.ourcommons.ca/Committees/en/NDDN/Work",
		description: "Sarah Mitchell also sits on the Standing Committee on National Defence which oversees DND procurement. This creates an additional layer of proximity beyond the spousal interest.",
		confidenceVote: 0.85,
		createdAt: "2024-11-13T09:15:00Z",
		upvotes: 24,
		downvotes: 2,
	},
];

const SEED_ANNOTATIONS: Annotation[] = [
	{
		id: "a1",
		entityId: "org-l3harris-technologies",
		citizenId: "citizen-002",
		citizenName: "Marie Chen",
		content: "L3Harris Technologies was formed from the merger of L3 Technologies and Harris Corporation in 2019. The combined entity became one of the top 10 defence contractors globally.",
		sourceUrl: "https://www.l3harris.com/about",
		tags: ["corporate-history", "defence"],
		createdAt: "2024-11-10T08:00:00Z",
		upvotes: 8,
		downvotes: 0,
		replies: [],
		parentId: null,
	},
	{
		id: "a2",
		entityId: "org-navigator-llp",
		citizenId: "citizen-003",
		citizenName: "James Wilson",
		content: "Navigator LLP has been described as 'the go-to lobbying firm for defence contractors' in multiple news reports. Their client list includes L3Harris, Lockheed Martin, and General Dynamics.",
		sourceUrl: "https://www.theglobeandmail.com/politics/article-navigator-llp-defence",
		tags: ["lobbying", "defence"],
		createdAt: "2024-11-11T12:00:00Z",
		upvotes: 15,
		downvotes: 1,
		replies: [],
		parentId: null,
	},
];

const SEED_INVESTIGATIONS: Investigation[] = [
	{
		id: "inv1",
		title: "DND Sole-Source Contract Pattern Analysis",
		description: "Investigating the pattern of sole-source defence contracts awarded to companies with active lobbying registrations. Focus on L3Harris Technologies and Navigator LLP.",
		status: "open",
		visibility: "public",
		createdBy: "citizen-002",
		contributors: ["citizen-002", "citizen-003", "citizen-004"],
		entityIds: ["org-l3harris-technologies", "org-navigator-llp", "org-department-of-national-defence"],
		threadIds: ["thread-procure-lobby-1", "thread-sole-1", "thread-revolve-1"],
		evidence: [
			{
				id: "e1",
				title: "CanadaBuys proactive disclosure - F-35 simulator contract",
				sourceUrl: "https://buyandsell.gc.ca/procurement-data/contract-12345",
				description: "$45M sole-source contract for F-35 training systems",
				entityTags: ["org-l3harris-technologies", "org-department-of-national-defence"],
				addedBy: "citizen-002",
				addedAt: "2024-11-10T08:00:00Z",
			},
			{
				id: "e2",
				title: "Lobbying communication report - Navigator LLP",
				sourceUrl: "https://lobbycanada.gc.ca/app/secure/ocl/lrs/do/commRpt?comId=67890",
				description: "Monthly communication report showing Navigator lobbying DND for L3Harris",
				entityTags: ["org-navigator-llp", "org-l3harris-technologies"],
				addedBy: "citizen-003",
				addedAt: "2024-11-11T12:00:00Z",
			},
		],
		findings: "Strong evidence of procurement-lobbying overlap. Michael Chen's revolving door from DND ADM to Navigator LLP adds significant weight to the connection.",
		tags: ["defence", "procurement", "lobbying", "sole-source"],
		createdAt: "2024-11-08T10:00:00Z",
		updatedAt: "2024-11-15T16:00:00Z",
	},
];

const SEED_SESSIONS: AnalysisSession[] = [
	{
		id: "session1",
		title: "Budget 2025 Defence Spending Analysis",
		description: "Live analysis of federal budget defence spending allocations and their alignment with mandate promises.",
		status: "scheduled",
		scheduledAt: "2025-04-16T20:00:00Z",
		participants: 0,
		signals: [],
		annotations: [],
	},
	{
		id: "session2",
		title: "Auditor General Report Review",
		description: "Community review and annotation of the latest Auditor General report on defence procurement.",
		status: "completed",
		scheduledAt: "2025-03-01T19:00:00Z",
		startedAt: "2025-03-01T19:00:00Z",
		endedAt: "2025-03-01T21:30:00Z",
		participants: 42,
		signals: ["thread-procure-lobby-1"],
		annotations: ["a1", "a2"],
		recordingUrl: "/recordings/session2",
	},
];

// ── Store ─────────────────────────────────────────────────

interface SocialStore {
	// Citizen profile
	currentCitizen: CitizenProfile;

	// Verifications (Feature 18)
	verifications: Verification[];
	addVerification: (v: Verification) => void;

	// Annotations (Feature 20)
	annotations: Annotation[];
	addAnnotation: (a: Annotation) => void;

	// Investigations (Feature 19)
	investigations: Investigation[];
	addInvestigation: (inv: Investigation) => void;

	// Shareable Briefs (Feature 21)
	shareableBriefs: ShareableBrief[];
	addShareableBrief: (b: ShareableBrief) => void;

	// Sessions (Feature 24)
	sessions: AnalysisSession[];
	addSession: (s: AnalysisSession) => void;

	// Leaderboard
	leaderboard: CitizenProfile[];
}

export const useSocialStore = create<SocialStore>((set) => ({
	currentCitizen: CURRENT_CITIZEN,
	verifications: SEED_VERIFICATIONS,
	addVerification: (v) =>
		set((prev) => ({ verifications: [...prev.verifications, v] })),

	annotations: SEED_ANNOTATIONS,
	addAnnotation: (a) =>
		set((prev) => ({ annotations: [...prev.annotations, a] })),

	investigations: SEED_INVESTIGATIONS,
	addInvestigation: (inv) =>
		set((prev) => ({ investigations: [...prev.investigations, inv] })),

	shareableBriefs: [],
	addShareableBrief: (b) =>
		set((prev) => ({ shareableBriefs: [...prev.shareableBriefs, b] })),

	sessions: SEED_SESSIONS,
	addSession: (s) =>
		set((prev) => ({ sessions: [...prev.sessions, s] })),

	leaderboard: [
		CURRENT_CITIZEN,
		{
			id: "citizen-002",
			name: "Marie Chen",
			handle: "@marie_c",
			trustLevel: "expert",
			verificationScore: 92,
			domainTags: ["Defence Procurement", "International Development"],
			badges: [
				{ id: "b3", name: "Investigation Lead", description: "Led a completed investigation", icon: "🔍", earnedAt: "2024-02-01" },
			],
			contributions: 67,
			joinedAt: "2023-01-15",
		},
		{
			id: "citizen-003",
			name: "James Wilson",
			handle: "@james_w",
			trustLevel: "analyst",
			verificationScore: 81,
			domainTags: ["Lobbying Analysis"],
			badges: [
				{ id: "b4", name: "Cross-Referencer", description: "Connected entities across 3+ data sources", icon: "🔗", earnedAt: "2024-04-01" },
			],
			contributions: 45,
			joinedAt: "2023-03-20",
		},
	],
}));
