"use client";

import { useCivicStore } from "../lib/store";
import { useMemo } from "react";
import type { IntelligenceThread } from "@civic-intel/core";

const SIGNAL_COLORS: Record<string, string> = {
	procurement_lobbying_overlap: "var(--signal-procurement)",
	revolving_door: "var(--signal-revolving)",
	spousal_interest_proximity: "var(--signal-spousal)",
	sole_source_heavy_lobbying: "var(--signal-sole-source)",
	donation_proximity_correlation: "var(--signal-donation)",
	mandate_divergence: "var(--signal-mandate)",
	international_layering: "var(--signal-international)",
};

const SIGNAL_LABELS: Record<string, string> = {
	procurement_lobbying_overlap: "Procurement-Lobbying",
	revolving_door: "Revolving Door",
	spousal_interest_proximity: "Spousal Interest",
	sole_source_heavy_lobbying: "Sole-Source + Lobbying",
	donation_proximity_correlation: "Donation Proximity",
	mandate_divergence: "Mandate Divergence",
	international_layering: "International Layer",
};

function getSeverity(thread: IntelligenceThread): "low" | "medium" | "high" | "critical" {
	if (thread.confidence >= 0.85) return "critical";
	if (thread.confidence >= 0.7) return "high";
	if (thread.confidence >= 0.5) return "medium";
	return "low";
}

