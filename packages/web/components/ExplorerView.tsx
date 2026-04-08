"use client";

import { useCivicStore } from "../lib/store";
import { useMemo, useState } from "react";
import type { Person, Organization } from "@civic-intel/core";

type ExplorerMode = "graph" | "chart";
type EntityType = "all" | "person" | "org" | "contract" | "filing" | "donation";

export function ExplorerView() {
	const {
		threads,
		people,
		organizations,
		contracts,
		filings,
		donations,
		disclosures,
		searchQuery,
		explorerFocusEntity,
		setExplorerFocusEntity,
	} = useCivicStore();

	const [mode, setMode] = useState<ExplorerMode>("graph");
	const [entityFilter, setEntityFilter] = useState<EntityType>("all");
	const [selectedThread, setSelectedThread] = useState<string | null>(null);

	const filteredEntities = useMemo(() => {
		const q = searchQuery.toLowerCase();
		const allEntities: Array<{
			id: string;
			type: string;
			name: string;
			details: string;
			threadCount: number;
		}> = [];

		// People
		if (entityFilter === "all" || entityFilter === "person") {
			for (const p of people) {
				const name = p.names?.[0] || `${p.firstName} ${p.lastName}`;
				if (q && !name.toLowerCase().includes(q)) continue;
				const tc = threads.filter((t) =>
					t.nodes.some((e) => e.includes(p.id) || e.includes(name.toLowerCase().replace(/\s+/g, "-"))),
				).length;
				allEntities.push({
					id: p.id,
					type: "person",
					name,
					details: p.roles?.[0]?.title || "Person",
					threadCount: tc,
				});
			}
		}

		// Organizations
		if (entityFilter === "all" || entityFilter === "org") {
			for (const o of organizations) {
				const name = o.names?.[0] || o.id;
				if (q && !name.toLowerCase().includes(q)) continue;
				const tc = threads.filter((t) => t.nodes.includes(o.id)).length;
				allEntities.push({
					id: o.id,
					type: "organization",
					name,
					details: o.type || "Organization",
					threadCount: tc,
				});
			}
		}

		return allEntities.sort((a, b) => b.threadCount - a.threadCount);
	}, [people, organizations, threads, searchQuery, entityFilter]);

	const focusEntity = useMemo(() => {
		if (!explorerFocusEntity) return null;
		const person = people.find((p) => p.id === explorerFocusEntity);
		if (person) {
			return {
				type: "person" as const,
				data: person,
				name: person.names?.[0] || `${person.firstName} ${person.lastName}`,
			};
		}
		const org = organizations.find((o) => o.id === explorerFocusEntity);
		if (org) {
			return {
				type: "organization" as const,
				data: org,
				name: org.names?.[0] || org.id,
			};
		}
		return null;
	}, [explorerFocusEntity, people, organizations]);

	const entityConnections = useMemo(() => {
		if (!explorerFocusEntity) return { contracts: 0, filings: 0, donations: 0, threads: 0 };
		return {
			contracts: contracts.filter((c) =>
				explorerFocusEntity.includes(c.vendorName.toLowerCase().replace(/[^a-z0-9]/g, "-")) ||
				explorerFocusEntity.includes(c.department.toLowerCase().replace(/[^a-z0-9]/g, "-")),
			).length,
			filings: filings.filter((f) =>
				explorerFocusEntity.includes(f.clientName.toLowerCase().replace(/[^a-z0-9]/g, "-")) ||
				(f.registrant.firmName && explorerFocusEntity.includes(f.registrant.firmName.toLowerCase().replace(/[^a-z0-9]/g, "-"))),
			).length,
			donations: donations.filter((d) =>
				explorerFocusEntity.includes(d.donorName.toLowerCase().replace(/[^a-z0-9]/g, "-")),
			).length,
			threads: threads.filter((t) => t.nodes.includes(explorerFocusEntity)).length,
		};
	}, [explorerFocusEntity, contracts, filings, donations, threads]);

	return (
		<div className="flex h-full overflow-hidden">
			{/* ── Left Sidebar: Entity List ───────────────────── */}
			<div className="w-72 border-r border-[var(--border)] bg-[var(--card)] flex flex-col overflow-hidden">
				<div className="p-3 border-b border-[var(--border)]">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-2">
						ENTITIES
					</h3>
					<div className="flex flex-wrap gap-1">
						{(["all", "person", "org"] as const).map((f) => (
							<button
								key={f}
								onClick={() => setEntityFilter(f)}
								className={`px-2 py-1 text-[10px] rounded transition-colors ${
									entityFilter === f
										? "bg-[var(--accent-dim)] text-[var(--accent)]"
										: "text-[var(--muted)] hover:text-[var(--foreground)]"
								}`}
							>
								{f === "all" ? "All" : f === "person" ? "People" : "Orgs"}
							</button>
						))}
					</div>
				</div>

				<div className="flex-1 overflow-auto">
					{filteredEntities.map((entity) => (
						<button
							key={entity.id}
							onClick={() => setExplorerFocusEntity(entity.id)}
							className={`w-full text-left px-3 py-2 border-b border-[var(--border)] transition-colors ${
								explorerFocusEntity === entity.id
									? "bg-[var(--accent-dim)] border-l-2 border-l-[var(--accent)]"
									: "hover:bg-[var(--card-hover)]"
							}`}
						>
							<div className="flex items-center gap-2">
								<span className="text-[10px]">
									{entity.type === "person" ? "👤" : "🏢"}
								</span>
								<span className="text-xs truncate flex-1">{entity.name}</span>
								{entity.threadCount > 0 && (
									<span className="text-[9px] px-1.5 rounded bg-[var(--signal-procurement)]20 text-[var(--signal-procurement)]">
										{entity.threadCount}
									</span>
								)}
							</div>
							<div className="text-[10px] text-[var(--muted)] ml-5">{entity.details}</div>
						</button>
					))}
				</div>
			</div>

			{/* ── Main Content ────────────────────────────────── */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Mode toggle */}
				<div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)]">
					<button
						onClick={() => setMode("graph")}
						className={`px-3 py-1 text-xs rounded transition-colors ${
							mode === "graph"
								? "bg-[var(--primary)] text-[var(--primary-foreground)]"
								: "text-[var(--muted)] hover:text-[var(--foreground)]"
						}`}
					>
						◈ Graph
					</button>
					<button
						onClick={() => setMode("chart")}
						className={`px-3 py-1 text-xs rounded transition-colors ${
							mode === "chart"
								? "bg-[var(--primary)] text-[var(--primary-foreground)]"
								: "text-[var(--muted)] hover:text-[var(--foreground)]"
						}`}
					>
						📊 Charts
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-auto p-4">
					{focusEntity ? (
						<EntityProfile
							entity={focusEntity}
							connections={entityConnections}
							threads={threads.filter((t) =>
								t.nodes.includes(explorerFocusEntity!),
							)}
						/>
					) : mode === "graph" ? (
						<ConnectionGraph threads={threads} people={people} organizations={organizations} />
					) : (
						<ChartDeepDives />
					)}
				</div>
			</div>
		</div>
	);
}

