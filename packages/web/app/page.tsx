"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useCivicStore, type ViewTab } from "../lib/store";

// Views
import { MonitorDashboard } from "../components/MonitorDashboard";
import { BriefView } from "../components/BriefView";
import { ExplorerView } from "../components/ExplorerView";
import { SignalsView } from "../components/SignalsView";
import { SocialView } from "../components/SocialView";
import { TimelineView } from "../components/TimelineView";

const TABS: { id: ViewTab; label: string; icon: string }[] = [
	{ id: "monitor", label: "MONITOR", icon: "◉" },
	{ id: "brief", label: "BRIEF", icon: "◆" },
	{ id: "explore", label: "EXPLORE", icon: "◈" },
	{ id: "timeline", label: "TIMELINE", icon: "⟐" },
	{ id: "signals", label: "SIGNALS", icon: "△" },
	{ id: "community", label: "COMMUNITY", icon: "◎" },
];

export default function CivicIntelApp() {
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
	const [currentTime, setCurrentTime] = useState(new Date());
	const [bootDone, setBootDone] = useState(false);

	// Boot animation
	useEffect(() => {
		const t = setTimeout(() => setBootDone(true), 600);
		return () => clearTimeout(t);
	}, []);

	// Clock
	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	// Theme sync
	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
	}, [theme]);

	const handleSweep = useCallback(() => {
		useCivicStore.getState().setSweepState({ running: true });
		setTimeout(() => {
			useCivicStore.getState().setSweepState({
				running: false,
				lastRun: new Date().toISOString(),
				count: useCivicStore.getState().sweepCount + 1,
			});
		}, 2000);
	}, []);

	const unreadAlerts = alerts.filter((a) => !a.read && !a.dismissed).length;

	if (!bootDone) {
		return <BootScreen />;
	}

	return (
		<div className="flex flex-col h-screen overflow-hidden">
			{/* ── Top Bar ──────────────────────────────────────── */}
			<header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--card)]">
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2">
						<div className={"w-2 h-2 rounded-full " + (sweepRunning ? "bg-[var(--sweep-active)] animate-pulse-live" : "bg-[var(--sweep-idle)]")} />
						<span className="text-sm font-bold tracking-widest text-[var(--foreground)]">
							CIVIC<span className="text-[var(--primary)]">INTEL</span>
						</span>
						<span className="text-[8px] text-[var(--muted)] bg-[var(--accent-dim)] px-1.5 py-0.5 rounded tracking-wider">v1.0</span>
					</div>

					<div className="flex items-center gap-2 text-xs text-[var(--muted)]">
						{sweepRunning ? (
							<>
								<svg className="w-3 h-3 animate-sweep text-[var(--sweep-active)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" />
								</svg>
								<span className="text-[var(--sweep-active)]">SWEEPING...</span>
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

					<div className="text-xs text-[var(--muted)]">
						{threads.length} THREADS
					</div>
				</div>

				<div className="flex items-center gap-4">
					<div className="relative">
						<input
							type="text"
							placeholder="Search entities..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-48 px-3 py-1 text-xs bg-[var(--background)] border border-[var(--border)] rounded focus:border-[var(--primary)] focus:outline-none transition-colors"
						/>
						<span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-[10px]">⌘K</span>
					</div>

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
										onClick={() => { setTheme(id); setShowThemePicker(false); }}
										className={"w-full text-left px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-2 " + (theme === id ? "text-[var(--primary)] bg-[var(--accent-dim)]" : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)]")}
									>
										<span className="w-2 h-2 rounded-full" style={{ backgroundColor: mode === "dark" ? "#1a1a2e" : "#f0f4f8" }} />
										{label}
									</button>
								))}
							</div>
						)}
					</div>

					<div className="text-xs text-[var(--muted)] font-mono tabular-nums">
						{currentTime.toLocaleTimeString("en-CA", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
					</div>
				</div>
			</header>

			{/* ── Tab Strip ────────────────────────────────────── */}
			<nav className="flex items-center gap-0 px-4 border-b border-[var(--border)] bg-[var(--card)]">
				{TABS.map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActiveView(tab.id)}
						className={"px-4 py-2.5 text-xs font-semibold tracking-widest transition-colors " + (activeView === tab.id ? "tab-active" : "tab-inactive")}
					>
						<span className="mr-1.5">{tab.icon}</span>
						{tab.label}
					</button>
				))}
			</nav>

			{/* ── Main Content ─────────────────────────────────── */}
			<main className="flex-1 overflow-auto">
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
						<span>▸ <span className="text-[var(--signal-procurement)]">CONTRACT</span> L3Harris receives $45M sole-source DND contract — 2 days after ex-ADM lobbied Minister</span>
						<span>▸ <span className="text-[var(--signal-revolving)]">REVOLVING DOOR</span> Michael Chen: DND ADM → Navigator LLP in 31 days → now lobbying DND for L3Harris</span>
						<span>▸ <span className="text-[var(--signal-spousal)]">CIEC</span> Minister Mitchell's spouse on L3Harris board — same vendor she awarded $73M in contracts</span>
						<span>▸ <span className="text-[var(--signal-sole-source)]">SOLE-SOURCE</span> Lockheed Martin $120M sole-source after 6 lobbying meetings in 5 months</span>
						<span>▸ <span className="text-[var(--signal-donation)]">DONATION</span> Brookfield: $40K to Liberal Party → $8.5M government contract 3 months later</span>
						<span>▸ <span className="text-[var(--signal-international)]">GAC</span> Plan International: $30M GAC + $2.3M IRCC + lobbying — multi-layered revenue</span>
						<span>▸ <span className="text-[var(--signal-mandate)]">MANDATE</span> Sole-source up 40% despite competitive bidding mandate — Indigenous procurement below 1%</span>
						<span>▸ <span className="text-[var(--signal-procurement)]">CONTRACT</span> L3Harris receives $45M sole-source DND contract — 2 days after ex-ADM lobbied Minister</span>
						<span>▸ <span className="text-[var(--signal-revolving)]">REVOLVING DOOR</span> Michael Chen: DND ADM → Navigator LLP in 31 days → now lobbying DND for L3Harris</span>
						<span>▸ <span className="text-[var(--signal-spousal)]">CIEC</span> Minister Mitchell's spouse on L3Harris board — same vendor she awarded $73M in contracts</span>
						<span>▸ <span className="text-[var(--signal-sole-source)]">SOLE-SOURCE</span> Lockheed Martin $120M sole-source after 6 lobbying meetings in 5 months</span>
						<span>▸ <span className="text-[var(--signal-donation)]">DONATION</span> Brookfield: $40K to Liberal Party → $8.5M government contract 3 months later</span>
						<span>▸ <span className="text-[var(--signal-international)]">GAC</span> Plan International: $30M GAC + $2.3M IRCC + lobbying — multi-layered revenue</span>
						<span>▸ <span className="text-[var(--signal-mandate)]">MANDATE</span> Sole-source up 40% despite competitive bidding mandate — Indigenous procurement below 1%</span>
					</div>
				</div>
			</footer>
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
					<div key={i} className={"flex items-center gap-2 " + (i === step ? "text-[var(--foreground)]" : "")}>
						<span className="text-[var(--primary)]">▸</span>
						{s}
						{i === step && <span className="animate-pulse-live">█</span>}
					</div>
				))}
			</div>
		</div>
	);
}