export function MonitorDashboard() {
	const {
		contracts,
		filings,
		donations,
		threads,
		sweepDelta,
		sweepRunning,
		sweepLastRun,
	} = useCivicStore();

	const stats = useMemo(() => {
		const totalSpending = contracts.reduce(
			(sum, c) => sum + (typeof c.value === "number" ? c.value : 0),
			0,
		);
		const topVendors = Object.entries(
			contracts.reduce<Record<string, number>>((acc, c) => {
				acc[c.vendorName] = (acc[c.vendorName] || 0) + (typeof c.value === "number" ? c.value : 0);
				return acc;
			}, {}),
		)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 5);

		const lobbyingByDept = Object.entries(
			filings.reduce<Record<string, number>>((acc, f) => {
				acc[f.institution] = (acc[f.institution] || 0) + 1;
				return acc;
			}, {}),
		).sort(([, a], [, b]) => b - a);

		const highConfidence = threads.filter((t) => t.confidence >= 0.7).length;
		const avgConfidence =
			threads.length > 0
				? threads.reduce((s, t) => s + t.confidence, 0) / threads.length
				: 0;

		return {
			totalSpending,
			topVendors,
			lobbyingByDept,
			highConfidence,
			avgConfidence,
		};
	}, [contracts, filings, threads]);

	const signalDistribution = useMemo(() => {
		const dist: Record<string, number> = {};
		for (const t of threads) {
			dist[t.signalType] = (dist[t.signalType] || 0) + 1;
		}
		return Object.entries(dist).sort(([, a], [, b]) => b - a);
	}, [threads]);

	return (
		<div className="grid grid-cols-12 gap-3 p-4 h-full overflow-auto">
			{/* ── Left Panel: Anomaly Feed ────────────────────── */}
			<div className="col-span-3 flex flex-col gap-3">
				<div className="card">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						ACTIVE SIGNALS
					</h3>
					<div className="flex flex-col gap-2 max-h-[calc(100vh-320px)] overflow-auto">
						{threads.map((thread) => (
							<SignalCard key={thread.id} thread={thread} />
						))}
						{threads.length === 0 && (
							<div className="text-xs text-[var(--muted)] text-center py-4">
								No signals detected
							</div>
						)}
					</div>
				</div>
			</div>

			{/* ── Center Panel: Charts Grid ───────────────────── */}
			<div className="col-span-6 flex flex-col gap-3">
				{/* Top stats row */}
				<div className="grid grid-cols-4 gap-3">
					<StatCard
						label="TOTAL SPENDING"
						value={`$${(stats.totalSpending / 1_000_000).toFixed(1)}M`}
						subtitle={contracts.length + ' contracts'}
						color="var(--signal-procurement)"
					/>
					<StatCard
						label="LOBBYING FILINGS"
						value={String(filings.length)}
						subtitle={stats.lobbyingByDept.length + ' departments'}
						color="var(--signal-revolving)"
					/>
					<StatCard
						label="ACTIVE THREADS"
						value={String(threads.length)}
						subtitle={stats.highConfidence + ' high confidence'}
						color="var(--primary)"
					/>
					<StatCard
						label="HEALTH SCORE"
						value={String(Math.round(stats.avgConfidence * 100))}
						subtitle={'avg ' + (stats.avgConfidence * 100).toFixed(0) + '% confidence'}
						color="var(--accent)"
					/>
				</div>

				{/* Spending by vendor (horizontal bars) */}
				<div className="card">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						TOP VENDORS BY CONTRACT VALUE
					</h3>
					<div className="flex flex-col gap-2">
						{stats.topVendors.map(([name, value], i) => {
							const maxVal = stats.topVendors[0]?.[1] ?? 1;
							const pct = (value / maxVal) * 100;
							return (
								<div key={name} className="flex items-center gap-2">
									<div className="w-32 text-xs text-[var(--foreground)] truncate">
										{name}
									</div>
									<div className="flex-1 h-5 bg-[var(--background)] rounded overflow-hidden">
										<div
											className="h-full rounded transition-all duration-1000 ease-out"
											style={{
												width: pct + '%',
												background: 'linear-gradient(90deg, var(--primary), var(--accent))',
												opacity: 1 - i * 0.15,
											}}
										/>
									</div>
									<div className="w-16 text-xs text-right text-[var(--muted)] tabular-nums">
										${(value / 1_000_000).toFixed(1)}M
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Signal Distribution + Severity Gauge row */}
				<div className="grid grid-cols-2 gap-3">
					{/* Signal type distribution */}
					<div className="card">
						<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
							SIGNAL DISTRIBUTION
						</h3>
						<div className="flex flex-col gap-2">
							{signalDistribution.map(([type, count]) => (
								<div key={type} className="flex items-center gap-2">
									<div
										className="w-2 h-2 rounded-full"
										style={{ backgroundColor: SIGNAL_COLORS[type] }}
									/>
									<div className="flex-1 text-xs text-[var(--foreground)]">
										{SIGNAL_LABELS[type] || type}
									</div>
									<div className="text-xs text-[var(--muted)] tabular-nums">
										{count}
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Severity Gauge (CSS-only) */}
					<div className="card flex flex-col items-center justify-center">
						<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-4">
							THREAT LEVEL
						</h3>
						<div className="relative w-32 h-32">
							<svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
								<circle
									cx="50"
									cy="50"
									r="40"
									fill="none"
									stroke="var(--border)"
									strokeWidth="8"
								/>
								<circle
									cx="50"
									cy="50"
									r="40"
									fill="none"
									stroke={
										stats.avgConfidence > 0.7
											? "var(--destructive)"
											: stats.avgConfidence > 0.5
												? "var(--warning)"
												: "var(--success)"
									}
									strokeWidth="8"
									strokeLinecap="round"
									strokeDasharray={stats.avgConfidence * 251.3 + ' 251.3'}
									className="transition-all duration-1000"
								/>
							</svg>
							<div className="absolute inset-0 flex flex-col items-center justify-center">
								<span className="text-2xl font-bold tabular-nums">
									{Math.round(stats.avgConfidence * 100)}
								</span>
								<span className="text-[9px] text-[var(--muted)]">/ 100</span>
							</div>
						</div>
						<div className="mt-2 text-xs text-[var(--muted)]">
							{stats.avgConfidence > 0.7
								? "HIGH RISK"
								: stats.avgConfidence > 0.5
									? "MODERATE"
									: "LOW"}
						</div>
					</div>
				</div>

				{/* Lobbying heatmap by department */}
				<div className="card">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						LOBBYING ACTIVITY BY DEPARTMENT
					</h3>
					<div className="flex flex-wrap gap-2">
						{stats.lobbyingByDept.map(([dept, count]) => (
							<div
								key={dept}
								className="px-3 py-1.5 rounded text-xs transition-all hover:scale-105 cursor-pointer"
								style={{
									background: 'rgba(239, 68, 68, ${Math.min(0.3 + count * 0.15, 0.9)})',
									color: "var(--foreground)",
								}}
							>
								{dept.split(" ").slice(-2).join(" ")}{" "}
								<span className="opacity-60">({count})</span>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* ── Right Panel ─────────────────────────────────── */}
			<div className="col-span-3 flex flex-col gap-3">
				{/* Sweep status */}
				<div className="card">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						SWEEP STATUS
					</h3>
					{sweepRunning ? (
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-[var(--sweep-active)] animate-pulse-live" />
							<span className="text-xs text-[var(--sweep-active)]">
								Running sweep...
							</span>
						</div>
					) : (
						<div className="text-xs text-[var(--muted)]">
							Last:{" "}
							{sweepLastRun
								? new Date(sweepLastRun).toLocaleTimeString()
								: "Never"}
						</div>
					)}
					{sweepDelta && (
						<div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
							<div>
								<span className="text-[var(--signal-procurement)]">
									{sweepDelta.newContracts}
								</span>{" "}
								contracts
							</div>
							<div>
								<span className="text-[var(--signal-revolving)]">
									{sweepDelta.newFilings}
								</span>{" "}
								filings
							</div>
							<div>
								<span className="text-[var(--signal-donation)]">
									{sweepDelta.newDonations}
								</span>{" "}
								donations
							</div>
							<div>
								<span className="text-[var(--signal-mandate)]">
									{sweepDelta.newSignals}
								</span>{" "}
								signals
							</div>
						</div>
					)}
				</div>

				{/* Entity watchlist */}
				<div className="card">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						ENTITY WATCHLIST
					</h3>
					<EntityWatchlist />
				</div>

				{/* Donations summary */}
				<div className="card">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						RECENT DONATIONS
					</h3>
					<div className="flex flex-col gap-1.5">
						{donations.slice(0, 5).map((d, i) => (
							<div
								key={i}
								className="flex justify-between text-xs py-1 border-b border-[var(--border)] last:border-0"
							>
								<span className="truncate max-w-[140px]">{d.donorName}</span>
								<span className="text-[var(--signal-donation)] tabular-nums">
									${typeof d.amount === "number" ? d.amount.toLocaleString() : "—"}
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

function SignalCard({ thread }: { thread: IntelligenceThread }) {
	const severity = getSeverity(thread);
	const color = SIGNAL_COLORS[thread.signalType] || "var(--primary)";

	return (
		<div
			className={`card severity-${severity} cursor-pointer hover:bg-[var(--card-hover)] transition-colors`}
			style={{ borderLeftColor: color, borderLeftWidth: "3px" }}
		>
			<div className="flex items-center gap-2 mb-1">
				<div
					className="w-1.5 h-1.5 rounded-full"
					style={{ backgroundColor: color }}
				/>
				<span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">
					{SIGNAL_LABELS[thread.signalType]}
				</span>
				<span className="ml-auto text-[10px] text-[var(--muted)] tabular-nums">
					{Math.round(thread.confidence * 100)}%
				</span>
			</div>
			<div className="text-xs text-[var(--foreground)] leading-relaxed line-clamp-2">
				{thread.title}
			</div>
		</div>
	);
}

function StatCard({
	label,
	value,
	subtitle,
	color,
}: {
	label: string;
	value: string;
	subtitle: string;
	color: string;
}) {
	return (
		<div className="card text-center">
			<div className="text-[9px] text-[var(--muted)] tracking-widest mb-1">
				{label}
			</div>
			<div className="text-xl font-bold tabular-nums" style={{ color }}>
				{value}
			</div>
			<div className="text-[10px] text-[var(--muted)]">{subtitle}</div>
		</div>
	);
}

function EntityWatchlist() {
	const { threads, organizations } = useCivicStore();

	const entityCounts = useMemo(() => {
		const counts: Record<string, { name: string; count: number; color: string }> =
			{};
		for (const thread of threads) {
			for (const entityId of thread.nodes) {
				if (!counts[entityId]) {
					const org = organizations.find((o) => o.id === entityId);
					const name = org?.names?.[0] || entityId.replace(/org-|person-/g, "").replace(/-/g, " ");
					counts[entityId] = {
						name,
						count: 0,
						color: SIGNAL_COLORS[thread.signalType] || "var(--primary)",
					};
				}
				counts[entityId].count++;
			}
		}
		return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 8);
	}, [threads, organizations]);

	return (
		<div className="flex flex-col gap-1.5">
			{entityCounts.map((e) => (
				<div
					key={e.name}
					className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-[var(--card-hover)] rounded px-1 transition-colors"
				>
					<div
						className="w-1.5 h-1.5 rounded-full"
						style={{ backgroundColor: e.color }}
					/>
					<span className="flex-1 truncate">{e.name}</span>
					<span className="text-[var(--muted)] tabular-nums">{e.count}</span>
				</div>
			))}
		</div>
	);
}