function EntityProfile({
	entity,
	connections,
	threads,
}: {
	entity: { type: string; data: Person | Organization; name: string };
	connections: { contracts: number; filings: number; donations: number; threads: number };
	threads: import("@civic-intel/core").IntelligenceThread[];
}) {
	return (
		<div>
			{/* Header */}
			<div className="flex items-start gap-4 mb-6">
				<div className="w-16 h-16 rounded-lg bg-[var(--accent-dim)] flex items-center justify-center text-2xl">
					{entity.type === "person" ? "👤" : "🏢"}
				</div>
				<div>
					<h2 className="text-xl font-bold">{entity.name}</h2>
					<div className="text-xs text-[var(--muted)]">
						{entity.type === "person" ? "Person" : (entity.data as Organization).type || "Organization"}
					</div>
				</div>
			</div>

			{/* Connection stats */}
			<div className="grid grid-cols-4 gap-3 mb-6">
				<MiniStat label="Contracts" value={connections.contracts} color="var(--signal-procurement)" />
				<MiniStat label="Lobbying" value={connections.filings} color="var(--signal-revolving)" />
				<MiniStat label="Donations" value={connections.donations} color="var(--signal-donation)" />
				<MiniStat label="Threads" value={connections.threads} color="var(--accent)" />
			</div>

			{/* Connected threads */}
			<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
				CONNECTED SIGNALS
			</h3>
			<div className="flex flex-col gap-2">
				{threads.map((t) => (
					<div
						key={t.id}
						className="card"
						style={{ borderLeft: `3px solid var(--signal-${t.signalType.split("_")[0]})` }}
					>
						<div className="text-xs font-semibold mb-1">{t.title}</div>
						<div className="text-[10px] text-[var(--muted)] line-clamp-2">
							{t.description}
						</div>
						<div className="flex items-center gap-2 mt-2">
							<span className="text-[9px] text-[var(--muted)]">
								{Math.round(t.confidence * 100)}% confidence
							</span>
							<div className="flex-1 h-px bg-[var(--border)]" />
							{t.sources.map((s, i) => (
								<span key={i} className="text-[9px] text-[var(--accent)]">
									{s}
								</span>
							))}
						</div>
					</div>
				))}
				{threads.length === 0 && (
					<div className="text-xs text-[var(--muted)] text-center py-4">
						No connected signals
					</div>
				)}
			</div>
		</div>
	);
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
	return (
		<div className="card text-center py-3">
			<div className="text-lg font-bold tabular-nums" style={{ color }}>
				{value}
			</div>
			<div className="text-[9px] text-[var(--muted)] tracking-widest">{label}</div>
		</div>
	);
}

