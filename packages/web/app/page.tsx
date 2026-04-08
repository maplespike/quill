"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useCivicStore, type ViewTab } from "../lib/store";
import { initializePipeline } from "../lib/pipeline";

// Views
import { MonitorDashboard } from "../components/MonitorDashboard";
import { BriefView } from "../components/BriefView";
import { ExplorerView } from "../components/ExplorerView";
import { SignalsView } from "../components/SignalsView";
import { SocialView } from "../components/SocialView";

const TABS: { id: ViewTab; label: string; icon: string }[] = [
	{ id: "monitor", label: "MONITOR", icon: "◉" },
	{ id: "brief", label: "BRIEF", icon: "◆" },
	{ id: "explore", label: "EXPLORE", icon: "◈" },
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
	const [initialized, setInitialized] = useState(false);
	const [initError, setInitError] = useState<string | null>(null);
	const [showThemePicker, setShowThemePicker] = useState(false);
	const [currentTime, setCurrentTime] = useState(new Date());

	// Initialize pipeline
	useEffect(() => {
		initializePipeline()
			.then((result) => {
				useCivicStore.getState().setSeedData({
					contracts: result.contracts,
					filings: result.filings,
					donations: result.donations,
					disclosures: result.disclosures,
					projects: result.projects,
					people: result.people,
					organizations: result.organizations,
				});
				useCivicStore.getState().setIntelligence(result.threads, result.brief);
				useCivicStore.getState().setSweepState({
					running: false,
					lastRun: new Date().toISOString(),
					count: 1,
				delta: result.sweepDelta,
				});
				setInitialized(true);
			})
			.catch((err) => {
				console.error("Pipeline init failed:", err);
				setInitError(err instanceof Error ? err.message : "Unknown error");
				setInitialized(true);
			});
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

	return (
		<div className="flex flex-col h-screen overflow-hidden">
			{/* ── Top Bar ──────────────────────────────────────── */}
			<header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--card)]">
				<div className="flex items-center gap-4">
					{/* Logo + Live pulse */}
					<div className="flex items-center gap-2">
						<div
							className={`w-2 h-2 rounded-full ${sweepRunning ? "bg-[var(--sweep-active)] animate-pulse-live" : "bg-[var(--sweep-idle)]"}`}
						/>
						<span className="text-sm font-bold tracking-widest text-[var(--foreground)]">
							CIVIC<span className="text-[var(--primary)]">INTEL</span>
						</span>
					</div>

					{/* Sweep indicator */}
					<div className="flex items-center gap-2 text-xs text-[var(--muted)]">
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

					{/* Thread count */}
					<div className="text-xs text-[var(--muted)]">
						{threads.length} THREADS
					</div>
				</div>

				<div className="flex items-center gap-4">
					{/* Search */}
					<div className="relative">
						<input
							type="text"
							placeholder="Search entities..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-48 px-3 py-1 text-xs bg-[var(--background)] border border-[var(--border)] rounded focus:border-[var(--primary)] focus:outline-none transition-colors"
						/>
						<span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-[10px]">
							⌘K
						</span>
					</div>

					{/* Alert badge */}
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

					{/* Theme picker */}
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
										["nightwatch", "Nightwatch"],
										["phosphor", "Phosphor CRT"],
										["arctic", "Arctic"],
										["solarized", "Solarized"],
										["parchment", "Parchment"],
									] as const
								).map(([id, label]) => (
									<button
										key={id}
										onClick={() => {
											setTheme(id);
											setShowThemePicker(false);
										}}
										className={`w-full text-left px-3 py-1.5 text-xs rounded transition-colors ${
											theme === id
												? "text-[var(--primary)] bg-[var(--accent-dim)]"
												: "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)]"
										}`}
									>
										{label}
									</button>
								))}
							</div>
						)}
					</div>

					{/* Clock */}
					<div className="text-xs text-[var(--muted)] font-mono tabular-nums">
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
			<nav className="flex items-center gap-0 px-4 border-b border-[var(--border)] bg-[var(--card)]">
				{TABS.map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActiveView(tab.id)}
						className={`px-4 py-2.5 text-xs font-semibold tracking-widest transition-colors ${
							activeView === tab.id ? "tab-active" : "tab-inactive"
						}`}
					>
						<span className="mr-1.5">{tab.icon}</span>
						{tab.label}
					</button>
				))}
			</nav>

			{/* ── Main Content ─────────────────────────────────── */}
			<main className="flex-1 overflow-auto">
				{!initialized ? (
					<LoadingScreen error={initError} />
				) : (
					<Suspense fallback={<LoadingScreen />}>
						{activeView === "monitor" && <MonitorDashboard />}
						{activeView === "brief" && <BriefView />}
						{activeView === "explore" && <ExplorerView />}
						{activeView === "signals" && <SignalsView />}
						{activeView === "community" && <SocialView />}
					</Suspense>
				)}
			</main>

			{/* ── News Ticker ──────────────────────────────────── */}
			<footer className="border-t border-[var(--border)] bg-[var(--card)] py-1.5 px-4">
				<div className="ticker-wrap">
					<div className="ticker-content animate-ticker text-xs text-[var(--muted)]">
						<span>
							▸ <span className="text-[var(--signal-procurement)]">SPENDING</span> New $45M
							sole-source contract: L3Harris Technologies → DND
						</span>
						<span>
							▸ <span className="text-[var(--signal-revolving)]">LOBBYING</span> Navigator LLP
							filed monthly communication report for L3Harris targeting DND
						</span>
						<span>
							▸ <span className="text-[var(--signal-spousal)]">CIEC</span> Sarah Mitchell
							disclosed spouse employment at L3Harris Technologies
						</span>
						<span>
							▸ <span className="text-[var(--signal-international)]">GAC</span> Plan International
							received $12M for Philippines development program
						</span>
						<span>
							▸ <span className="text-[var(--signal-donation)]">ELECTIONS</span> Robert Mitchell
							donated $1,500 to Conservative Party of Canada
						</span>
						<span>
							▸ <span className="text-[var(--signal-sole-source)]">ANALYSIS</span> 7 active
							intelligence threads detected across 5 data sources
						</span>
						{/* Duplicate for seamless loop */}
						<span>
							▸ <span className="text-[var(--signal-procurement)]">SPENDING</span> New $45M
							sole-source contract: L3Harris Technologies → DND
						</span>
						<span>
							▸ <span className="text-[var(--signal-revolving)]">LOBBYING</span> Navigator LLP
							filed monthly communication report for L3Harris targeting DND
						</span>
						<span>
							▸ <span className="text-[var(--signal-spousal)]">CIEC</span> Sarah Mitchell
							disclosed spouse employment at L3Harris Technologies
						</span>
						<span>
							▸ <span className="text-[var(--signal-international)]">GAC</span> Plan International
							received $12M for Philippines development program
						</span>
						<span>
							▸ <span className="text-[var(--signal-donation)]">ELECTIONS</span> Robert Mitchell
							donated $1,500 to Conservative Party of Canada
						</span>
						<span>
							▸ <span className="text-[var(--signal-sole-source)]">ANALYSIS</span> 7 active
							intelligence threads detected across 5 data sources
						</span>
					</div>
				</div>
			</footer>
		</div>
	);
}

function LoadingScreen({ error }: { error?: string | null }) {
	return (
		<div className="flex flex-col items-center justify-center h-full gap-4">
			<div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse-live" />
			<div className="text-sm text-[var(--muted)] font-mono">
				{error ? `ERROR: ${error}` : "INITIALIZING INTELLIGENCE PIPELINE..."}
			</div>
			{!error && (
				<div className="text-xs text-[var(--muted)]">
					Loading seed data → resolving entities → building graph → detecting
					signals
				</div>
			)}
		</div>
	);
}
