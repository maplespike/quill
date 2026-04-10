"use client";

/**
 * Empty state components for when views have no data.
 */
import { useCivicStore } from "../lib/store";

export function EmptySignals({
	onClearFilters,
}: {
	onClearFilters?: () => void;
}) {
	return (
		<div className="empty-state">
			<div className="empty-state-icon">✓</div>
			<h3 className="text-sm font-medium text-[var(--foreground)]">
				All caught up
			</h3>
			<p className="text-xs">No signals match your current filters.</p>
			{onClearFilters && (
				<button
					onClick={onClearFilters}
					className="px-3 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-colors"
				>
					Clear Filters
				</button>
			)}
		</div>
	);
}

export function EmptySearch({ query }: { query: string }) {
	return (
		<div className="empty-state">
			<div className="empty-state-icon">🔍</div>
			<h3 className="text-sm font-medium text-[var(--foreground)]">
				No results for &ldquo;{query}&rdquo;
			</h3>
			<p className="text-xs">Try a different search term.</p>
		</div>
	);
}

export function EmptyExplorer() {
	const { navigateTo } = useCivicStore();
	return (
		<div className="empty-state">
			<div className="empty-state-icon">🕸️</div>
			<h3 className="text-sm font-medium text-[var(--foreground)]">
				Select an entity to explore
			</h3>
			<p className="text-xs">
				Click a node in the graph or search for a person or organization.
			</p>
			<button
				onClick={() => navigateTo({ view: "monitor" })}
				className="px-3 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-colors"
			>
				View Signals →
			</button>
		</div>
	);
}

export function EmptyBrief() {
	return (
		<div className="empty-state">
			<div className="empty-state-icon">📰</div>
			<h3 className="text-sm font-medium text-[var(--foreground)]">
				No brief generated yet
			</h3>
			<p className="text-xs">
				Run a sweep to generate an intelligence brief from detected signals.
			</p>
		</div>
	);
}
