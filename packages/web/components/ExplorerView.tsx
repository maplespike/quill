"use client";

import { useCivicStore } from "../lib/store";
import { useState, useMemo } from "react";
import { graphNodes, graphEdges, timelineEvents, type GraphNode, type GraphEdge } from "../lib/data";

const NODE_COLORS: Record<string, string> = {
	person: "#3b82f6",
	org: "#10b981",
	department: "#f59e0b",
};

const EDGE_COLORS: Record<string, string> = {
	contract: "#ef4444",
	lobbying: "#8b5cf6",
	donation: "#f97316",
	spousal: "#ec4899",
	employment: "#06b6d4",
	board: "#14b8a6",
};

export function ExplorerView() {
	const {
		people, organizations, contracts, filings, threads,
		explorerFocusEntity, setExplorerFocusEntity,
	} = useCivicStore();

	const [hoveredNode, setHoveredNode] = useState<string | null>(null);
	const [selectedTab, setSelectedTab] = useState<"graph" | "contracts" | "entities">("graph");

	// Get connected edges for hovered node
	const highlightedEdges = useMemo(() => {
		if (!hoveredNode) return new Set<string>();
		const set = new Set<string>();
		graphEdges.forEach((e, i) => {
			if (e.from === hoveredNode || e.to === hoveredNode) set.add("edge-" + i);
		});
		return set;
	}, [hoveredNode]);

	// Contracts analysis
	const contractAnalysis = useMemo(() => {
		const byDept = contracts.reduce<Record<string, { value: number; count: number; soleSource: number }>>((acc, c) => {
			if (!acc[c.department]) acc[c.department] = { value: 0, count: 0, soleSource: 0 };
			acc[c.department].value += c.value;
			acc[c.department].count++;
			if (c.isSoleSource) acc[c.department].soleSource += c.value;
			return acc;
		}, {});
		return Object.entries(byDept).sort(([, a], [, b]) => b.value - a.value);
	}, [contracts]);

	const entity = explorerFocusEntity
		? [...people.map(p => ({ ...p, kind: "person" as const })), ...organizations.map(o => ({ ...o, kind: "org" as const }))]
			.find(e => e.id === explorerFocusEntity)
		: null;

	const entityThreads = entity
		? threads.filter(t => t.nodes.includes(entity.id))
		: [];

	return (
		<div className="flex h-full">
			{/* ── Entity Sidebar ──────────────────────────────── */}
			<div className="w-64 border-r border-[var(--border)] bg-[var(--card)] flex flex-col overflow-hidden">
				<div className="p-3 border-b border-[var(--border)]">
					<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)]">ENTITIES</h3>
				</div>
				<div className="flex-1 overflow-auto">
					{/* People */}
					<div className="px-3 pt-3 pb-1 text-[10px] text-[var(--muted)] tracking-widest">PEOPLE ({people.length})</div>
					{people.map((p) => (
						<button
							key={p.id}
							onClick={() => setExplorerFocusEntity(explorerFocusEntity === p.id ? null : p.id)}
							className={"w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--card-hover)] transition-colors flex items-center gap-2 " + (explorerFocusEntity === p.id ? "bg-[var(--accent-dim)] text-[var(--primary)]" : "")}
						>
							<div className="w-5 h-5 rounded-full bg-[#3b82f6]/20 flex items-center justify-center text-[8px] text-[#3b82f6] font-bold flex-shrink-0">
								{p.firstName[0]}{p.lastName[0]}
							</div>
							<div className="min-w-0">
								<div className="truncate">{p.firstName} {p.lastName}</div>
								<div className="text-[9px] text-[var(--muted)] truncate">{p.roles[0]?.title}</div>
							</div>
						</button>
					))}

					{/* Organizations */}
					<div className="px-3 pt-3 pb-1 text-[10px] text-[var(--muted)] tracking-widest">ORGANIZATIONS ({organizations.length})</div>
					{organizations.map((o) => (
						<button
							key={o.id}
							onClick={() => setExplorerFocusEntity(explorerFocusEntity === o.id ? null : o.id)}
							className={"w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--card-hover)] transition-colors flex items-center gap-2 " + (explorerFocusEntity === o.id ? "bg-[var(--accent-dim)] text-[var(--primary)]" : "")}
						>
							<div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: o.type === "government_agency" ? "#f59e0b" : o.type === "lobbying_firm" ? "#8b5cf6" : "#10b981" }} />
							<div className="min-w-0">
								<div className="truncate">{o.names[0]}</div>
								<div className="text-[9px] text-[var(--muted)] truncate">{o.industry}</div>
							</div>
						</button>
					))}
				</div>
			</div>

			{/* ── Main Content ────────────────────────────────── */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Tab bar */}
				<div className="flex items-center gap-0 px-4 border-b border-[var(--border)] bg-[var(--card)]">
					{(["graph", "contracts", "entities"] as const).map(tab => (
						<button
							key={tab}
							onClick={() => setSelectedTab(tab)}
							className={"px-4 py-2 text-xs font-semibold tracking-widest transition-colors " + (selectedTab === tab ? "text-[var(--primary)] border-b-2 border-[var(--primary)]" : "text-[var(--muted)]")}
						>
							{tab.toUpperCase()}
						</button>
					))}
				</div>

				<div className="flex-1 overflow-auto">
					{selectedTab === "graph" && (
						<div className="flex h-full">
							{/* SVG Connection Graph */}
							<div className="flex-1 p-4">
								<svg viewBox="0 0 660 400" className="w-full h-full max-h-[calc(100vh-180px)]" style={{ minWidth: 600 }}>
									{/* Defs for edge gradients */}
									<defs>
										{Object.entries({ contract: "#ef4444", lobbying: "#8b5cf6", donation: "#f97316", spousal: "#ec4899", employment: "#06b6d4", board: "#14b8a6" }).map(([type, color]) => (
											<marker key={type} id={"arrow-" + type} viewBox="0 0 10 10" refX="20" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
												<path d="M 0 0 L 10 5 L 0 10 z" fill={color} fillOpacity={0.6} />
											</marker>
										))}
									</defs>

									{/* Edges */}
									{graphEdges.map((edge, i) => {
										const from = graphNodes.find(n => n.id === edge.from);
										const to = graphNodes.find(n => n.id === edge.to);
										if (!from || !to) return null;
										const highlighted = highlightedEdges.has("edge-" + i) || hoveredNode === null;
										// Curve control point: offset perpendicular to the line
										const dx = to.x - from.x;
										const dy = to.y - from.y;
										const mx = (from.x + to.x) / 2;
										const my = (from.y + to.y) / 2;
										const offset = (i % 2 === 0 ? 15 : -15);
										const cx = mx + (-dy / Math.sqrt(dx * dx + dy * dy + 1)) * offset;
										const cy = my + (dx / Math.sqrt(dx * dx + dy * dy + 1)) * offset;
										return (
											<g key={"edge-" + i}>
												<path
													d={"M " + from.x + " " + from.y + " Q " + cx + " " + cy + " " + to.x + " " + to.y}
													fill="none"
													stroke={EDGE_COLORS[edge.type]}
													strokeWidth={highlighted ? 2 : 1}
													strokeDasharray={edge.type === "spousal" ? "4 4" : undefined}
													opacity={highlighted ? 0.6 : 0.12}
													markerEnd={"url(#arrow-" + edge.type + ")"}
													className="transition-all duration-300"
												/>
												{/* Edge label */}
												<text
													x={cx}
													y={cy - 4}
													fill={EDGE_COLORS[edge.type]}
													fontSize="6.5"
													textAnchor="middle"
													opacity={highlighted ? 0.8 : 0.15}
													className="transition-all duration-300 pointer-events-none"
													fontWeight={highlighted ? "bold" : "normal"}
												>
													{edge.label}
												</text>
											</g>
										);
									})}

									{/* Nodes */}
									{graphNodes.map((node) => {
										const isConnected = !hoveredNode || hoveredNode === node.id ||
											graphEdges.some(e => (e.from === hoveredNode && e.to === node.id) || (e.to === hoveredNode && e.from === node.id));
										const isFocused = explorerFocusEntity === node.id;
										return (
											<g
												key={node.id}
												className="cursor-pointer transition-all duration-300"
												opacity={isConnected ? 1 : 0.15}
												onMouseEnter={() => setHoveredNode(node.id)}
												onMouseLeave={() => setHoveredNode(null)}
												onClick={() => setExplorerFocusEntity(explorerFocusEntity === node.id ? null : node.id)}
											>
												{/* Outer glow */}
												{isFocused && (
													<circle cx={node.x} cy={node.y} r={24} fill={NODE_COLORS[node.type]} opacity={0.1} />
												)}
												{/* Background circle */}
												<circle
													cx={node.x} cy={node.y}
													r={isFocused ? 20 : 14}
													fill={NODE_COLORS[node.type]}
													opacity={isConnected ? 0.2 : 0.05}
													className="transition-all duration-300"
												/>
												{/* Main circle */}
												<circle
													cx={node.x} cy={node.y}
													r={isFocused ? 16 : 10}
													fill="var(--card)"
													stroke={NODE_COLORS[node.type]}
													strokeWidth={isFocused ? 2.5 : 1.5}
													className="transition-all duration-300"
												/>
												{/* Type icon */}
												<text
													x={node.x} y={node.y + 3.5}
													textAnchor="middle"
													fontSize="9"
													fill={NODE_COLORS[node.type]}
													className="pointer-events-none"
												>
													{node.type === "person" ? "●" : node.type === "department" ? "■" : "◆"}
												</text>
												{/* Label */}
												<text
													x={node.x} y={node.y + (node.y < 200 ? -18 : 22)}
													fill="var(--foreground)"
													fontSize="7.5"
													fontWeight={isFocused || (hoveredNode === node.id) ? "bold" : "normal"}
													textAnchor="middle"
													className="transition-all duration-300 pointer-events-none"
												>
													{node.label.length > 20 ? node.label.slice(0, 18) + "…" : node.label}
												</text>
											</g>
										);
									})}

									{/* Legend */}
									<g transform="translate(10, 370)">
										{["person", "org", "department"].map((type, i) => (
											<g key={type} transform={"translate(" + (i * 120) + ", 0)"}>
												<circle cx={0} cy={0} r={4} fill={NODE_COLORS[type]} />
												<text x={8} y={3.5} fill="var(--muted)" fontSize="7" textAnchor="start">
													{type === "person" ? "Person" : type === "org" ? "Organization" : "Department"}
												</text>
											</g>
										))}
									</g>
								</svg>
							</div>

							{/* Entity Detail Panel */}
							{entity && (
								<div className="w-80 border-l border-[var(--border)] bg-[var(--card)] p-4 overflow-auto">
									<div className="flex items-center gap-2 mb-4">
										<div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: (NODE_COLORS[entity.kind === "person" ? "person" : "org"] || "#10b981") + "20", color: NODE_COLORS[entity.kind === "person" ? "person" : "org"] || "#10b981" }}>
											{entity.kind === "person" ? (entity as typeof people[0]).firstName[0] + (entity as typeof people[0]).lastName[0] : "◆"}
										</div>
										<div>
											<div className="text-sm font-bold">{entity.kind === "person" ? (entity as typeof people[0]).firstName + " " + (entity as typeof people[0]).lastName : (entity as typeof organizations[0]).names[0]}</div>
											<div className="text-[10px] text-[var(--muted)]">
												{entity.kind === "person" ? (entity as typeof people[0]).roles[0]?.title : (entity as typeof organizations[0]).industry}
											</div>
										</div>
									</div>

									{/* Connected threads */}
									{entityThreads.length > 0 && (
										<div className="mb-4">
											<div className="text-[10px] text-[var(--muted)] tracking-widest mb-2">INVOLVED IN {entityThreads.length} SIGNALS</div>
											{entityThreads.map(t => (
												<div key={t.id} className="card mb-2 text-xs" style={{ borderLeft: "3px solid var(--primary)" }}>
													<div className="text-[10px] text-[var(--muted)]">{t.signalType.replace(/_/g, " ").toUpperCase()}</div>
													<div className="font-semibold">{t.title}</div>
													<div className="text-[var(--muted)] mt-1 line-clamp-2">{t.summary}</div>
												</div>
											))}
										</div>
									)}

									{/* Timeline events for this entity */}
									{entity && (() => {
										const events = timelineEvents
											.filter(e => e.entityIds.includes(entity.id))
											.sort((a, b) => b.date.localeCompare(a.date));
										if (events.length === 0) return null;
										return (
											<div className="mb-4">
												<div className="text-[10px] text-[var(--muted)] tracking-widest mb-2">EVENTS ({events.length})</div>
												<div className="flex flex-col gap-1 max-h-40 overflow-auto">
													{events.slice(0, 10).map((evt, i) => (
														<div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-[var(--border)] last:border-0">
															<span className="text-[9px] text-[var(--muted)] tabular-nums whitespace-nowrap pt-0.5">{evt.date}</span>
															<span className="text-[var(--foreground)] leading-relaxed">{evt.title}</span>
														</div>
													))}
												</div>
											</div>
										);
									})()}

									{/* Connections */}
									<div>
										<div className="text-[10px] text-[var(--muted)] tracking-widest mb-2">CONNECTIONS</div>
										{graphEdges
											.filter(e => e.from === entity.id || e.to === entity.id)
											.map((e, i) => {
												const otherId = e.from === entity.id ? e.to : e.from;
												const otherNode = graphNodes.find(n => n.id === otherId);
												return (
													<div key={i} className="flex items-center gap-2 text-xs py-1">
														<div className="w-2 h-2 rounded-full" style={{ backgroundColor: EDGE_COLORS[e.type] }} />
														<span className="text-[var(--muted)]">{e.label}</span>
														<span className="font-semibold">{otherNode?.label}</span>
													</div>
												);
											})}
									</div>
								</div>
							)}
						</div>
					)}

					{selectedTab === "contracts" && (
						<div className="p-4">
							{/* Department breakdown */}
							<div className="card mb-4">
								<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">SPENDING BY DEPARTMENT</h3>
								<div className="flex flex-col gap-2">
									{contractAnalysis.map(([dept, data]) => (
										<div key={dept} className="flex items-center gap-3">
											<div className="w-48 text-xs truncate">{dept}</div>
											<div className="flex-1 h-6 bg-[var(--background)] rounded overflow-hidden relative">
												<div
													className="h-full rounded"
													style={{
														width: (data.value / (contractAnalysis[0]?.[1].value || 1) * 100) + "%",
														background: "linear-gradient(90deg, var(--primary), var(--accent))",
													}}
												/>
												<span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--foreground)] font-mono">
													${(data.value / 1_000_000).toFixed(1)}M
												</span>
											</div>
											<div className="text-[10px] text-[var(--muted)] w-20 text-right">
												{data.count} contracts
												{data.soleSource > 0 && <span className="text-[var(--destructive)]"> ({(data.soleSource / data.value * 100).toFixed(0)}% sole)</span>}
											</div>
										</div>
									))}
								</div>
							</div>

							{/* Contract table */}
							<div className="card">
								<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">ALL CONTRACTS</h3>
								<table className="w-full text-xs">
									<thead>
										<tr className="text-[var(--muted)] border-b border-[var(--border)]">
											<th className="text-left py-2 font-normal">Vendor</th>
											<th className="text-left py-2 font-normal">Department</th>
											<th className="text-left py-2 font-normal">Title</th>
											<th className="text-right py-2 font-normal">Value</th>
											<th className="text-center py-2 font-normal">Type</th>
										</tr>
									</thead>
									<tbody>
										{contracts.sort((a, b) => b.value - a.value).map(c => (
											<tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--card-hover)] transition-colors">
												<td className="py-2">{c.vendorName.replace(" Technologies Canada", "").replace(" Asset Management", "")}</td>
												<td className="py-2 text-[var(--muted)]">{c.department.replace("Department of ", "")}</td>
												<td className="py-2 max-w-[200px] truncate">{c.title}</td>
												<td className="py-2 text-right font-mono">${(c.value / 1_000_000).toFixed(1)}M</td>
												<td className="py-2 text-center">
													{c.isSoleSource
														? <span className="text-[var(--destructive)] bg-[var(--destructive)]/10 px-1.5 py-0.5 rounded text-[9px]">SOLE-SOURCE</span>
														: <span className="text-[var(--success)] bg-[var(--success)]/10 px-1.5 py-0.5 rounded text-[9px]">COMPETITIVE</span>}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{selectedTab === "entities" && (
						<div className="p-4 grid grid-cols-2 gap-4">
							{/* People */}
							<div className="card">
								<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">PEOPLE ({people.length})</h3>
								{people.map(p => (
									<div key={p.id} className="mb-3 p-2 rounded bg-[var(--background)]">
										<div className="font-semibold text-xs">{p.firstName} {p.lastName}</div>
										{p.roles.map((r, i) => (
											<div key={i} className="text-[10px] text-[var(--muted)] mt-0.5">
												{r.title} @ {r.organization} {r.endDate ? "(" + r.startDate + " → " + r.endDate + ")" : "(current)"}
											</div>
										))}
										<div className="text-[9px] text-[var(--muted)] mt-1">{p.city}, {p.province}</div>
									</div>
								))}
							</div>
							{/* Organizations */}
							<div className="card">
								<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">ORGANIZATIONS ({organizations.length})</h3>
								{organizations.map(o => (
									<div key={o.id} className="mb-3 p-2 rounded bg-[var(--background)]">
										<div className="font-semibold text-xs flex items-center gap-2">
											<div className="w-2 h-2 rounded-full" style={{ backgroundColor: o.type === "government_agency" ? "#f59e0b" : o.type === "lobbying_firm" ? "#8b5cf6" : "#10b981" }} />
											{o.names[0]}
										</div>
										<div className="text-[10px] text-[var(--muted)] mt-0.5">{o.type.replace(/_/g, " ")} • {o.industry}</div>
										<div className="text-[9px] text-[var(--muted)]">{o.city}, {o.province}</div>
										<div className="text-[9px] text-[var(--muted)] mt-1">Also known as: {o.names.slice(1).join(", ")}</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
