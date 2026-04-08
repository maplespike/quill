"use client";

import { useCivicStore } from "../lib/store";
import { useEffect, useRef, useMemo, useState } from "react";
import type { IntelligenceThread } from "@civic-intel/core";

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
	procurement_lobbying_overlap: "Procurement-Lobbying Overlap",
	revolving_door: "Revolving Door",
	spousal_interest_proximity: "Spousal Interest Proximity",
	sole_source_heavy_lobbying: "Sole-Source + Heavy Lobbying",
	donation_proximity_correlation: "Donation Proximity",
	mandate_divergence: "Mandate Divergence",
	international_layering: "International Layering",
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

export function BriefView() {
	const { brief, threads } = useCivicStore();
	const containerRef = useRef<HTMLDivElement>(null);
	const [activeSection, setActiveSection] = useState(0);

	// Scroll-triggered reveals
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.classList.add("visible");
					}
				}
			},
			{ threshold: 0.15, rootMargin: "0px 0px -50px 0px" },
		);

		const sections = containerRef.current?.querySelectorAll(".brief-section");
		sections?.forEach((s) => observer.observe(s));

		return () => observer.disconnect();
	}, [brief]);

	// Auto-track active section
	useEffect(() => {
		const handler = () => {
			if (!containerRef.current) return;
			const sections = containerRef.current.querySelectorAll(".brief-section");
			let found = 0;
			sections.forEach((s, i) => {
				const rect = s.getBoundingClientRect();
				if (rect.top < window.innerHeight * 0.5) found = i;
			});
			setActiveSection(found);
		};
		window.addEventListener("scroll", handler, { passive: true });
		return () => window.removeEventListener("scroll", handler);
	}, []);

	const threadGroups = useMemo(() => {
		const groups: Record<string, IntelligenceThread[]> = {};
		for (const t of threads) {
			if (!groups[t.signalType]) groups[t.signalType] = [];
			groups[t.signalType].push(t);
		}
		return groups;
	}, [threads]);

	if (!brief) {
		return (
			<div className="flex items-center justify-center h-full text-sm text-[var(--muted)]">
				No brief available — run a sweep first.
			</div>
		);
	}

	return (
		<div ref={containerRef} className="max-w-3xl mx-auto px-6 py-12">
			{/* ── Brief Header ────────────────────────────────── */}
			<div className="brief-section mb-12">
				<div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-4 tracking-widest">
					<div className="w-8 h-px bg-[var(--border)]" />
					DAILY INTELLIGENCE BRIEF
					<div className="flex-1 h-px bg-[var(--border)]" />
					<span className="tabular-nums">
						{new Date(brief.generatedAt).toLocaleDateString("en-CA", {
							weekday: "long",
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
					</span>
				</div>

				{/* Health score */}
				<div className="flex items-center gap-6 mb-8">
					<div className="relative w-24 h-24">
						<svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
							<circle
								cx="50"
								cy="50"
								r="40"
								fill="none"
								stroke="var(--border)"
								strokeWidth="6"
							/>
							<circle
								cx="50"
								cy="50"
								r="40"
								fill="none"
								stroke={
									(brief.confidence * 100) > 70
										? "var(--destructive)"
										: (brief.confidence * 100) > 40
											? "var(--warning)"
											: "var(--success)"
								}
								strokeWidth="6"
								strokeLinecap="round"
								strokeDasharray={((brief.confidence * 100) / 100) * 251.3 + ' 251.3'}
							/>
						</svg>
						<div className="absolute inset-0 flex flex-col items-center justify-center">
							<span className="text-xl font-bold tabular-nums">
								{Math.round(brief.confidence * 100)}
							</span>
							<span className="text-[8px] text-[var(--muted)]">SCORE</span>
						</div>
					</div>
					<div>
						<h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
							Canadian Government Intelligence Report
						</h1>
						<p className="text-sm text-[var(--muted)]">
							{threads.length} active signals across{" "}
							{5} data sources.{" "}
							{brief.entityIds.length} entities tracked.
						</p>
					</div>
				</div>
			</div>

			{/* ── Brief Sections ──────────────────────────────── */}
			{brief.sections.map((section, i) => (
				<div key={i} className="brief-section mb-10">
					<div className="flex items-center gap-3 mb-4">
						<span
							className="text-xs font-bold tracking-widest"
							style={{
								color:
									section.signalTypes && section.signalTypes.length > 0
										? "var(--destructive)"
										: section.signalTypes && section.signalTypes.length > 2
											? "var(--warning)"
											: "var(--muted)",
							}}
						>
							{section.signalTypes && section.signalTypes.length > 0 && "● "}
							{section.title.toUpperCase()}
						</span>
						<div className="flex-1 h-px bg-[var(--border)]" />
						<span className="text-[10px] text-[var(--muted)]">
							{i + 1}/{brief.sections.length}
						</span>
					</div>
					<div
						className="text-sm leading-relaxed text-[var(--card-foreground)]"
						style={{ fontFamily: "Space Grotesk, sans-serif", lineHeight: 1.8 }}
					>
						{section.content}
					</div>
				</div>
			))}

			{/* ── Thread Deep Dives ───────────────────────────── */}
			<div className="brief-section mb-10">
				<div className="flex items-center gap-3 mb-6">
					<span className="text-xs font-bold tracking-widest text-[var(--accent)]">
						◆ SIGNAL ANALYSIS
					</span>
					<div className="flex-1 h-px bg-[var(--border)]" />
				</div>

				<div className="flex flex-col gap-6">
					{threads.map((thread) => (
						<ThreadCard key={thread.id} thread={thread} />
					))}
				</div>
			</div>

			{/* ── Methodology Note ────────────────────────────── */}
			<div className="brief-section mb-10">
				<div className="card bg-[var(--background)] border-dashed">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-2">
						METHODOLOGY
					</h3>
					<p className="text-xs text-[var(--muted)] leading-relaxed">
						This brief is generated from publicly available Canadian government data
						sources: CanadaBuys (proactive disclosure of contracts over $10K), the Office
						of the Commissioner of Lobbying (monthly communication reports and registration
						data), the Conflict of Interest and Ethics Commissioner (public summaries of
						disclosed interests including spousal interests), Elections Canada (political
						contribution data), and Global Affairs Canada (international assistance project
						data). Every assertion links to a primary source. Signal confidence scores
						reflect the strength of cross-referenced connections, not editorial judgment.
					</p>
				</div>
			</div>

			{/* ── Side nav dots ───────────────────────────────── */}
			<div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
				{brief.sections.map((_, i) => (
					<button
						key={i}
						onClick={() => {
							const sections =
								containerRef.current?.querySelectorAll(".brief-section");
							sections?.[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
						}}
						className={`w-2 h-2 rounded-full transition-all ${
							activeSection === i
								? "bg-[var(--primary)] scale-125"
								: "bg-[var(--border)] hover:bg-[var(--muted)]"
						}`}
					/>
				))}
			</div>
		</div>
	);
}

function ThreadCard({ thread }: { thread: IntelligenceThread }) {
	const [expanded, setExpanded] = useState(false);
	const color = SIGNAL_COLORS[thread.signalType] || "var(--primary)";

	return (
		<div
			className="card cursor-pointer transition-all hover:bg-[var(--card-hover)]"
			style={{ borderLeft: `3px solid ${color}` }}
			onClick={() => setExpanded(!expanded)}
		>
			<div className="flex items-start gap-3">
				<div className="text-lg mt-0.5">
					{SIGNAL_ICONS[thread.signalType] || "◉"}
				</div>
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-1">
						<span
							className="badge"
							style={{
								background: color + '20',
								color,
							}}
						>
							{SIGNAL_LABELS[thread.signalType]}
						</span>
						<span className="text-[10px] text-[var(--muted)] tabular-nums">
							{Math.round(thread.confidence * 100)}% confidence
						</span>
					</div>
					<h4 className="text-sm font-semibold mb-1">{thread.title}</h4>
					<p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-3">
						{thread.description}
					</p>

					{expanded && (
						<div className="mt-3 pt-3 border-t border-[var(--border)] animate-fade-in-up">
							{/* Entities */}
							<div className="mb-2">
								<span className="text-[10px] text-[var(--muted)] tracking-widest">
									ENTITIES:
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
							<div>
								<span className="text-[10px] text-[var(--muted)] tracking-widest">
									SOURCES:
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
						</div>
					)}
				</div>
				<div className="text-[var(--muted)] text-xs">{expanded ? "▼" : "▶"}</div>
			</div>
		</div>
	);
}
