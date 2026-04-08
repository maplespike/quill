"use client";

import { useCivicStore } from "../lib/store";
import { useState, useMemo } from "react";
import type { IntelligenceThread } from "../lib/data";

const SIGNAL_LABELS: Record<string, string> = {
	procurement_lobbying_overlap: "Procurement-Lobbying",
	revolving_door: "Revolving Door",
	spousal_interest_proximity: "Spousal Interest",
	sole_source_heavy_lobbying: "Sole-Source + Lobbying",
	donation_proximity_correlation: "Donation Proximity",
	mandate_divergence: "Mandate Divergence",
	international_layering: "International Layer",
};

const SIGNAL_COLORS: Record<string, string> = {
	procurement_lobbying_overlap: "var(--signal-procurement)",
	revolving_door: "var(--signal-revolving)",
	spousal_interest_proximity: "var(--signal-spousal)",
	sole_source_heavy_lobbying: "var(--signal-sole-source)",
	donation_proximity_correlation: "var(--signal-donation)",
	mandate_divergence: "var(--signal-mandate)",
	international_layering: "var(--signal-international)",
};

type Severity = "all" | "critical" | "high" | "medium" | "low";

function getSeverity(t: IntelligenceThread): "critical" | "high" | "medium" | "low" {
	if (t.confidence >= 0.85) return "critical";
	if (t.confidence >= 0.7) return "high";
	if (t.confidence >= 0.5) return "medium";
	return "low";
}

