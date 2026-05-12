"use client";

/**
 * SignalCard — Reusable signal/thread card with action buttons
 *
 * Used across: Monitor, Signals, Brief views
 * Actions: Explore thread, Read brief, Dismiss
 */
import type { IntelligenceThread } from "../lib/data";
import { useCivicStore } from "../lib/store";
import { getShareableURL } from "../lib/useURLSync";

const SIGNAL_ICONS: Record<string, string> = {
	procurement_lobbying_overlap: "⚡",
	revolving_door: "🔄",
	spousal_interest_proximity: "💑",
	sole_source_heavy_lobbying: "📋",
	donation_proximity_correlation: "💰",
	mandate_divergence: "📊",
	international_layering: "🌍",
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

const SIGNAL_COLORS: Record<string, string> = {
	procurement_lobbying_overlap: "var(--signal-procurement)",
	revolving_door: "var(--signal-revolving)",
	spousal_interest_proximity: "var(--signal-spousal)",
	sole_source_heavy_lobbying: "var(--signal-sole-source)",
	donation_proximity_correlation: "var(--signal-donation)",
	mandate_divergence: "var(--signal-mandate)",
	international_layering: "var(--signal-international)",
};

export type Severity = "critical" | "high" | "medium" | "low";

export function getSeverity(t: IntelligenceThread): Severity {
	if (t.confidence >= 0.85) return "critical";
	if (t.confidence >= 0.7) return "high";
	if (t.confidence >= 0.5) return "medium";
	return "low";
}

export function getSeverityColor(severity: Severity): string {
	switch (severity) {
		case "critical":
			return "var(--destructive)";
		case "high":
			return "var(--warning)";
		case "medium":
			return "var(--primary)";
		case "low":
			return "var(--muted)";
	}
}

interface SignalCardProps {
	thread: IntelligenceThread;
	expanded?: boolean;
	showActions?: boolean;
	onClick?: () => void;
}

export function SignalCard({
	thread,
	expanded = false,
	showActions = true,
	onClick,
}: SignalCardProps) {
	const { navigateTo, dismissAlert, readAlert, alerts } = useCivicStore();
	const severity = getSeverity(thread);
	const severityColor = getSeverityColor(severity);
	const signalColor = SIGNAL_COLORS[thread.signalType] || "var(--primary)";
	const icon = SIGNAL_ICONS[thread.signalType] || "△";
	const label = SIGNAL_LABELS[thread.signalType] || thread.signalType;

	const alert = alerts.find((a) => a.thread.id === thread.id);
	const isUnread = alert && !alert.read;

	const handleExplore = () => {
		navigateTo({
			view: "explore",
			focusEntity: thread.nodes[0],
			focusThread: thread.id,
		});
	};

	const handleBrief = () => {
		navigateTo({
			view: "brief",
			focusThread: thread.id,
		});
	};

	const handleDismiss = () => {
		if (alert) {
			dismissAlert(alert.id);
		}
	};

	const handleShare = async () => {
		const url = getShareableURL({
			view: "brief",
			thread: thread.id,
		});
		await navigator.clipboard.writeText(url);
	};

	return (
		<article
			className={[
				"signal-card relative rounded-lg border bg-[var(--card)] transition-all",
				expanded
					? "p-5 border-2"
					: "p-3 border border-[var(--border)] hover:border-[var(--primary)]",
				isUnread && "border-l-2 border-l-[var(--primary)]",
				onClick && "cursor-pointer",
			]
				.filter(Boolean)
				.join(" ")}
			onClick={onClick}
		>
			{/* Unread indicator */}
			{isUnread && (
				<span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--primary)]" />
			)}

			{/* Header */}
			<div className="flex items-start gap-3">
				<span
					className="text-lg flex-shrink-0"
					style={{ color: signalColor }}
					aria-hidden
				>
					{icon}
				</span>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span
							className="text-[10px] font-semibold tracking-widest"
							style={{ color: signalColor }}
						>
							{label}
						</span>
						<span
							className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
							style={{
								backgroundColor: severityColor + "20",
								color: severityColor,
							}}
						>
							{severity.toUpperCase()}
						</span>
					</div>
					<h3 className="text-sm font-medium text-[var(--foreground)] leading-snug">
						{thread.title}
					</h3>
				</div>
				<div className="flex items-center gap-1.5 flex-shrink-0">
					<span className="text-xs text-[var(--muted)]">
						{Math.round(thread.confidence * 100)}%
					</span>
				</div>
			</div>

			{/* Expanded content */}
			{expanded && (
				<div className="mt-4 pt-4 border-t border-[var(--border)]">
					<p className="text-xs text-[var(--muted)] leading-relaxed mb-3">
						{thread.summary}
					</p>
					<div className="flex flex-wrap gap-1.5">
						{thread.nodes.slice(0, 4).map((nodeId) => (
							<span
								key={nodeId}
								className="text-[10px] px-2 py-0.5 rounded bg-[var(--background)] text-[var(--muted)]"
							>
								{nodeId}
							</span>
						))}
					</div>
				</div>
			)}

			{/* Actions */}
			{showActions && (
				<div className="flex items-center gap-2 mt-3">
					<button
						onClick={(e) => {
							e.stopPropagation();
							handleExplore();
						}}
						className="px-2.5 py-1 text-[10px] font-medium rounded bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 transition-colors"
					>
						Explore →
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							handleBrief();
						}}
						className="px-2.5 py-1 text-[10px] rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
					>
						Read Brief
					</button>
					{expanded && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								handleShare();
							}}
							className="px-2.5 py-1 text-[10px] rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
						>
							Share
						</button>
					)}
					{alert && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								handleDismiss();
							}}
							className="ml-auto px-2 py-1 text-[10px] text-[var(--muted)] hover:text-[var(--destructive)] transition-colors"
						>
							Dismiss
						</button>
					)}
				</div>
			)}
		</article>
	);
}

// Compact variant for lists
export function SignalCardCompact({
	thread,
	onClick,
}: {
	thread: IntelligenceThread;
	onClick?: () => void;
}) {
	const severity = getSeverity(thread);
	const severityColor = getSeverityColor(severity);
	const signalColor = SIGNAL_COLORS[thread.signalType] || "var(--primary)";
	const icon = SIGNAL_ICONS[thread.signalType] || "△";

	return (
		<button
			onClick={onClick}
			className="w-full flex items-center gap-2 px-3 py-2 text-left rounded hover:bg-[var(--card-hover)] transition-colors"
		>
			<span className="text-xs" style={{ color: signalColor }}>
				{icon}
			</span>
			<span className="flex-1 text-xs text-[var(--foreground)] truncate">
				{thread.title}
			</span>
			<span
				className="text-[9px] px-1.5 py-0.5 rounded"
				style={{
					backgroundColor: severityColor + "20",
					color: severityColor,
				}}
			>
				{Math.round(thread.confidence * 100)}%
			</span>
		</button>
	);
}
