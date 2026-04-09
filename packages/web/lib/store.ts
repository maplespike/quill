/**
 * CivicIntel — Global Store (Zustand)
 *
 * Pre-populated with seed data. No async initialization needed.
 */

import { create } from "zustand";
import {
	people, organizations, contracts, filings,
	threads, brief, sweepDelta,
	type IntelligenceThread, type Person, type Organization,
	type Contract, type LobbyingFiling, type Brief, type SweepDelta,
	graphNodes, graphEdges, type GraphNode, type GraphEdge,
} from "./data";

export type ViewTab = "monitor" | "brief" | "explore" | "timeline" | "signals" | "community";
export type ThemeVariant = "nightwatch" | "phosphor" | "arctic" | "solarized" | "parchment";

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
	sweepCount: number;
	sweepDelta: SweepDelta;
	setSweepState: (state: { running?: boolean; lastRun?: string | null; count?: number }) => void;

	// Data
	people: Person[];
	organizations: Organization[];
	contracts: Contract[];
	filings: LobbyingFiling[];
	threads: IntelligenceThread[];
	brief: Brief | null;

	// Graph
	graphNodes: GraphNode[];
	graphEdges: GraphEdge[];

	// Signals / Alerts
	alerts: SignalAlert[];
	dismissAlert: (id: string) => void;
	readAlert: (id: string) => void;

	// Search
	searchQuery: string;
	setSearchQuery: (q: string) => void;

	// Explorer
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

	// Sweep
	sweepRunning: false,
	sweepLastRun: new Date().toISOString(),
	sweepCount: 1,
	sweepDelta,
	setSweepState: (state) =>
		set((prev) => ({
			sweepRunning: state.running ?? prev.sweepRunning,
			sweepLastRun: state.lastRun ?? prev.sweepLastRun,
			sweepCount: state.count ?? prev.sweepCount,
		})),

	// Pre-populated data
	people,
	organizations,
	contracts,
	filings,
	threads,
	brief,

	// Graph
	graphNodes,
	graphEdges,

	// Alerts
	alerts: threads.map((t, i) => ({
		id: "alert-" + i,
		thread: t,
		dismissed: false,
		read: i > 2,
		timestamp: Date.now() - i * 3600000,
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

	// Search
	searchQuery: "",
	setSearchQuery: (q) => set({ searchQuery: q }),

	// Explorer
	explorerFocusEntity: null,
	setExplorerFocusEntity: (id) => set({ explorerFocusEntity: id }),
}));
