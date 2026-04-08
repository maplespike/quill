"use client";

import { useSocialStore } from "../lib/social-store";
import { useState } from "react";
import type {
	Verification,
	Investigation,
	Annotation,
	AnalysisSession,
} from "@civic-intel/core";

type SocialTab = "verifications" | "annotations" | "investigations" | "community" | "sessions";

export function SocialView() {
	const [activeTab, setActiveTab] = useState<SocialTab>("verifications");

	return (
		<div className="max-w-5xl mx-auto p-4">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h2 className="text-lg font-bold">Community Intelligence</h2>
					<p className="text-xs text-[var(--muted)]">
						Collaborative verification, annotation, and investigation of government data
					</p>
				</div>
			</div>

			{/* Tab strip */}
			<div className="flex items-center gap-1 mb-6 border-b border-[var(--border)]">
				{([
					["verifications", "✓ Verifications"],
					["annotations", "📝 Annotations"],
					["investigations", "🔍 Investigations"],
					["community", "👥 Community"],
					["sessions", "📺 Watch Parties"],
				] as const).map(([id, label]) => (
					<button
						key={id}
						onClick={() => setActiveTab(id)}
						className={`px-4 py-2 text-xs font-semibold transition-colors ${
							activeTab === id ? "tab-active" : "tab-inactive"
						}`}
					>
						{label}
					</button>
				))}
			</div>

			{activeTab === "verifications" && <VerificationsTab />}
			{activeTab === "annotations" && <AnnotationsTab />}
			{activeTab === "investigations" && <InvestigationsTab />}
			{activeTab === "community" && <CommunityTab />}
			{activeTab === "sessions" && <SessionsTab />}
		</div>
	);
}

// ── Feature 18: Verifications ─────────────────────────────

