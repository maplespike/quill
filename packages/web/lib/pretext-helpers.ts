"use client";

/**
 * Helper to build rich-inline items from thread data.
 * Entity names become styled chips; narrative text flows around them.
 * Shared across MonitorDashboard, SignalsView, and BriefView.
 */

import type { CivicRichItem } from "@civic-intel/pretext-civic";
import type { Organization, Person } from "../lib/data";

/**
 * Build rich-inline items from a thread summary,
 * highlighting entity names as inline chips.
 */
export function buildRichSummary(
	summary: string,
	entityIds: string[],
	people: Person[],
	organizations: Organization[],
	overrides?: {
		textFont?: string;
		chipFont?: string;
		chipBackground?: string;
		chipBorderColor?: string;
		chipColor?: string;
	},
): CivicRichItem[] {
	const opts = {
		textFont:
			overrides?.textFont ?? "13px 'Space Grotesk', system-ui, sans-serif",
		chipFont:
			overrides?.chipFont ?? "600 11px 'Space Grotesk', system-ui, sans-serif",
		chipBackground: overrides?.chipBackground ?? "rgba(139, 92, 246, 0.12)",
		chipBorderColor: overrides?.chipBorderColor ?? "rgba(139, 92, 246, 0.3)",
		chipColor: overrides?.chipColor ?? "var(--accent)",
	};

	// Build entity name map (use shortest name for matching)
	const entityNames = new Map<string, { id: string; name: string }>();
	for (const id of entityIds) {
		const person = people.find((p) => p.id === id);
		if (person) {
			entityNames.set(person.firstName + " " + person.lastName, {
				id,
				name: person.firstName + " " + person.lastName,
			});
			entityNames.set(person.lastName, {
				id,
				name: person.lastName,
			});
		}
		const org = organizations.find((o) => o.id === id);
		if (org) {
			for (const name of org.names) {
				entityNames.set(name, { id, name });
				// Also add short forms
				if (name.includes(" ")) {
					const short = name.split(" ")[0];
					if (short.length > 3) entityNames.set(short, { id, name: short });
				}
			}
		}
	}

	// Sort names by length (longest first) to match longest entity first
	const sortedNames = [...entityNames.entries()].sort(
		(a, b) => b[0].length - a[0].length,
	);

	// Find all entity mentions in the summary
	type Match = { start: number; end: number; name: string };
	const matches: Match[] = [];
	for (const [nameStr] of sortedNames) {
		let searchFrom = 0;
		while (true) {
			const idx = summary.indexOf(nameStr, searchFrom);
			if (idx === -1) break;
			// Check it's not already inside a match
			const overlaps = matches.some((m) => idx >= m.start && idx < m.end);
			if (!overlaps) {
				matches.push({
					start: idx,
					end: idx + nameStr.length,
					name: nameStr,
				});
			}
			searchFrom = idx + nameStr.length;
		}
	}

	// Sort matches by position
	matches.sort((a, b) => a.start - b.start);

	// Build rich-inline items
	const items: CivicRichItem[] = [];
	let lastEnd = 0;

	for (const match of matches) {
		// Text before this entity
		if (match.start > lastEnd) {
			const before = summary.slice(lastEnd, match.start);
			if (before) {
				items.push({ text: before, font: opts.textFont });
			}
		}
		// Entity chip
		items.push({
			text: match.name,
			font: opts.chipFont,
			break: "never",
			extraWidth: 12,
			paddingX: 4,
			borderRadius: 4,
			background: opts.chipBackground,
			borderColor: opts.chipBorderColor,
			color: opts.chipColor,
		});
		lastEnd = match.end;
	}

	// Remaining text after last entity
	if (lastEnd < summary.length) {
		items.push({ text: summary.slice(lastEnd), font: opts.textFont });
	}

	// If no entities found, just return the plain text
	if (items.length === 0) {
		items.push({ text: summary, font: opts.textFont });
	}

	return items;
}

/**
 * Build a tooltip text from thread data.
 * Returns a multi-line string suitable for PretextTooltip.
 */
export function buildTooltipText(thread: {
	title: string;
	summary: string;
	confidence: number;
	signalType: string;
	nodes: string[];
	sources: string[];
}): string {
	const typeLabel = thread.signalType
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
	return [
		`${typeLabel} — ${Math.round(thread.confidence * 100)}% confidence`,
		"",
		thread.summary,
		"",
		`Entities: ${thread.nodes.map((n) => n.replace(/org-|person-/g, "").replace(/-/g, " ")).join(", ")}`,
		`Sources: ${thread.sources.join(", ")}`,
	].join("\n");
}
