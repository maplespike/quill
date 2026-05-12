"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BriefView } from "../components/BriefView";
import { ExplorerView } from "../components/ExplorerView";

// Views
import { MonitorDashboard } from "../components/MonitorDashboard";
import {
	hasCompletedOnboarding,
	OnboardingModal,
} from "../components/OnboardingModal";
import { SignalsView } from "../components/SignalsView";
import { SocialView } from "../components/SocialView";
import { TimelineView } from "../components/TimelineView";
import {
	graphNodes,
	organizations,
	people,
	threads,
	timelineEvents,
} from "../lib/data";
import { useCivicStore, type ViewTab } from "../lib/store";
import { useURLSync } from "../lib/useURLSync";

const TABS: { id: ViewTab; label: string; icon: string }[] = [
	{ id: "monitor", label: "MONITOR", icon: "◉" },
	{ id: "brief", label: "BRIEF", icon: "◆" },
	{ id: "explore", label: "EXPLORE", icon: "◈" },
	{ id: "timeline", label: "TIMELINE", icon: "⟐" },
	{ id: "signals", label: "SIGNALS", icon: "△" },
	{ id: "community", label: "COMMUNITY", icon: "◎" },
];

export default function CivicIntelApp() {
	// URL state sync for deep linking
	useURLSync();
	const {
		activeView,
		setActiveView,
		theme,
		setTheme,
		sweepRunning,
		sweepCount,
		alerts,
		searchQuery,
		setSearchQuery,
		threads,
	} = useCivicStore();
	const [showThemePicker, setShowThemePicker] = useState(false);
	const [showOnboarding, setShowOnboarding] = useState(false);
	const [currentTime, setCurrentTime] = useState(new Date());
	const [bootDone, setBootDone] = useState(false);

	// Boot animation
	useEffect(() => {
		const t = setTimeout(() => setBootDone(true), 600);
		return () => clearTimeout(t);
	}, []);

	// Check onboarding on first load
	useEffect(() => {
		if (bootDone && !hasCompletedOnboarding()) {
			setShowOnboarding(true);
		}
	}, [bootDone]);

	// Clock
	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	// Theme sync
	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
	}, [theme]);

	// Search modal state
	const [showSearch, setShowSearch] = useState(false);

	// Keyboard shortcuts
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			// ⌘K or Ctrl+K → search
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setShowSearch(true);
			}
			// / → search (when not in input)
			if (
				e.key === "/" &&
				!(e.target instanceof HTMLInputElement) &&
				!(e.target instanceof HTMLTextAreaElement)
			) {
				e.preventDefault();
				setShowSearch(true);
			}
			// Escape → close search
			if (e.key === "Escape") {
				setShowSearch(false);
			}
			// 1-6 → tab switch (when search closed and not in input)
			if (
				!showSearch &&
				!(e.target instanceof HTMLInputElement) &&
				!(e.target instanceof HTMLTextAreaElement)
			) {
				const tabMap: Record<string, ViewTab> = {
					"1": "monitor",
					"2": "brief",
					"3": "explore",
					"4": "timeline",
					"5": "signals",
					"6": "community",
				};
				if (tabMap[e.key]) setActiveView(tabMap[e.key]);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [showSearch, setActiveView]);

	const handleSweep = useCallback(() => {
		const store = useCivicStore.getState();
		store.setSweepState({ running: true });

		// Simulate phased sweep
		const phases = [
			setTimeout(() => {
				/* scanning */
			}, 400),
			setTimeout(() => {
				/* fetching */
			}, 1000),
			setTimeout(() => {
				/* resolving */
			}, 1600),
			setTimeout(() => {
				useCivicStore.getState().setSweepState({
					running: false,
					lastRun: new Date().toISOString(),
					count: useCivicStore.getState().sweepCount + 1,
				});
			}, 2200),
		];
		return () => phases.forEach(clearTimeout);
	}, []);

	const unreadAlerts = alerts.filter((a) => !a.read && !a.dismissed).length;

	if (!bootDone) {
		return <BootScreen />;
	}

	// Onboarding overlay
	const onboardingOverlay = showOnboarding && (
		<OnboardingModal onComplete={() => setShowOnboarding(false)} />
	);
	return (
		<div className="flex flex-col h-dvh overflow-hidden">
			{/* Skip link for keyboard users */}
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-lg focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-sm focus:text-white focus:shadow-lg"
			>
				Skip to content
			</a>
			{/* ── Top Bar ──────────────────────────────────────── */}
			<header className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-[var(--border)] bg-[var(--card)] min-w-0">
				<div className="flex items-center gap-2 sm:gap-4 min-w-0">
					<div className="flex items-center gap-2 flex-shrink-0">
						<div
							className={
								"w-2 h-2 rounded-full " +
								(sweepRunning
									? "bg-[var(--sweep-active)] animate-pulse-live"
									: "bg-[var(--sweep-idle)]")
							}
						/>
						<span className="text-sm font-bold tracking-widest text-[var(--foreground)]">
							CIVIC<span className="text-[var(--primary)]">INTEL</span>
						</span>
						<span className="text-[8px] text-[var(--muted)] bg-[var(--accent-dim)] px-1.5 py-0.5 rounded tracking-wider hidden sm:inline">
							v1.0
						</span>
					</div>

					<div className="header-sweep-info flex items-center gap-2 text-xs text-[var(--muted)]">
						{sweepRunning ? (
							<>
								<svg
									className="w-3 h-3 animate-sweep text-[var(--sweep-active)]"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" />
								</svg>
								<span className="text-[var(--sweep-active)]">SWEEPING...</span>
								<div className="sweep-progress-bar">
									<div className="sweep-progress-fill" />
								</div>
							</>
						) : (
							<span>SWEEP #{sweepCount}</span>
						)}
						<button
							onClick={handleSweep}
							className="px-2 py-0.5 text-[10px] rounded border border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
						>
							RUN SWEEP
						</button>
					</div>

					<div className="header-meta text-xs text-[var(--muted)] hidden lg:block">
						({threads.length} THREADS • {people.length} PEOPLE •{" "}
						{organizations.length} ORGS)
					</div>
				</div>

				<div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
					<div className="header-search relative hidden sm:block">
						<input
							type="text"
							placeholder="Search entities..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-36 sm:w-48 px-3 py-1 text-xs bg-[var(--background)] border border-[var(--border)] rounded focus:border-[var(--primary)] focus:outline-none transition-colors"
						/>
						<span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-[10px] hidden sm:inline">
							⌘K
						</span>
					</div>

					{/* Mobile: search button */}
					<button
						onClick={() => setShowSearch(true)}
						className="sm:hidden text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm"
					>
						🔍
					</button>

					<div className="relative">
						<button
							onClick={() => setActiveView("signals")}
							className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
						>
							△
						</button>
						{unreadAlerts > 0 && (
							<span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-[var(--destructive)] text-white text-[9px] flex items-center justify-center font-bold">
								{unreadAlerts}
							</span>
						)}
					</div>

					<div className="relative">
						<button
							onClick={() => setShowThemePicker(!showThemePicker)}
							className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-xs"
						>
							◐
						</button>
						{showThemePicker && (
							<div className="absolute right-0 top-8 z-50 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg p-2 min-w-[140px]">
								{(
									[
										["nightwatch", "Nightwatch", "dark"],
										["phosphor", "Phosphor CRT", "dark"],
										["arctic", "Arctic", "light"],
										["solarized", "Solarized", "dark"],
										["parchment", "Parchment", "light"],
									] as const
								).map(([id, label, mode]) => (
									<button
										key={id}
										onClick={() => {
											setTheme(id);
											setShowThemePicker(false);
										}}
										className={
											"w-full text-left px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-2 " +
											(theme === id
												? "text-[var(--primary)] bg-[var(--accent-dim)]"
												: "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)]")
										}
									>
										<span
											className="w-2 h-2 rounded-full"
											style={{
												backgroundColor:
													mode === "dark" ? "#1a1a2e" : "#f0f4f8",
											}}
										/>
										{label}
									</button>
								))}
							</div>
						)}
					</div>

					<div className="header-clock text-xs text-[var(--muted)] font-mono tabular-nums hidden md:block">
						{currentTime.toLocaleTimeString("en-CA", {
							hour12: false,
							hour: "2-digit",
							minute: "2-digit",
							second: "2-digit",
						})}
					</div>
				</div>
			</header>

			{/* ── Tab Strip ────────────────────────────────────── */}
			<nav className="tabs-nav flex items-center gap-0 px-2 sm:px-4 border-b border-[var(--border)] bg-[var(--card)] overflow-x-auto">
				{TABS.map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActiveView(tab.id)}
						className={
							"tab-button flex-shrink-0 px-3 sm:px-4 py-2.5 text-xs font-semibold tracking-widest transition-colors " +
							(activeView === tab.id ? "tab-active" : "tab-inactive")
						}
					>
						<span className="tab-icon mr-1.5">{tab.icon}</span>
						<span className="tab-label-text">{tab.label}</span>
					</button>
				))}
			</nav>

			{/* ── Main Content ─────────────────────────────────── */}
			<main id="main-content" className="flex-1 overflow-auto" role="main">
				{activeView === "monitor" && <MonitorDashboard />}
				{activeView === "brief" && <BriefView />}
				{activeView === "explore" && <ExplorerView />}
				{activeView === "timeline" && <TimelineView />}
				{activeView === "signals" && <SignalsView />}
				{activeView === "community" && <SocialView />}
			</main>

			{/* ── News Ticker ──────────────────────────────────── */}
			<footer className="border-t border-[var(--border)] bg-[var(--card)] py-1.5 px-4">
				<div className="ticker-wrap">
					<div className="ticker-content animate-ticker text-xs text-[var(--muted)]">
						<span>
							▸{" "}
							<span className="text-[var(--signal-procurement)]">CONTRACT</span>{" "}
							L3Harris receives $45M sole-source DND contract — 2 days after
							ex-ADM lobbied Minister
						</span>
						<span>
							▸{" "}
							<span className="text-[var(--signal-revolving)]">
								REVOLVING DOOR
							</span>{" "}
							Michael Chen: DND ADM → Navigator LLP in 31 days → now lobbying
							DND for L3Harris
						</span>
						<span>
							▸ <span className="text-[var(--signal-spousal)]">CIEC</span>{" "}
							Minister Mitchell's spouse on L3Harris board — same vendor she
							awarded $73M in contracts
						</span>
						<span>
							▸{" "}
							<span className="text-[var(--signal-sole-source)]">
								SOLE-SOURCE
							</span>{" "}
							Lockheed Martin $120M sole-source after 6 lobbying meetings in 5
							months
						</span>
						<span>
							▸ <span className="text-[var(--signal-donation)]">DONATION</span>{" "}
							Brookfield: $40K to Liberal Party → $8.5M government contract 3
							months later
						</span>
						<span>
							▸ <span className="text-[var(--signal-international)]">GAC</span>{" "}
							Plan International: $30M GAC + $2.3M IRCC + lobbying —
							multi-layered revenue
						</span>
						<span>
							▸ <span className="text-[var(--signal-mandate)]">MANDATE</span>{" "}
							Sole-source up 40% despite competitive bidding mandate —
							Indigenous procurement below 1%
						</span>
						<span>
							▸{" "}
							<span className="text-[var(--signal-procurement)]">CONTRACT</span>{" "}
							L3Harris receives $45M sole-source DND contract — 2 days after
							ex-ADM lobbied Minister
						</span>
						<span>
							▸{" "}
							<span className="text-[var(--signal-revolving)]">
								REVOLVING DOOR
							</span>{" "}
							Michael Chen: DND ADM → Navigator LLP in 31 days → now lobbying
							DND for L3Harris
						</span>
						<span>
							▸ <span className="text-[var(--signal-spousal)]">CIEC</span>{" "}
							Minister Mitchell's spouse on L3Harris board — same vendor she
							awarded $73M in contracts
						</span>
						<span>
							▸{" "}
							<span className="text-[var(--signal-sole-source)]">
								SOLE-SOURCE
							</span>{" "}
							Lockheed Martin $120M sole-source after 6 lobbying meetings in 5
							months
						</span>
						<span>
							▸ <span className="text-[var(--signal-donation)]">DONATION</span>{" "}
							Brookfield: $40K to Liberal Party → $8.5M government contract 3
							months later
						</span>
						<span>
							▸ <span className="text-[var(--signal-international)]">GAC</span>{" "}
							Plan International: $30M GAC + $2.3M IRCC + lobbying —
							multi-layered revenue
						</span>
						<span>
							▸ <span className="text-[var(--signal-mandate)]">MANDATE</span>{" "}
							Sole-source up 40% despite competitive bidding mandate —
							Indigenous procurement below 1%
						</span>
					</div>
				</div>
			</footer>

			{/* ── Search Modal (⌘K) ──────────────────────────── */}
			{showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
			{onboardingOverlay}
		</div>
	);
}