function VerificationsTab() {
	const { verifications, addVerification, currentCitizen } = useSocialStore();
	const [showForm, setShowForm] = useState(false);

	return (
		<div>
			<div className="flex justify-between items-center mb-4">
				<span className="text-xs text-[var(--muted)]">
					{verifications.length} verifications from the community
				</span>
				<button
					onClick={() => setShowForm(!showForm)}
					className="px-3 py-1.5 text-xs rounded bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
				>
					+ Add Verification
				</button>
			</div>

			{showForm && (
				<VerificationForm
					onSubmit={(v) => {
						addVerification(v);
						setShowForm(false);
					}}
					citizenId={currentCitizen.id}
					citizenName={currentCitizen.name}
				/>
			)}

			<div className="flex flex-col gap-3">
				{verifications.map((v) => (
					<div key={v.id} className="card">
						<div className="flex items-start gap-3">
							<div
								className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold ${
									v.type === "verify"
										? "bg-[rgba(34,197,94,0.15)] text-[var(--success)]"
										: v.type === "challenge"
											? "bg-[rgba(239,68,68,0.15)] text-[var(--destructive)]"
											: "bg-[var(--accent-dim)] text-[var(--accent)]"
								}`}
							>
								{v.type === "verify" ? "✓" : v.type === "challenge" ? "✗" : "+"}
							</div>
							<div className="flex-1">
								<div className="flex items-center gap-2 mb-1">
									<span className="text-xs font-semibold">{v.citizenName}</span>
									<span
										className={`badge ${
											v.type === "verify"
												? "bg-[rgba(34,197,94,0.15)] text-[var(--success)]"
												: v.type === "challenge"
													? "bg-[rgba(239,68,68,0.15)] text-[var(--destructive)]"
													: "bg-[var(--accent-dim)] text-[var(--accent)]"
										}`}
									>
										{v.type.toUpperCase()}
									</span>
									<span className="text-[10px] text-[var(--muted)] ml-auto">
										{new Date(v.createdAt).toLocaleDateString()}
									</span>
								</div>
								<p className="text-xs text-[var(--foreground)] leading-relaxed mb-2">
									{v.description}
								</p>
								<div className="flex items-center gap-3">
									<a
										href={v.sourceUrl}
										className="text-[10px] text-[var(--primary)] hover:underline"
										target="_blank"
										rel="noopener"
									>
										📎 Primary Source
									</a>
									<span className="text-[10px] text-[var(--muted)]">
										Confidence: {Math.round(v.confidenceVote * 100)}%
									</span>
									<div className="flex-1" />
									<button className="text-[10px] text-[var(--success)]">
										▲ {v.upvotes}
									</button>
									<button className="text-[10px] text-[var(--destructive)]">
										▼ {v.downvotes}
									</button>
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function VerificationForm({
	onSubmit,
	citizenId,
	citizenName,
}: {
	onSubmit: (v: Verification) => void;
	citizenId: string;
	citizenName: string;
}) {
	const [type, setType] = useState<"verify" | "challenge" | "extend">("verify");
	const [sourceUrl, setSourceUrl] = useState("");
	const [description, setDescription] = useState("");

	return (
		<div className="card mb-4 animate-fade-in-up">
			<h4 className="text-xs font-semibold mb-3">Add Verification</h4>
			<div className="flex gap-2 mb-3">
				{(["verify", "challenge", "extend"] as const).map((t) => (
					<button
						key={t}
						onClick={() => setType(t)}
						className={`px-3 py-1 text-xs rounded ${
							type === t
								? "bg-[var(--primary)] text-white"
								: "border border-[var(--border)] text-[var(--muted)]"
						}`}
					>
						{t === "verify" ? "✓ Verify" : t === "challenge" ? "✗ Challenge" : "+ Extend"}
					</button>
				))}
			</div>
			<input
				type="url"
				placeholder="Primary source URL..."
				value={sourceUrl}
				onChange={(e) => setSourceUrl(e.target.value)}
				className="w-full px-3 py-2 text-xs bg-[var(--background)] border border-[var(--border)] rounded mb-2 focus:border-[var(--primary)] focus:outline-none"
			/>
			<textarea
				placeholder="Describe your verification..."
				value={description}
				onChange={(e) => setDescription(e.target.value)}
				className="w-full px-3 py-2 text-xs bg-[var(--background)] border border-[var(--border)] rounded mb-3 focus:border-[var(--primary)] focus:outline-none h-20 resize-none"
			/>
			<div className="flex gap-2">
				<button
					onClick={() => {
						onSubmit({
							id: "v-" + Date.now(),
							threadId: "",
							type,
							citizenId,
							citizenName,
							sourceUrl,
							description,
							confidenceVote: 0.8,
							createdAt: new Date().toISOString(),
							upvotes: 0,
							downvotes: 0,
						});
					}}
					className="px-4 py-1.5 text-xs rounded bg-[var(--primary)] text-white"
				>
					Submit
				</button>
			</div>
		</div>
	);
}

// ── Feature 20: Annotations ──────────────────────────────

function AnnotationsTab() {
	const { annotations, addAnnotation, currentCitizen } = useSocialStore();
	const [showForm, setShowForm] = useState(false);

	return (
		<div>
			<div className="flex justify-between items-center mb-4">
				<span className="text-xs text-[var(--muted)]">
					{annotations.length} community annotations
				</span>
				<button
					onClick={() => setShowForm(!showForm)}
					className="px-3 py-1.5 text-xs rounded bg-[var(--primary)] text-white"
				>
					+ Annotate
				</button>
			</div>

			{showForm && (
				<AnnotationForm
					onSubmit={(a) => {
						addAnnotation(a);
						setShowForm(false);
					}}
					citizenId={currentCitizen.id}
					citizenName={currentCitizen.name}
				/>
			)}

			<div className="flex flex-col gap-3">
				{annotations.map((a) => (
					<div key={a.id} className="card">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-xs font-semibold">{a.citizenName}</span>
							<span className="text-[10px] text-[var(--muted)]">
								on {a.entityId.replace(/org-|person-/g, "").replace(/-/g, " ")}
							</span>
							<span className="text-[10px] text-[var(--muted)] ml-auto">
								{new Date(a.createdAt).toLocaleDateString()}
							</span>
						</div>
						<p className="text-xs text-[var(--foreground)] leading-relaxed mb-2">
							{a.content}
						</p>
						<div className="flex items-center gap-3">
							<a
								href={a.sourceUrl}
								className="text-[10px] text-[var(--primary)] hover:underline"
								target="_blank"
								rel="noopener"
							>
								📎 Source
							</a>
							{a.tags.map((tag) => (
								<span
									key={tag}
									className="text-[9px] px-2 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)]"
								>
									{tag}
								</span>
							))}
							<div className="flex-1" />
							<button className="text-[10px] text-[var(--success)]">▲ {a.upvotes}</button>
							<button className="text-[10px] text-[var(--destructive)]">▼ {a.downvotes}</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function AnnotationForm({
	onSubmit,
	citizenId,
	citizenName,
}: {
	onSubmit: (a: Annotation) => void;
	citizenId: string;
	citizenName: string;
}) {
	const [entityId, setEntityId] = useState("");
	const [content, setContent] = useState("");
	const [sourceUrl, setSourceUrl] = useState("");
	const [tags, setTags] = useState("");

	return (
		<div className="card mb-4 animate-fade-in-up">
			<h4 className="text-xs font-semibold mb-3">Add Annotation</h4>
			<input
				placeholder="Entity (e.g. L3Harris Technologies)"
				value={entityId}
				onChange={(e) => setEntityId(e.target.value)}
				className="w-full px-3 py-2 text-xs bg-[var(--background)] border border-[var(--border)] rounded mb-2 focus:border-[var(--primary)] focus:outline-none"
			/>
			<textarea
				placeholder="Your annotation (must link to a primary source)..."
				value={content}
				onChange={(e) => setContent(e.target.value)}
				className="w-full px-3 py-2 text-xs bg-[var(--background)] border border-[var(--border)] rounded mb-2 focus:border-[var(--primary)] focus:outline-none h-20 resize-none"
			/>
			<input
				type="url"
				placeholder="Primary source URL..."
				value={sourceUrl}
				onChange={(e) => setSourceUrl(e.target.value)}
				className="w-full px-3 py-2 text-xs bg-[var(--background)] border border-[var(--border)] rounded mb-2 focus:border-[var(--primary)] focus:outline-none"
			/>
			<input
				placeholder="Tags (comma separated)"
				value={tags}
				onChange={(e) => setTags(e.target.value)}
				className="w-full px-3 py-2 text-xs bg-[var(--background)] border border-[var(--border)] rounded mb-3 focus:border-[var(--primary)] focus:outline-none"
			/>
			<button
				onClick={() => {
					onSubmit({
						id: "a-" + Date.now(),
						entityId: "org-" + entityId.toLowerCase().replace(/\s+/g, "-"),
						citizenId,
						citizenName,
						content,
						sourceUrl,
						tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
						createdAt: new Date().toISOString(),
						upvotes: 0,
						downvotes: 0,
						replies: [],
						parentId: null,
					});
				}}
				className="px-4 py-1.5 text-xs rounded bg-[var(--primary)] text-white"
			>
				Submit Annotation
			</button>
		</div>
	);
}

// ── Feature 19: Investigations ────────────────────────────

function InvestigationsTab() {
	const { investigations } = useSocialStore();

	return (
		<div>
			<div className="flex justify-between items-center mb-4">
				<span className="text-xs text-[var(--muted)]">
					{investigations.length} active investigations
				</span>
				<button className="px-3 py-1.5 text-xs rounded bg-[var(--primary)] text-white">
					+ New Investigation
				</button>
			</div>

			<div className="flex flex-col gap-4">
				{investigations.map((inv) => (
					<div key={inv.id} className="card">
						<div className="flex items-center gap-2 mb-2">
							<span
								className={`badge ${
									inv.status === "open"
										? "bg-[rgba(34,197,94,0.15)] text-[var(--success)]"
										: inv.status === "completed"
											? "bg-[var(--accent-dim)] text-[var(--accent)]"
											: "bg-[rgba(107,107,128,0.15)] text-[var(--muted)]"
								}`}
							>
								{inv.status.toUpperCase()}
							</span>
							<span className="badge bg-[var(--accent-dim)] text-[var(--accent)]">
								{inv.visibility}
							</span>
							<span className="text-[10px] text-[var(--muted)]">
								{inv.contributors.length} contributors
							</span>
						</div>
						<h4 className="text-sm font-semibold mb-1">{inv.title}</h4>
						<p className="text-xs text-[var(--muted)] leading-relaxed mb-3">
							{inv.description}
						</p>

						{/* Evidence */}
						<div className="mb-3">
							<span className="text-[10px] text-[var(--muted)] tracking-widest">
								EVIDENCE ({inv.evidence.length})
							</span>
							<div className="flex flex-col gap-1 mt-1">
								{inv.evidence.map((e) => (
									<div
										key={e.id}
										className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--background)] text-xs"
									>
										<span>📎</span>
										<span className="flex-1 truncate">{e.title}</span>
										<a
											href={e.sourceUrl}
											className="text-[var(--primary)] text-[10px]"
											target="_blank"
											rel="noopener"
										>
											source
										</a>
									</div>
								))}
							</div>
						</div>

						{/* Findings */}
						{inv.findings && (
							<div className="pt-2 border-t border-[var(--border)]">
								<span className="text-[10px] text-[var(--muted)] tracking-widest">
									FINDINGS
								</span>
								<p className="text-xs text-[var(--foreground)] mt-1 leading-relaxed">
									{inv.findings}
								</p>
							</div>
						)}

						{/* Tags */}
						<div className="flex flex-wrap gap-1 mt-3">
							{inv.tags.map((tag) => (
								<span
									key={tag}
									className="text-[9px] px-2 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)]"
								>
									{tag}
								</span>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

// ── Feature 22+23: Community & Reputation ─────────────────

function CommunityTab() {
	const { leaderboard, currentCitizen } = useSocialStore();

	return (
		<div>
			{/* Current user profile */}
			<div className="card mb-6">
				<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
					YOUR PROFILE
				</h3>
				<div className="flex items-start gap-4">
					<div className="w-12 h-12 rounded-lg bg-[var(--accent-dim)] flex items-center justify-center text-xl">
						👤
					</div>
					<div className="flex-1">
						<div className="flex items-center gap-2 mb-1">
							<span className="text-sm font-bold">{currentCitizen.name}</span>
							<span className="text-xs text-[var(--muted)]">{currentCitizen.handle}</span>
							<span
								className="badge bg-[rgba(34,197,94,0.15)] text-[var(--success)]"
							>
								{currentCitizen.trustLevel.toUpperCase()}
							</span>
						</div>
						<div className="flex items-center gap-4 text-xs text-[var(--muted)] mb-2">
							<span>Score: {currentCitizen.verificationScore}</span>
							<span>Contributions: {currentCitizen.contributions}</span>
						</div>
						<div className="flex flex-wrap gap-1 mb-2">
							{currentCitizen.domainTags.map((tag) => (
								<span
									key={tag}
									className="text-[9px] px-2 py-0.5 rounded bg-[var(--primary)]20 text-[var(--primary)]"
								>
									{tag}
								</span>
							))}
						</div>
						{/* Badges */}
						<div className="flex gap-2">
							{currentCitizen.badges.map((b) => (
								<div
									key={b.id}
									className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--background)] text-xs"
									title={b.description}
								>
									<span>{b.icon}</span>
									<span className="text-[10px]">{b.name}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Leaderboard */}
			<h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
				LEADERBOARD
			</h3>
			<div className="flex flex-col gap-2">
				{leaderboard
					.sort((a, b) => b.verificationScore - a.verificationScore)
					.map((citizen, i) => (
						<div key={citizen.id} className="card flex items-center gap-3">
							<div
								className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold ${
									i === 0
										? "bg-[rgba(245,158,11,0.2)] text-[var(--warning)]"
										: i === 1
											? "bg-[rgba(148,163,184,0.2)] text-[var(--muted)]"
											: "bg-[var(--background)] text-[var(--muted)]"
								}`}
							>
								#{i + 1}
							</div>
							<div className="flex-1">
								<div className="flex items-center gap-2">
									<span className="text-xs font-semibold">{citizen.name}</span>
									<span className="text-[10px] text-[var(--muted)]">{citizen.handle}</span>
								</div>
								<div className="flex gap-1 mt-0.5">
									{citizen.domainTags.slice(0, 2).map((tag) => (
										<span
											key={tag}
											className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)]"
										>
											{tag}
										</span>
									))}
								</div>
							</div>
							<div className="text-right">
								<div className="text-sm font-bold tabular-nums">{citizen.verificationScore}</div>
								<div className="text-[9px] text-[var(--muted)]">
									{citizen.contributions} contributions
								</div>
							</div>
						</div>
					))}
			</div>
		</div>
	);
}

