"use client";

import { useCivicStore } from "../lib/store";
import { useMemo, useState } from "react";
import type { IntelligenceThread } from "@civic-intel/core";

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

const SIGNAL_ICONS: Record<string, string> = {
	procurement_lobbying_overlap: "⚡",
	revolving_door: "🔄",
	spousal_interest_proximity: "💑",
	sole_source_heavy_lobbying: "📋",
	donation_proximity_correlation: "💰",
	mandate_divergence: "📊",
	international_layering: "🌍",
};

type FilterType = "all" | string;

export function SignalsView() {
	const { threads, alerts, dismissAlert, readAlert, clearAlerts } =
		useCivicStore();
	const [signalFilter, setSignalFilter] = useState<FilterType>("all");
	const [selectedThread, setSelectedThread] = useState<string | null>(null);
	const [showDismissed, setShowDismissed] = useState(false);

	const filteredThreads = useMemo(() => {
		let filtered = threads;
		if (signalFilter !== "all") {
			filtered = filtered.filter((t) => t.signalType === signalFilter);
		}
		return filtered.sort((a, b) => b.confidence - a.confidence);
	}, [threads, signalFilter]);

	const signalTypes = useMemo(() => {
		const types = new Set(threads.map((t) => t.signalType));
		return [...types];
	}, [threads]);

	const unreadCount = alerts.filter((a) => !a.read && !a.dismissed).length;
	const highConfidenceCount = threads.filter((t) => t.confidence >= 0.7).length;

	return (
		<div className="max-w-4xl mx-auto p-4">
			{/* ── Header ──────────────────────────────────────── */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h2 className="text-lg font-bold">Signal Feed</h2>
					<p className="text-xs text-[var(--muted)]">
						{threads.length} signals detected · {highConfidenceCount} high
						confidence · {unreadCount} unread alerts
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={() => {
							for (const a of alerts.filter((a) => !a.read)) readAlert(a.id);
						}}
						className="px-3 py-1.5 text-xs rounded border border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
					>
						Mark all read
					</button>
					<button
						onClick={clearAlerts}
						className="px-3 py-1.5 text-xs rounded border border-[var(--border)] hover:border-[var(--destructive)] text-[var(--muted)] hover:text-[var(--destructive)] transition-colors"
					>
						Clear alerts
					</button>
				</div>
			</div>

			{/* ── Filters ─────────────────────────────────────── */}
			<div className="flex items-center gap-2 mb-4">
				<button
					onClick={() => setSignalFilter("all")}
					className={`px-3 py-1 text-xs rounded transition-colors ${
						signalFilter === "all"
							? "bg-[var(--primary)] text-[var(--primary-foreground)]"
							: "text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)]"
					}`}
				>
					All ({threads.length})
				</button>
				{signalTypes.map((type) => {
					const count = threads.filter((t) => t.signalType === type).length;
					return (
						<button
							key={type}
							onClick={() => setSignalFilter(type)}
							className={`px-3 py-1 text-xs rounded transition-colors ${
								signalFilter === type
									? "text-white"
									: "text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)]"
							}`}
							style={
								signalFilter === type
									? { background: SIGNAL_COLORS[type] }
									: undefined
							}
						>
							{SIGNAL_ICONS[type]} {SIGNAL_LABELS[type]} ({count})
						</button>
					);
				})}
			</div>

			{/* ── Signal Cards ────────────────────────────────── */}
			<div className="flex flex-col gap-3">
				{filteredThreads.map((thread) => (
					<SignalDetailCard
						key={thread.id}
						thread={thread}
						expanded={selectedThread === thread.id}
						onToggle={() =>
							setSelectedThread(selectedThread === thread.id ? null : thread.id)
						}
					/>
				))}
				{filteredThreads.length === 0 && (
					<div className="text-center py-12 text-sm text-[var(--muted)]">
						No signals match the current filter.
					</div>
				)}
			</div>

			{/* ── Alert History ───────────────────────────────── */}
			{alerts.length > 0 && (
				<div className="mt-8">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
						ALERT HISTORY
					</h3>
					<div className="flex flex-col gap-1">
						{alerts
							.filter((a) => showDismissed || !a.dismissed)
							.slice(0, 20)
							.map((alert) => (
								<div
									key={alert.id}
									className={`flex items-center gap-3 px-3 py-2 rounded text-xs transition-colors ${
										alert.dismissed
											? "opacity-40"
											: alert.read
												? "bg-[var(--card)]"
												: "bg-[var(--card)] border-l-2 border-l-[var(--accent)]"
									}`}
								>
									<span>
										{SIGNAL_ICONS[alert.thread.signalType] || "◉"}
									</span>
									<span className="flex-1 truncate">
										{alert.thread.title}
									</span>
									<span className="text-[var(--muted)] tabular-nums">
										{new Date(alert.timestamp).toLocaleTimeString()}
									</span>
									{!alert.read && (
										<button
											onClick={() => readAlert(alert.id)}
											className="text-[var(--primary)] hover:underline"
										>
											read
										</button>
									)}
									{!alert.dismissed && (
										<button
											onClick={() => dismissAlert(alert.id)}
											className="text-[var(--destructive)] hover:underline"
										>
											dismiss
										</button>
									)}
								</div>
							))}
					</div>
					{alerts.some((a) => a.dismissed) && (
						<button
							onClick={() => setShowDismissed(!showDismissed)}
							className="mt-2 text-[10px] text-[var(--muted)] hover:text-[var(--foreground)]"
						>
							{showDismissed ? "Hide" : "Show"} dismissed ({alerts.filter((a) => a.dismissed).length})
						</button>
					)}
				</div>
			)}

			{/* ── Export ──────────────────────────────────────── */}
			<div className="mt-8 card">
				<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-2">
					EXPORT
				</h3>
				<div className="flex gap-2">
					<button className="px-3 py-1.5 text-xs rounded border border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
						📄 Export as JSON
					</button>
					<button className="px-3 py-1.5 text-xs rounded border border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
						📊 Export as PDF
					</button>
				</div>
			</div>
		</div>
	);
}

function SignalDetailCard({
	thread,
	expanded,
	onToggle,
}: {
	thread: IntelligenceThread;
	expanded: boolean;
	onToggle: () => void;
}) {
	const color = SIGNAL_COLORS[thread.signalType] || "var(--primary)";
	const severity =
		thread.confidence >= 0.85
			? "critical"
			: thread.confidence >= 0.7
				? "high"
				: thread.confidence >= 0.5
					? "medium"
					: "low";

	return (
		<div
			className={`card severity-${severity} cursor-pointer transition-all`}
			style={{ borderLeftColor: color, borderLeftWidth: "3px" }}
			onClick={onToggle}
		>
			<div className="flex items-start gap-3">
				<div className="text-lg">{SIGNAL_ICONS[thread.signalType] || "◉"}</div>
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-1">
						<span
							className="badge"
							style={{ background: color + '20', color }}
						>
							{SIGNAL_LABELS[thread.signalType]}
						</span>
						<span className="text-[10px] text-[var(--muted)]">
							Severity: {severity.toUpperCase()}
						</span>
						<span className="text-[10px] text-[var(--muted)] tabular-nums ml-auto">
							{Math.round(thread.confidence * 100)}% confidence
						</span>
					</div>
					<h4 className="text-sm font-semibold mb-1">{thread.title}</h4>

					{/* Confidence bar */}
					<div className="w-full h-1.5 bg-[var(--background)] rounded-full mb-2 overflow-hidden">
						<div
							className="h-full rounded-full transition-all duration-500"
							style={{
								width: (thread.confidence * 100) + '%',
								backgroundColor: color,
							}}
						/>
					</div>

					{!expanded && (
						<p className="text-xs text-[var(--muted)] line-clamp-2">
							{thread.description}
						</p>
					)}

					{expanded && (
						<div className="animate-fade-in-up">
							<p className="text-xs text-[var(--foreground)] leading-relaxed mb-3">
								{thread.description}
							</p>

							{/* Entities */}
							<div className="mb-2">
								<span className="text-[10px] text-[var(--muted)] tracking-widest">
									CONNECTED ENTITIES:
								</span>
								<div className="flex flex-wrap gap-1 mt-1">
									{thread.nodes.map((e) => (
										<span key={e} className="intel-chip">
											{e.replace(/org-|person-/g, "").replace(/-/g, " ")}
										</span>
									))}
								</div>
							</div>

							{/* Sources */}
							<div className="mb-2">
								<span className="text-[10px] text-[var(--muted)] tracking-widest">
									PRIMARY SOURCES:
								</span>
								<div className="flex flex-wrap gap-1 mt-1">
									{thread.sources.map((s, i) => (
										<span
											key={i}
											className="text-[10px] px-2 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)]"
										>
											{s}
										</span>
									))}
								</div>
							</div>

							{/* Actions */}
							<div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
								<button className="px-2 py-1 text-[10px] rounded border border-[var(--border)] hover:border-[var(--success)] text-[var(--muted)] hover:text-[var(--success)]">
									✓ Verify
								</button>
								<button className="px-2 py-1 text-[10px] rounded border border-[var(--border)] hover:border-[var(--destructive)] text-[var(--muted)] hover:text-[var(--destructive)]">
									✗ Challenge
								</button>
								<button className="px-2 py-1 text-[10px] rounded border border-[var(--border)] hover:border-[var(--accent)] text-[var(--muted)] hover:text-[var(--accent)]">
									+ Extend
								</button>
								<div className="flex-1" />
								<button className="px-2 py-1 text-[10px] rounded border border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted)] hover:text-[var(--primary)]">
									Share Brief →
								</button>
							</div>
						</div>
					)}
				</div>
				<span className="text-[var(--muted)] text-xs">
					{expanded ? "▼" : "▶"}
				</span>
			</div>
		</div>
	);
}