export function SignalsView() {
	const { threads, alerts, dismissAlert, readAlert } = useCivicStore();
	const [severityFilter, setSeverityFilter] = useState<Severity>("all");
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [dismissed, setDismissed] = useState(false);

	const signalTypes = useMemo(() => {
		return [...new Set(threads.map(t => t.signalType))];
	}, [threads]);

	const filteredThreads = useMemo(() => {
		return threads.filter(t => {
			if (severityFilter !== "all" && getSeverity(t) !== severityFilter) return false;
			if (typeFilter !== "all" && t.signalType !== typeFilter) return false;
			return true;
		});
	}, [threads, severityFilter, typeFilter]);

	const severityCounts = useMemo(() => {
		const counts = { critical: 0, high: 0, medium: 0, low: 0 };
		threads.forEach(t => counts[getSeverity(t)]++);
		return counts;
	}, [threads]);

	return (
		<div className="flex h-full">
			{/* ── Left: Filters ───────────────────────────────── */}
			<div className="w-56 border-r border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-4 overflow-auto">
				<div>
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">SEVERITY</h3>
					<div className="flex flex-col gap-1">
						{(["all", "critical", "high", "medium", "low"] as Severity[]).map(s => (
							<button
								key={s}
								onClick={() => setSeverityFilter(s)}
								className={"text-left text-xs px-2 py-1.5 rounded transition-colors " + (severityFilter === s ? "bg-[var(--accent-dim)] text-[var(--primary)]" : "text-[var(--muted)] hover:bg-[var(--card-hover)]")}
							>
								{s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
								<span className="ml-2 tabular-nums opacity-50">
									{s === "all" ? threads.length : severityCounts[s]}
								</span>
							</button>
						))}
					</div>
				</div>

				<div>
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">SIGNAL TYPE</h3>
					<div className="flex flex-col gap-1">
						<button
							onClick={() => setTypeFilter("all")}
							className={"text-left text-xs px-2 py-1.5 rounded transition-colors " + (typeFilter === "all" ? "bg-[var(--accent-dim)] text-[var(--primary)]" : "text-[var(--muted)] hover:bg-[var(--card-hover)]")}
						>
							All Types
						</button>
						{signalTypes.map(type => (
							<button
								key={type}
								onClick={() => setTypeFilter(type)}
								className={"text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center gap-2 " + (typeFilter === type ? "bg-[var(--accent-dim)]" : "hover:bg-[var(--card-hover)]")}
							>
								<div className="w-2 h-2 rounded-full" style={{ backgroundColor: SIGNAL_COLORS[type] }} />
								<span className={typeFilter === type ? "text-[var(--primary)]" : "text-[var(--muted)]"}>
									{SIGNAL_LABELS[type]}
								</span>
							</button>
						))}
					</div>
				</div>

				<div>
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">SUMMARY</h3>
					<div className="text-xs text-[var(--muted)] space-y-1">
						<div>Total signals: <span className="text-[var(--foreground)]">{threads.length}</span></div>
						<div>Critical: <span className="text-[var(--destructive)]">{severityCounts.critical}</span></div>
						<div>High: <span className="text-[var(--warning)]">{severityCounts.high}</span></div>
						<div>Medium: <span className="text-[var(--success)]">{severityCounts.medium}</span></div>
						<div>Low: <span className="text-[var(--muted)]">{severityCounts.low}</span></div>
					</div>
				</div>
			</div>

			{/* ── Center: Signal Feed ──────────────────────────── */}
			<div className="flex-1 overflow-auto p-4">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-xs font-semibold tracking-widest text-[var(--muted)]">
						SIGNAL FEED ({filteredThreads.length})
					</h2>
					<div className="flex gap-2">
						<button className="text-[10px] px-2 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)] transition-colors">
							EXPORT CSV
						</button>
						<button className="text-[10px] px-2 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)] transition-colors">
							SHARE BRIEF
						</button>
					</div>
				</div>

				{filteredThreads.length === 0 ? (
					<div className="text-center text-sm text-[var(--muted)] py-12">
						No signals match your filters.
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{filteredThreads.map((thread) => (
							<SignalDetailCard key={thread.id} thread={thread} />
						))}
					</div>
				)}
			</div>

			{/* ── Right: Alert History ─────────────────────────── */}
			<div className="w-72 border-l border-[var(--border)] bg-[var(--card)] p-4 flex flex-col overflow-auto">
				<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
					ALERT HISTORY ({alerts.length})
				</h3>
				<div className="flex flex-col gap-2">
					{alerts.map((alert) => (
						<div
							key={alert.id}
							className={"card text-xs " + (alert.dismissed ? "opacity-40" : "")}
							onClick={() => readAlert(alert.id)}
						>
							<div className="flex items-center gap-2 mb-1">
								<div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SIGNAL_COLORS[alert.thread.signalType] }} />
								<span className="text-[10px] text-[var(--muted)]">{SIGNAL_LABELS[alert.thread.signalType]}</span>
								{!alert.read && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />}
							</div>
							<div className="line-clamp-2">{alert.thread.title}</div>
							<div className="flex items-center gap-2 mt-2">
								<button
									onClick={(e) => { e.stopPropagation(); readAlert(alert.id); }}
									className="text-[9px] text-[var(--primary)] hover:underline"
								>
									VERIFY
								</button>
								<button
									onClick={(e) => { e.stopPropagation(); dismissAlert(alert.id); }}
									className="text-[9px] text-[var(--muted)] hover:underline"
								>
									DISMISS
								</button>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function SignalDetailCard({ thread }: { thread: IntelligenceThread }) {
	const [expanded, setExpanded] = useState(false);
	const color = SIGNAL_COLORS[thread.signalType] || "var(--primary)";
	const severity = getSeverity(thread);

	return (
		<div
			className="card cursor-pointer hover:bg-[var(--card-hover)] transition-colors"
			style={{ borderLeft: "4px solid " + color }}
			onClick={() => setExpanded(!expanded)}
		>
			<div className="flex items-start gap-3">
				{/* Severity badge */}
				<div className="flex flex-col items-center gap-1 pt-1">
					<div
						className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
						style={{ backgroundColor: color + "20", color }}
					>
						{Math.round(thread.confidence * 100)}
					</div>
					<span className="text-[8px] uppercase tracking-wider" style={{ color }}>
						{severity}
					</span>
				</div>

				<div className="flex-1">
					<div className="flex items-center gap-2 mb-1">
						<span className="badge" style={{ background: color + "20", color }}>
							{SIGNAL_LABELS[thread.signalType]}
						</span>
						<span className="text-[10px] text-[var(--muted)] tabular-nums">
							{thread.sources.length} sources
						</span>
					</div>

					<h4 className="text-sm font-semibold mb-1">{thread.title}</h4>
					<p className="text-xs text-[var(--muted)] leading-relaxed">
						{expanded ? thread.description : thread.description.slice(0, 200) + (thread.description.length > 200 ? "…" : "")}
					</p>

					{/* Confidence bar */}
					<div className="mt-2 flex items-center gap-2">
						<span className="text-[9px] text-[var(--muted)]">Confidence</span>
						<div className="flex-1 h-1.5 bg-[var(--background)] rounded overflow-hidden">
							<div
								className="h-full rounded transition-all duration-500"
								style={{
									width: (thread.confidence * 100) + "%",
									backgroundColor: color,
								}}
							/>
						</div>
						<span className="text-[9px] tabular-nums" style={{ color }}>
							{Math.round(thread.confidence * 100)}%
						</span>
					</div>

					{expanded && (
						<div className="mt-3 pt-3 border-t border-[var(--border)]">
							<div className="flex flex-wrap gap-1 mb-2">
								{thread.nodes.map(n => (
									<span key={n} className="intel-chip">
										{n.replace(/org-|person-/g, "").replace(/-/g, " ")}
									</span>
								))}
							</div>
							<div className="flex flex-wrap gap-1 mb-3">
								{thread.sources.map((s, i) => (
									<span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)]">
										{s}
									</span>
								))}
							</div>
							<div className="flex gap-2">
								<button className="text-[10px] px-3 py-1 rounded border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors">
									✓ VERIFY
								</button>
								<button className="text-[10px] px-3 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--destructive)] hover:text-[var(--destructive)] transition-colors">
									✗ CHALLENGE
								</button>
								<button className="text-[10px] px-3 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
									+ EXTEND
								</button>
								<button className="text-[10px] px-3 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
									↗ SHARE
								</button>
							</div>
						</div>
					)}
				</div>

				<div className="text-[var(--muted)] text-xs pt-1">{expanded ? "▼" : "▶"}</div>
			</div>
		</div>
	);
}