// ── Feature 24: Watch Parties ─────────────────────────────

function SessionsTab() {
	const { sessions } = useSocialStore();

	return (
		<div>
			<div className="flex justify-between items-center mb-4">
				<span className="text-xs text-[var(--muted)]">
					{sessions.length} analysis sessions
				</span>
				<button className="px-3 py-1.5 text-xs rounded bg-[var(--primary)] text-white">
					+ Schedule Session
				</button>
			</div>

			<div className="flex flex-col gap-3">
				{sessions.map((s) => (
					<div key={s.id} className="card">
						<div className="flex items-center gap-2 mb-2">
							<span
								className={`badge ${
									s.status === "live"
										? "bg-[rgba(239,68,68,0.15)] text-[var(--destructive)] animate-pulse-live"
										: s.status === "scheduled"
											? "bg-[rgba(59,130,246,0.15)] text-[var(--primary)]"
											: "bg-[rgba(107,107,128,0.15)] text-[var(--muted)]"
								}`}
							>
								{s.status === "live" ? "● LIVE" : s.status === "scheduled" ? "○ SCHEDULED" : "✓ COMPLETED"}
							</span>
							{s.participants > 0 && (
								<span className="text-[10px] text-[var(--muted)]">
									{s.participants} participants
								</span>
							)}
						</div>
						<h4 className="text-sm font-semibold mb-1">{s.title}</h4>
						<p className="text-xs text-[var(--muted)] leading-relaxed mb-2">
							{s.description}
						</p>
						<div className="flex items-center gap-3 text-xs text-[var(--muted)]">
							<span>
								📅 {new Date(s.scheduledAt).toLocaleDateString("en-CA", {
									month: "short",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
							{s.status === "scheduled" && (
								<button className="px-3 py-1 text-[10px] rounded border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors">
									Join Session
								</button>
							)}
							{s.status === "completed" && s.recordingUrl && (
								<button className="px-3 py-1 text-[10px] rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
									▶ Watch Recording
								</button>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
