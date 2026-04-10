"use client";

import { PretextTooltip } from "@civic-intel/pretext-civic";
import { useMemo } from "react";
import type { IntelligenceThread } from "../lib/data";
import { connectionStrengths, graphNodes } from "../lib/data";
import { buildTooltipText } from "../lib/pretext-helpers";
import { useCivicStore } from "../lib/store";
import { SignalCard as SharedSignalCard } from "./SignalCard";

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

function getSeverity(
	thread: IntelligenceThread,
): "low" | "medium" | "high" | "critical" {
	if (thread.confidence >= 0.85) return "critical";
	if (thread.confidence >= 0.7) return "high";
	if (thread.confidence >= 0.5) return "medium";
	return "low";
}

export function MonitorDashboard() {
	const {
		contracts,
		filings,
		threads,
		sweepDelta,
		sweepRunning,
		sweepLastRun,
		people,
		organizations,
	} = useCivicStore();

	const stats = useMemo(() => {
		const totalSpending = contracts.reduce((sum, c) => sum + c.value, 0);
		const soleSourceValue = contracts
			.filter((c) => c.isSoleSource)
			.reduce((sum, c) => sum + c.value, 0);
		const soleSourcePct =
			totalSpending > 0 ? (soleSourceValue / totalSpending) * 100 : 0;
		const topVendors = Object.entries(
			contracts.reduce<Record<string, number>>((acc, c) => {
				acc[c.vendorName] = (acc[c.vendorName] || 0) + c.value;
				return acc;
			}, {}),
		)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 5);

		const lobbyingByDept = Object.entries(
			filings.reduce<Record<string, number>>((acc, f) => {
				for (const c of f.communications) {
					acc[c.institution] = (acc[c.institution] || 0) + 1;
				}
				return acc;
			}, {}),
		).sort(([, a], [, b]) => b - a);

		const totalComms = filings.reduce(
			(sum, f) => sum + f.communications.length,
			0,
		);
		const highConfidence = threads.filter((t) => t.confidence >= 0.7).length;
		const avgConfidence =
			threads.length > 0
				? threads.reduce((s, t) => s + t.confidence, 0) / threads.length
				: 0;

		return {
			totalSpending,
			soleSourcePct,
			topVendors,
			lobbyingByDept,
			totalComms,
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
		<div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 h-full overflow-auto">
			{/* ── Left Panel: Anomaly Feed ────────────────────── */}
			<div className="md:col-span-3 flex flex-col gap-3">
				<div className="card card-enter card-enter-1">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						ACTIVE SIGNALS ({threads.length})
					</h3>
					<div className="flex flex-col gap-2 max-h-[calc(100vh-320px)] overflow-auto pr-1">
						{threads.map((thread) => (
							<SharedSignalCard key={thread.id} thread={thread} />
						))}
					</div>
				</div>
			</div>

			{/* ── Center Panel: Charts ────────────────────────── */}
			<div className="md:col-span-6 flex flex-col gap-3">
				{/* Top stats row */}
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
					<StatCard
						label="TOTAL SPENDING"
						value={"$" + (stats.totalSpending / 1_000_000).toFixed(1) + "M"}
						subtitle={contracts.length + " contracts tracked"}
						color="var(--signal-procurement)"
					/>
					<StatCard
						label="SOLE-SOURCE %"
						value={stats.soleSourcePct.toFixed(0) + "%"}
						subtitle={
							"$" +
							(
								contracts
									.filter((c) => c.isSoleSource)
									.reduce((s, c) => s + c.value, 0) / 1_000_000
							).toFixed(0) +
							"M non-competitive"
						}
						color="var(--destructive)"
					/>
					<StatCard
						label="LOBBYING COMMS"
						value={String(stats.totalComms)}
						subtitle={filings.length + " active filings"}
						color="var(--signal-revolving)"
					/>
					<StatCard
						label="THREAT LEVEL"
						value={String(Math.round(stats.avgConfidence * 100))}
						subtitle={
							stats.highConfidence +
							" high-confidence / " +
							threads.length +
							" total"
						}
						color="var(--accent)"
					/>
				</div>

				{/* Top vendors — horizontal bars */}
				<div className="card card-enter card-enter-2">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						TOP VENDORS BY CONTRACT VALUE
					</h3>
					<div className="flex flex-col gap-2">
						{stats.topVendors.map(([name, value], i) => {
							const maxVal = stats.topVendors[0]?.[1] ?? 1;
							const pct = (value / maxVal) * 100;
							const isSoleSource = contracts.find(
								(c) => c.vendorName === name,
							)?.isSoleSource;
							return (
								<div key={name} className="flex items-center gap-2">
									<div className="w-36 text-xs text-[var(--foreground)] truncate flex items-center gap-1">
										<span>
											{name
												.replace(" Technologies Canada", "")
												.replace(" Asset Management", "")}
										</span>
										{isSoleSource && (
											<span className="text-[8px] text-[var(--destructive)] bg-[var(--destructive)]/10 px-1 rounded">
												SOLE
											</span>
										)}
									</div>
									<div className="flex-1 h-6 bg-[var(--background)] rounded overflow-hidden relative">
										<div
											className="h-full rounded transition-all duration-1000 ease-out"
											style={{
												width: pct + "%",
												background:
													i === 0
														? "linear-gradient(90deg, var(--primary), var(--accent))"
														: i === 1
															? "linear-gradient(90deg, var(--signal-revolving), var(--signal-sole-source))"
															: "linear-gradient(90deg, var(--muted), var(--border))",
												opacity: 1 - i * 0.15,
											}}
										/>
										<span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--foreground)] font-mono">
											${(value / 1_000_000).toFixed(1)}M
										</span>
									</div>
								</div>
							);
						})}
					</div>
					<div className="mt-2 pt-2 border-t border-[var(--border)] flex justify-between text-[10px] text-[var(--muted)]">
						<span>
							{contracts.length} contracts • {stats.soleSourcePct.toFixed(0)}%
							sole-source by value
						</span>
						<span>Sources: CanadaBuys proactive disclosure</span>
					</div>
				</div>

				{/* Signal Distribution + Severity Gauge */}

				{/* Data Coverage */}
				<div className="card card-enter card-enter-5">
					<div className="flex items-center gap-4 text-[10px] text-[var(--muted)] flex-wrap">
						<span className="tracking-widest font-semibold">DATA SOURCES</span>
						<span className="flex items-center gap-1">
							<span className="w-1.5 h-1.5 rounded-full bg-[var(--signal-procurement)]" />
							{contracts.length} contracts
						</span>
						<span className="flex items-center gap-1">
							<span className="w-1.5 h-1.5 rounded-full bg-[var(--signal-revolving)]" />
							{filings.length} lobbying filings
						</span>
						<span className="flex items-center gap-1">
							<span className="w-1.5 h-1.5 rounded-full bg-[var(--signal-international)]" />
							{filings.length} filings
						</span>
						<span className="flex items-center gap-1">
							<span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
							{people.length} people
						</span>
						<span className="flex items-center gap-1">
							<span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
							{organizations.length} orgs
						</span>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-3">
					{/* Signal type distribution */}
					<div className="card card-enter card-enter-3">
						<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
							SIGNAL DISTRIBUTION
						</h3>
						<div className="flex flex-col gap-2">
							{signalDistribution.map(([type, count]) => (
								<div key={type} className="flex items-center gap-2">
									<div
										className="w-2 h-2 rounded-full flex-shrink-0"
										style={{ backgroundColor: SIGNAL_COLORS[type] }}
									/>
									<div className="flex-1 text-xs text-[var(--foreground)]">
										{SIGNAL_LABELS[type] || type}
									</div>
									<div className="w-24 h-3 bg-[var(--background)] rounded overflow-hidden">
										<div
											className="h-full rounded"
											style={{
												width: (count / threads.length) * 100 + "%",
												backgroundColor: SIGNAL_COLORS[type],
												opacity: 0.7,
											}}
										/>
									</div>
									<div className="text-xs text-[var(--muted)] tabular-nums w-4 text-right">
										{count}
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Severity Gauge */}
					<div className="card flex flex-col items-center justify-center">
						<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-4">
							HEALTH SCORE
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
									strokeDasharray={stats.avgConfidence * 251.3 + " 251.3"}
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
						<div
							className="mt-2 text-xs font-semibold"
							style={{
								color:
									stats.avgConfidence > 0.7
										? "var(--destructive)"
										: "var(--warning)",
							}}
						>
							{stats.avgConfidence > 0.7
								? "▲ ELEVATED RISK"
								: stats.avgConfidence > 0.5
									? "● MODERATE"
									: "▽ LOW"}
						</div>
					</div>
				</div>

				{/* Key Insight: The L3Harris Triangle */}
				<div
					className="card card-enter card-enter-4"
					style={{ borderLeft: "3px solid var(--destructive)" }}
				>
					<h3
						className="text-xs font-semibold tracking-widest mb-2"
						style={{ color: "var(--destructive)" }}
					>
						▲ KEY INSIGHT — THE L3HARRIS TRIANGLE
					</h3>
					<p className="text-xs text-[var(--foreground)] leading-relaxed mb-2">
						Three independent signals converge on a single cluster:{" "}
						<strong>L3Harris Technologies</strong> holds $73M in DND sole-source
						contracts, is lobbied for by a <strong>former DND executive</strong>{" "}
						through Navigator LLP, and the <strong>Minister's spouse</strong>{" "}
						sits on L3Harris's board.
					</p>
					<div className="flex items-center gap-2 text-[10px]">
						<span
							className="badge"
							style={{
								background: "rgba(239, 68, 68, 0.15)",
								color: "var(--destructive)",
							}}
						>
							3 signals
						</span>
						<span className="text-[var(--muted)]">•</span>
						<span className="text-[var(--muted)]">92% max confidence</span>
						<span className="text-[var(--muted)]">•</span>
						<span className="text-[var(--muted)]">5 entities involved</span>
					</div>
				</div>

				{/* Lobbying Activity Heatmap */}
				<div className="card card-enter card-enter-5">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						LOBBYING ACTIVITY BY DEPARTMENT
					</h3>
					<div className="flex flex-wrap gap-2">
						{stats.lobbyingByDept.map(([dept, count]) => (
							<div
								key={dept}
								className="px-3 py-1.5 rounded text-xs transition-all hover:scale-105 cursor-pointer"
								style={{
									background:
										"rgba(239, 68, 68, " +
										Math.min(0.15 + count * 0.08, 0.5) +
										")",
									color: "var(--foreground)",
								}}
							>
								{dept
									.replace("Department of ", "")
									.replace(
										"Immigration, Refugees and Citizenship Canada",
										"IRCC",
									)}{" "}
								<span className="opacity-60">({count} comms)</span>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* ── Right Panel ─────────────────────────────────── */}
			<div className="md:col-span-3 flex flex-col gap-3">
				{/* Sweep status */}
				<div className="card card-enter card-enter-6">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						LATEST SWEEP
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
								: "Just now"}
						</div>
					)}
					<div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
						<div className="p-1.5 rounded bg-[var(--background)]">
							<div className="text-[var(--signal-procurement)] font-bold">
								{sweepDelta.newContracts}
							</div>
							<div className="text-[var(--muted)]">contracts</div>
						</div>
						<div className="p-1.5 rounded bg-[var(--background)]">
							<div className="text-[var(--signal-revolving)] font-bold">
								{sweepDelta.newFilings}
							</div>
							<div className="text-[var(--muted)]">filings</div>
						</div>
						<div className="p-1.5 rounded bg-[var(--background)]">
							<div className="text-[var(--signal-donation)] font-bold">
								{sweepDelta.newContracts + sweepDelta.newFilings}
							</div>
							<div className="text-[var(--muted)]">lobbying</div>
						</div>
						<div className="p-1.5 rounded bg-[var(--background)]">
							<div className="text-[var(--signal-spousal)] font-bold">
								{sweepDelta.newContracts}
							</div>
							<div className="text-[var(--muted)]">CIEC</div>
						</div>
						<div className="p-1.5 rounded bg-[var(--background)]">
							<div className="text-[var(--signal-international)] font-bold">
								{sweepDelta.newFilings}
							</div>
							<div className="text-[var(--muted)]">lobbying</div>
						</div>
						<div className="p-1.5 rounded bg-[var(--background)]">
							<div className="text-[var(--primary)] font-bold">
								{threads.length}
							</div>
							<div className="text-[var(--muted)]">signals</div>
						</div>
					</div>
				</div>

				{/* Entity watchlist */}
				<div className="card card-enter card-enter-7">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						ENTITY WATCHLIST
					</h3>
					<EntityWatchlist />
				</div>

				{/* Top Lobbying Targets */}
				<div className="card card-enter card-enter-8">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						MOST-LOBBIED DND OFFICIALS
					</h3>
					<div className="flex flex-col gap-1.5">
						{people.slice(0, 5).map((p) => {
							const commCount = filings.reduce(
								(s, f) =>
									s +
									f.communications.filter((c) =>
										c.officials.some((o) => o.includes(p.lastName)),
									).length,
								0,
							);
							return (
								<div
									key={p.id}
									className="flex justify-between text-xs py-1 border-b border-[var(--border)] last:border-0"
								>
									<div className="flex flex-col">
										<span className="truncate max-w-[160px]">
											{p.firstName} {p.lastName}
										</span>
										<span className="text-[9px] text-[var(--muted)]">
											{p.roles[0]?.title}
										</span>
									</div>
									<span className="text-[var(--signal-revolving)] tabular-nums font-mono">
										{commCount} comms
									</span>
								</div>
							);
						})}
					</div>
					<div className="mt-1 pt-1 border-t border-[var(--border)] text-[10px] text-[var(--muted)]">
						Source: Commissioner of Lobbying monthly reports
					</div>
				</div>

				{/* Connection Strengths */}
				<div className="card card-enter card-enter-1">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						STRONGEST CONNECTIONS
					</h3>
					<ConnectionStrengths />
				</div>

				{/* People tracker */}
				<div className="card card-enter card-enter-2">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						KEY PERSONS
					</h3>
					<div className="flex flex-col gap-1.5">
						{people.map((p) => {
							const threadCount = threads.filter((t) =>
								t.nodes.includes(p.id),
							).length;
							return (
								<div
									key={p.id}
									className="flex items-center gap-2 text-xs py-1"
								>
									<div className="w-6 h-6 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-[9px] text-[var(--primary)] font-bold flex-shrink-0">
										{p.firstName[0]}
										{p.lastName[0]}
									</div>
									<div className="flex-1 min-w-0">
										<div className="truncate">
											{p.firstName} {p.lastName}
										</div>
										<div className="text-[9px] text-[var(--muted)] truncate">
											{p.roles[0]?.title}
										</div>
									</div>
									{threadCount > 0 && (
										<span className="text-[9px] bg-[var(--destructive)]/20 text-[var(--destructive)] px-1.5 rounded">
											{threadCount}
										</span>
									)}
								</div>
							);
						})}
					</div>
				</div>
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
		<PretextTooltip text={`${label}: ${value} — ${subtitle}`} side="bottom">
			<div className="card text-center cursor-default">
				<div className="text-[9px] text-[var(--muted)] tracking-widest mb-1">
					{label}
				</div>
				<div className="text-xl font-bold tabular-nums" style={{ color }}>
					{value}
				</div>
				<div className="text-[10px] text-[var(--muted)]">{subtitle}</div>
			</div>
		</PretextTooltip>
	);
}