function SearchModal({ onClose }: { onClose: () => void }) {
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const results = useMemo(() => {
		if (query.length < 2) return [];
		const q = query.toLowerCase();
		const items: {
			type: string;
			label: string;
			sub: string;
			action: () => void;
			icon: string;
		}[] = [];

		// People
		for (const p of people) {
			const name = p.firstName + " " + p.lastName;
			if (
				name.toLowerCase().includes(q) ||
				p.roles[0]?.title.toLowerCase().includes(q)
			) {
				items.push({
					type: "person",
					label: name,
					sub: p.roles[0]?.title || "",
					action: () => {
						useCivicStore.getState().setExplorerFocusEntity(p.id);
						useCivicStore.getState().setActiveView("explore");
						onClose();
					},
					icon: "●",
				});
			}
		}

		// Organizations
		for (const o of organizations) {
			const name = o.names[0] || o.id;
			if (name.toLowerCase().includes(q)) {
				items.push({
					type: "org",
					label: name,
					sub: o.type + (o.industry ? " • " + o.industry : ""),
					action: () => {
						useCivicStore.getState().setExplorerFocusEntity(o.id);
						useCivicStore.getState().setActiveView("explore");
						onClose();
					},
					icon: "◆",
				});
			}
		}

		// Threads
		for (const t of threads) {
			if (
				t.title.toLowerCase().includes(q) ||
				t.signalType.toLowerCase().includes(q)
			) {
				items.push({
					type: "signal",
					label: t.title,
					sub:
						Math.round(t.confidence * 100) +
						"% confidence • " +
						t.signalType.replace(/_/g, " "),
					action: () => {
						useCivicStore.getState().setActiveView("signals");
						onClose();
					},
					icon: "△",
				});
			}
		}

		// Graph nodes
		for (const n of graphNodes) {
			if (
				n.label.toLowerCase().includes(q) &&
				!items.some((i) => i.label === n.label)
			) {
				items.push({
					type: n.type,
					label: n.label,
					sub: n.type,
					action: () => {
						useCivicStore.getState().setExplorerFocusEntity(n.id);
						useCivicStore.getState().setActiveView("explore");
						onClose();
					},
					icon: n.type === "person" ? "●" : n.type === "department" ? "■" : "◆",
				});
			}
		}

		// Timeline events
		for (const e of timelineEvents) {
			if (e.title.toLowerCase().includes(q)) {
				items.push({
					type: "event",
					label: e.title,
					sub: e.date + " • " + e.type,
					action: () => {
						useCivicStore.getState().setActiveView("timeline");
						onClose();
					},
					icon: "⏎",
				});
			}
		}

		return items.slice(0, 12);
	}, [query, onClose]);

	return (
		<div
			className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
			onClick={onClose}
		>
			<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
			<div
				className="relative w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
					<span className="text-[var(--muted)]">⌘</span>
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search people, organizations, signals, events..."
						className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
					/>
					<button
						onClick={onClose}
						className="text-[var(--muted)] text-xs border border-[var(--border)] rounded px-1.5 py-0.5"
					>
						ESC
					</button>
				</div>
				{results.length > 0 ? (
					<div className="max-h-80 overflow-auto py-1">
						{results.map((r, i) => (
							<button
								key={i}
								onClick={r.action}
								className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--card-hover)] transition-colors"
							>
								<span className="text-[var(--muted)] text-xs">{r.icon}</span>
								<div className="flex-1 min-w-0">
									<div className="text-sm text-[var(--foreground)] truncate">
										{r.label}
									</div>
									<div className="text-[10px] text-[var(--muted)] truncate">
										{r.sub}
									</div>
								</div>
								<span className="text-[9px] text-[var(--muted)] bg-[var(--background)] px-1.5 py-0.5 rounded">
									{r.type}
								</span>
							</button>
						))}
					</div>
				) : query.length >= 2 ? (
					<div className="py-8 text-center text-xs text-[var(--muted)]">
						No results for "{query}"
					</div>
				) : (
					<div className="py-8 text-center text-xs text-[var(--muted)]">
						Type to search across {people.length} people, {organizations.length}{" "}
						organizations, {threads.length} signals, {timelineEvents.length}{" "}
						events
					</div>
				)}
				<div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-4 text-[10px] text-[var(--muted)]">
					<span>↑↓ navigate</span>
					<span>↵ select</span>
					<span>esc close</span>
					<span className="ml-auto">1-6 switch tabs</span>
				</div>
			</div>
		</div>
	);
}

