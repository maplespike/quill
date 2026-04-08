/**
 * CivicIntel — Global Store (Zustand)
 *
 * Manages: active view, theme, sweep state, seed data, signal threads.
 */

import { create } from "zustand";
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
import type { PipelineResult } from "./pipeline";

export type ViewTab = "monitor" | "brief" | "explore" | "signals" | "community";
export type ThemeVariant =
	| "nightwatch"
	| "phosphor"
	| "arctic"
	| "solarized"
	| "parchment";

export interface SignalAlert {
	id: string;
	thread: IntelligenceThread;
	dismissed: boolean;
	read: boolean;
	timestamp: number;
}

interface CivicStore {
	// Navigation
	activeView: ViewTab;
	setActiveView: (view: ViewTab) => void;

	// Theme
	theme: ThemeVariant;
	setTheme: (theme: ThemeVariant) => void;

	// Sweep state
	sweepRunning: boolean;
	sweepLastRun: string | null;
	sweepNextRun: string | null;
	sweepCount: number;
	sweepDelta: PipelineResult['sweepDelta'] | null;
	setSweepState: (state: {
		running?: boolean;
		lastRun?: string | null;
		nextRun?: string | null;
		count?: number;
		delta?: PipelineResult['sweepDelta'];
	}) => void;

	// Seed data
	contracts: Contract[];
	filings: LobbyingFiling[];
	donations: Donation[];
	disclosures: Disclosure[];
	projects: GACProject[];
	people: Person[];
	organizations: Organization[];
	setSeedData: (data: {
		contracts: Contract[];
		filings: LobbyingFiling[];
		donations: Donation[];
		disclosures: Disclosure[];
		projects: GACProject[];
		people: Person[];
		organizations: Organization[];
	}) => void;

	// Intelligence
	threads: IntelligenceThread[];
	brief: Brief | null;
	setIntelligence: (threads: IntelligenceThread[], brief: Brief | null) => void;

	// Signals / Alerts
	alerts: SignalAlert[];
	addAlert: (thread: IntelligenceThread) => void;
	dismissAlert: (id: string) => void;
	readAlert: (id: string) => void;
	clearAlerts: () => void;

	// Search
	searchQuery: string;
	setSearchQuery: (q: string) => void;

	// Explorer filters
	explorerEntityType: string | null;
	setExplorerEntityType: (type: string | null) => void;
	explorerFocusEntity: string | null;
	setExplorerFocusEntity: (id: string | null) => void;
}

export const useCivicStore = create<CivicStore>((set) => ({
	// Navigation
	activeView: "monitor",
	setActiveView: (view) => set({ activeView: view }),

	// Theme
	theme: "nightwatch",
	setTheme: (theme) => {
		if (typeof document !== "undefined") {
			document.documentElement.setAttribute("data-theme", theme);
		}
		set({ theme });
	},

	// Sweep state
	sweepRunning: false,
	sweepLastRun: null,
	sweepNextRun: null,
	sweepCount: 0,
	sweepDelta: null,
	setSweepState: (state) =>
		set((prev) => ({
			sweepRunning: state.running ?? prev.sweepRunning,
			sweepLastRun: state.lastRun ?? prev.sweepLastRun,
			sweepNextRun: state.nextRun ?? prev.sweepNextRun,
			sweepCount: state.count ?? prev.sweepCount,
			sweepDelta: state.delta ?? prev.sweepDelta,
		})),

	// Seed data
	contracts: [],
	filings: [],
	donations: [],
	disclosures: [],
	projects: [],
	people: [],
	organizations: [],
	setSeedData: (data) => set(data),

	// Intelligence
	threads: [],
	brief: null,
	setIntelligence: (threads, brief) => set({ threads, brief }),

	// Signals / Alerts
	alerts: [],
	addAlert: (thread) =>
		set((prev) => ({
			alerts: [
				{
					id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
					thread,
					dismissed: false,
					read: false,
					timestamp: Date.now(),
				},
				...prev.alerts,
			],
		})),
	dismissAlert: (id) =>
		set((prev) => ({
			alerts: prev.alerts.map((a) =>
				a.id === id ? { ...a, dismissed: true } : a,
			),
		})),
	readAlert: (id) =>
		set((prev) => ({
			alerts: prev.alerts.map((a) =>
				a.id === id ? { ...a, read: true } : a,
			),
		})),
	clearAlerts: () => set({ alerts: [] }),

	// Search
	searchQuery: "",
	setSearchQuery: (q) => set({ searchQuery: q }),

	// Explorer filters
	explorerEntityType: null,
	setExplorerEntityType: (type) => set({ explorerEntityType: type }),
	explorerFocusEntity: null,
	setExplorerFocusEntity: (id) => set({ explorerFocusEntity: id }),
}));