function ConnectionGraph({
	threads,
	people,
	organizations,
}: {
	threads: import("@civic-intel/core").IntelligenceThread[];
	people: Person[];
	organizations: Organization[];
}) {
	// Build a simple force-directed-style visualization with SVG
	const nodes = useMemo(() => {
		const nodeMap = new Map<string, { id: string; label: string; type: string; x: number; y: number }>();
		const cx = 400;
		const cy = 300;

		// Place entities from threads in a circle
		const allEntities = new Set<string>();
		for (const t of threads) {
			for (const e of t.nodes) allEntities.add(e);
		}

		const entities = [...allEntities];
		const radius = Math.min(250, entities.length * 40);
		entities.forEach((id, i) => {
			const angle = (i / entities.length) * Math.PI * 2 - Math.PI / 2;
			const person = people.find((p) => p.id === id);
			const org = organizations.find((o) => o.id === id);
			const label = person?.names?.[0] || org?.names?.[0] || id.replace(/org-|person-/g, "").replace(/-/g, " ");
			const type = person ? "person" : org ? "org" : "unknown";
			nodeMap.set(id, {
				id,
				label,
				type,
				x: cx + radius * Math.cos(angle),
				y: cy + radius * Math.sin(angle),
			});
		});

		return [...nodeMap.values()];
	}, [threads, people, organizations]);

	const edges = useMemo(() => {
		const edgeSet: Array<{ from: string; to: string; type: string }> = [];
		for (const t of threads) {
			for (let i = 0; i < t.nodes.length; i++) {
				for (let j = i + 1; j < t.nodes.length; j++) {
					edgeSet.push({
						from: t.nodes[i],
						to: t.nodes[j],
						type: t.signalType,
					});
				}
			}
		}
		return edgeSet;
	}, [threads]);

	const nodeMap = useMemo(() => {
		const m = new Map<string, { x: number; y: number }>();
		for (const n of nodes) m.set(n.id, { x: n.x, y: n.y });
		return m;
	}, [nodes]);

	const typeColors: Record<string, string> = {
		person: "var(--signal-revolving)",
		org: "var(--primary)",
		unknown: "var(--muted)",
	};

	return (
		<div>
			<div className="text-xs text-[var(--muted)] mb-3 text-center">
				Click an entity in the sidebar to see its profile. Lines connect entities that appear in the same signal thread.
			</div>
			<svg
				viewBox="0 0 800 600"
				className="w-full max-h-[calc(100vh-280px)] bg-[var(--background)] border border-[var(--border)] rounded-lg"
			>
				{/* Edges */}
				{edges.map((e, i) => {
					const from = nodeMap.get(e.from);
					const to = nodeMap.get(e.to);
					if (!from || !to) return null;
					return (
						<line
							key={i}
							x1={from.x}
							y1={from.y}
							x2={to.x}
							y2={to.y}
							stroke="var(--border)"
							strokeWidth="1"
							opacity={0.5}
						/>
					);
				})}

				{/* Nodes */}
				{nodes.map((n) => (
					<g key={n.id}>
						<circle
							cx={n.x}
							cy={n.y}
							r={n.type === "person" ? 12 : 10}
							fill={typeColors[n.type]}
							opacity={0.8}
							className="cursor-pointer"
						/>
						<text
							x={n.x}
							y={n.y + 20}
							textAnchor="middle"
							fill="var(--muted)"
							fontSize="9"
							fontFamily="IBM Plex Mono"
						>
							{n.label.length > 20 ? n.label.slice(0, 18) + "…" : n.label}
						</text>
					</g>
				))}
			</svg>
		</div>
	);
}