function BootScreen() {
	const [step, setStep] = useState(0);
	const steps = [
		"Loading entity graph...",
		"Resolving 14 entities across 5 data sources...",
		"Detecting intelligence signals...",
		"7 active threads identified. Ready.",
	];

	useEffect(() => {
		const timers = [
			setTimeout(() => setStep(1), 150),
			setTimeout(() => setStep(2), 350),
			setTimeout(() => setStep(3), 550),
		];
		return () => timers.forEach(clearTimeout);
	}, []);

	return (
		<div className="flex flex-col h-screen items-center justify-center gap-3 bg-[var(--background)]">
			<div className="flex items-center gap-3 mb-4">
				<div className="w-3 h-3 rounded-full bg-[var(--primary)] animate-pulse-live" />
				<span className="text-lg font-bold tracking-widest text-[var(--foreground)]">
					CIVIC<span className="text-[var(--primary)]">INTEL</span>
				</span>
			</div>
			<div className="flex flex-col gap-1.5 text-xs text-[var(--muted)] font-mono w-80">
				{steps.slice(0, step + 1).map((s, i) => (
					<div
						key={i}
						className={
							"flex items-center gap-2 " +
							(i === step ? "text-[var(--foreground)]" : "")
						}
					>
						<span className="text-[var(--primary)]">▸</span>
						{s}
						{i === step && <span className="animate-pulse-live">█</span>}
					</div>
				))}
			</div>
		</div>
	);
}
