/**
 * CivicIntel — Global Store (Zustand)
 *
 * Pre-populated with seed data. No async initialization needed.
 * Supports URL state sync for deep linking.
 */
import { create } from "zustand";
import {
	type Brief,
	brief,
	type Contract,
	contracts,
	filings,
	type GraphEdge,
	type GraphNode,
	graphEdges,
	graphNodes,
	type IntelligenceThread,
	type LobbyingFiling,
	type Organization,
	organizations,
	type Person,
	people,
	type SweepDelta,
	sweepDelta,
	threads,
} from "./data";

export type ViewTab =
	| "monitor"
	| "brief"
	| "explore"
	| "timeline"
	| "signals"
	| "community";

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

// Navigation state that can be synced to URL
export interface NavigationState {
	view: ViewTab;
	focusEntity: string | null;
	focusThread: string | null;
	signalFilter: string;
	severityFilter: string;
}

interface CivicStore {
	// Navigation
	activeView: ViewTab;
	setActiveView: (view: ViewTab) => void;

	// Cross-view linking state
	focusThread: string | null;
	setFocusThread: (id: string | null) => void;
	focusEntity: string | null;
	setFocusEntity: (id: string | null) => void;

	// Navigation helper for cross-view linking
	navigateTo: (options: {
		view: ViewTab;
		focusEntity?: string | null;
		focusThread?: string | null;
	}) => void;

	// Get current navigation state for URL sync
	getNavigationState: () => NavigationState;

	// Restore state from URL
	restoreFromURL: (state: Partial<NavigationState>) => void;

	// Theme
	theme: ThemeVariant;
	setTheme: (theme: ThemeVariant) => void;

	// Sweep state
	sweepRunning: boolean;
	sweepLastRun: string | null;
	sweepCount: number;
	sweepDelta: SweepDelta;
	setSweepState: (state: {
		running?: boolean;
		lastRun?: string | null;
		count?: number;
	}) => void;

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

	// Explorer (legacy - use focusEntity instead)
	explorerFocusEntity: string | null;
	setExplorerFocusEntity: (id: string | null) => void;
}

export const useCivicStore = create<CivicStore>((set, get) => ({
	// Navigation
	activeView: "monitor",
	setActiveView: (view) => set({ activeView: view }),

	// Cross-view linking
	focusThread: null,
	setFocusThread: (id) => set({ focusThread: id }),
	focusEntity: null,
	setFocusEntity: (id) => set({ focusEntity: id }),

	// Navigation helper
	navigateTo: (options) => {
		set({
			activeView: options.view,
			focusEntity: options.focusEntity ?? null,
			focusThread: options.focusThread ?? null,
		});
	},

	// Get current navigation state
	getNavigationState: () => ({
		view: get().activeView,
		focusEntity: get().focusEntity,
		focusThread: get().focusThread,
		signalFilter: "all",
		severityFilter: "all",
	}),

	// Restore from URL
	restoreFromURL: (state) => {
		if (state.view) set({ activeView: state.view });
		if (state.focusEntity !== undefined)
			set({ focusEntity: state.focusEntity });
		if (state.focusThread !== undefined)
			set({ focusThread: state.focusThread });
	},

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
			alerts: prev.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
		})),

	// Search
	searchQuery: "",
	setSearchQuery: (q) => set({ searchQuery: q }),

	// Explorer (legacy compatibility)
	explorerFocusEntity: null,
	setExplorerFocusEntity: (id) =>
		set({ focusEntity: id, explorerFocusEntity: id }),
}));