function ChartDeepDives() {
	const { contracts, filings, donations } = useCivicStore();

	const spendingByDept = useMemo(() => {
		const byDept: Record<string, number> = {};
		for (const c of contracts) {
			byDept[c.department] = (byDept[c.department] || 0) + (typeof c.value === "number" ? c.value : 0);
		}
		return Object.entries(byDept).sort(([, a], [, b]) => b - a);
	}, [contracts]);

	const lobbyingByClient = useMemo(() => {
		const byClient: Record<string, number> = {};
		for (const f of filings) {
			byClient[f.clientName] = (byClient[f.clientName] || 0) + 1;
		}
		return Object.entries(byClient).sort(([, a], [, b]) => b - a);
	}, [filings]);

	return (
		<div className="grid grid-cols-2 gap-4">
			{/* Spending Treemap */}
			<div className="card">
				<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
					SPENDING BY DEPARTMENT
				</h3>
				<div className="flex flex-wrap gap-1">
					{spendingByDept.map(([dept, value]) => {
						const maxVal = spendingByDept[0]?.[1] ?? 1;
						const pct = value / maxVal;
						return (
							<div
								key={dept}
								className="rounded px-2 py-1 text-[10px] transition-all hover:scale-105 cursor-pointer"
								style={{
									background: 'rgba(59, 130, 246, ${Math.max(0.1, pct * 0.8)})',
									color: pct > 0.3 ? "white" : "var(--foreground)",
								}}
							>
								{dept.split(" ").slice(-2).join(" ")}
								<div className="text-[8px] opacity-60">${(value / 1_000_000).toFixed(1)}M</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Lobbying by Client */}
			<div className="card">
				<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
					LOBBYING BY CLIENT
				</h3>
				<div className="flex flex-col gap-2">
					{lobbyingByClient.map(([client, count]) => {
						const maxCount = lobbyingByClient[0]?.[1] ?? 1;
						const pct = (count / maxCount) * 100;
						return (
							<div key={client} className="flex items-center gap-2">
								<div className="w-28 text-xs truncate">{client}</div>
								<div className="flex-1 h-4 bg-[var(--background)] rounded overflow-hidden">
									<div
										className="h-full rounded"
										style={{
											width: pct + '%',
											background: "linear-gradient(90deg, var(--signal-revolving), var(--signal-sole-source))",
										}}
									/>
								</div>
								<div className="w-8 text-[10px] text-[var(--muted)] text-right tabular-nums">
									{count}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Donation amounts */}
			<div className="card">
				<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
					POLITICAL DONATIONS
				</h3>
				<div className="flex flex-col gap-1.5">
					{donations.map((d, i) => (
						<div key={i} className="flex justify-between items-center text-xs py-1 border-b border-[var(--border)]">
							<span className="truncate max-w-[160px]">{d.donorName}</span>
							<div className="flex items-center gap-2">
								<span className="text-[10px] text-[var(--muted)]">{d.recipientName}</span>
								<span className="text-[var(--signal-donation)] tabular-nums">
									${typeof d.amount === "number" ? d.amount.toLocaleString() : "—"}
								</span>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Contract types */}
			<div className="card">
				<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
					CONTRACT TYPES
				</h3>
				<div className="flex flex-col gap-2">
					{(() => {
						const types: Record<string, { count: number; value: number }> = {};
						for (const c of contracts) {
							const t = c.commodityType || "Unknown";
							types[t] = types[t] || { count: 0, value: 0 };
							types[t].count++;
							types[t].value += typeof c.value === "number" ? c.value : 0;
						}
						return Object.entries(types)
							.sort(([, a], [, b]) => b.value - a.value)
							.map(([type, data]) => (
								<div key={type} className="flex justify-between items-center text-xs">
									<span>{type}</span>
									<div className="flex items-center gap-3">
										<span className="text-[var(--muted)]">{data.count} contracts</span>
										<span className="text-[var(--signal-procurement)] tabular-nums">
											${(data.value / 1_000_000).toFixed(1)}M
										</span>
									</div>
								</div>
							));
					})()}
				</div>
			</div>
		</div>
	);
}