function EntityWatchlist() {
	const { threads, organizations } = useCivicStore();

	const entityCounts = useMemo(() => {
		const counts: Record<
			string,
			{ name: string; count: number; color: string }
		> = {};
		for (const thread of threads) {
			for (const entityId of thread.nodes) {
				if (!counts[entityId]) {
					const org = organizations.find((o) => o.id === entityId);
					const name =
						org?.names?.[0] ||
						entityId.replace(/org-|person-/g, "").replace(/-/g, " ");
					counts[entityId] = {
						name,
						count: 0,
						color: SIGNAL_COLORS[thread.signalType] || "var(--primary)",
					};
				}
				counts[entityId].count++;
			}
		}
		return Object.values(counts)
			.sort((a, b) => b.count - a.count)
			.slice(0, 8);
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

function ConnectionStrengths() {
	return (
		<div className="flex flex-col gap-2">
			{connectionStrengths.slice(0, 6).map((cs, i) => {
				const fromLabel =
					graphNodes.find((n) => n.id === cs.fromId)?.label || cs.fromId;
				const toLabel =
					graphNodes.find((n) => n.id === cs.toId)?.label || cs.toId;
				const pct = Math.round(cs.strength * 100);
				const color =
					pct > 80
						? "var(--destructive)"
						: pct > 60
							? "var(--warning)"
							: "var(--primary)";
				return (
					<div key={i} className="group cursor-pointer">
						<div className="flex items-center gap-1 text-[10px] mb-0.5">
							<span className="truncate flex-1 text-[var(--foreground)]">
								{fromLabel.length > 12
									? fromLabel.slice(0, 12) + "…"
									: fromLabel}
							</span>
							<span className="text-[var(--muted)]">↔</span>
							<span className="truncate flex-1 text-[var(--foreground)] text-right">
								{toLabel.length > 12 ? toLabel.slice(0, 12) + "…" : toLabel}
							</span>
							<span className="text-[9px] tabular-nums ml-1" style={{ color }}>
								{pct}%
							</span>
						</div>
						<div className="strength-bar">
							<div
								className="strength-bar-fill"
								style={{ width: pct + "%", backgroundColor: color }}
							/>
						</div>
						<div className="text-[8px] text-[var(--muted)] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity line-clamp-1">
							{cs.summary}
						</div>
					</div>
				);
			})}
		</div>
	);
}
