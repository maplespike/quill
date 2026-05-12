"use client";

import { useCivicStore } from "../lib/store";
import { useState } from "react";

interface LeaderboardEntry {
  rank: number;
  name: string;
  trust: "newcomer" | "contributor" | "analyst" | "expert";
  badges: string[];
  verifications: number;
  findings: number;
}

const TRUST_COLORS: Record<string, string> = {
  newcomer: "var(--muted)",
  contributor: "var(--primary)",
  analyst: "var(--accent)",
  expert: "var(--warning)",
};

const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    name: "OttawaWatch",
    trust: "expert",
    badges: ["🏛️ Parliament Hill", "🔍 Deep Diver", "📊 Data Maven"],
    verifications: 142,
    findings: 38,
  },
  {
    rank: 2,
    name: "CivicEngager_YOW",
    trust: "expert",
    badges: ["🏛️ Parliament Hill", "✓ Fact Checker"],
    verifications: 98,
    findings: 24,
  },
  {
    rank: 3,
    name: "TransparencyCA",
    trust: "analyst",
    badges: ["📋 Records Analyst", "🔗 Connection Maker"],
    verifications: 67,
    findings: 15,
  },
  {
    rank: 4,
    name: "DefenceWatch_CA",
    trust: "analyst",
    badges: ["⚔️ Defence Sector"],
    verifications: 54,
    findings: 12,
  },
  {
    rank: 5,
    name: "GAC_Monitor",
    trust: "contributor",
    badges: ["🌍 International Dev"],
    verifications: 31,
    findings: 8,
  },
  {
    rank: 6,
    name: "LobbyTracker",
    trust: "contributor",
    badges: ["🗳️ Elections Watch"],
    verifications: 28,
    findings: 5,
  },
  {
    rank: 7,
    name: "NewCitizen2026",
    trust: "newcomer",
    badges: [],
    verifications: 3,
    findings: 1,
  },
];

export function SocialView() {
  const { threads, contracts, filings, people } = useCivicStore();
  const [activeTab, setActiveTab] = useState<
    "leaderboard" | "investigations" | "annotations"
  >("leaderboard");

  return (
    <div className="flex h-full">
      {/* ── Left: Navigation ────────────────────────────── */}
      <div className="w-56 border-r border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-4">
          COMMUNITY
        </h3>
        <div className="flex flex-col gap-1">
          {(["leaderboard", "investigations", "annotations"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={
                  "text-left text-xs px-2 py-1.5 rounded transition-colors " +
                  (activeTab === tab
                    ? "bg-[var(--accent-dim)] text-[var(--primary)]"
                    : "text-[var(--muted)] hover:bg-[var(--card-hover)]")
                }
              >
                {tab === "leaderboard"
                  ? "🏆 "
                  : tab === "investigations"
                    ? "🔬 "
                    : "📝 "}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ),
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-2">
            COMMUNITY STATS
          </h3>
          <div className="text-xs text-[var(--muted)] space-y-1">
            <div>
              Active analysts:{" "}
              <span className="text-[var(--foreground)]">7</span>
            </div>
            <div>
              Verifications:{" "}
              <span className="text-[var(--foreground)]">423</span>
            </div>
            <div>
              Findings: <span className="text-[var(--foreground)]">103</span>
            </div>
            <div>
              Active threads:{" "}
              <span className="text-[var(--foreground)]">{threads.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "leaderboard" && (
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-[var(--muted)] mb-4">
              REPUTATION LEADERBOARD
            </h2>
            <div className="flex flex-col gap-3">
              {SEED_LEADERBOARD.map((entry) => (
                <div key={entry.rank} className="card flex items-center gap-4">
                  <div className="w-8 text-center">
                    <span
                      className={
                        "text-lg font-bold " +
                        (entry.rank <= 3
                          ? "text-[var(--primary)]"
                          : "text-[var(--muted)]")
                      }
                    >
                      {entry.rank}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {entry.name}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{
                          backgroundColor: TRUST_COLORS[entry.trust] + "20",
                          color: TRUST_COLORS[entry.trust],
                        }}
                      >
                        {entry.trust}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entry.badges.map((b, i) => (
                        <span
                          key={i}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--background)] text-[var(--muted)]"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-xs text-[var(--muted)]">
                    <div>
                      {entry.verifications}{" "}
                      <span className="text-[9px]">verifications</span>
                    </div>
                    <div>
                      {entry.findings}{" "}
                      <span className="text-[9px]">findings</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "investigations" && (
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-[var(--muted)] mb-4">
              ACTIVE INVESTIGATIONS
            </h2>
            <div className="flex flex-col gap-3">
              <InvestigationCard
                title="The L3Harris Triangle"
                status="active"
                contributors={3}
                findings={5}
                tags={["defence", "lobbying", "spousal-interest"]}
                description="Coordinated investigation into the convergence of procurement, lobbying, and ministerial spousal interests around L3Harris Technologies."
              />
              <InvestigationCard
                title="Defence Sole-Source Spending Trends"
                status="active"
                contributors={2}
                findings={3}
                tags={["sole-source", "defence", "mandate-divergence"]}
                description="Tracking the 40% year-over-year increase in sole-source defence contracts despite competitive bidding mandate."
              />
              <InvestigationCard
                title="Brookfield Political Connections"
                status="open"
                contributors={1}
                findings={1}
                tags={["donations", "real-estate", "ministerial-connection"]}
                description="Examining the relationship between Brookfield political donations and federal real property contracts."
              />
            </div>
          </div>
        )}

        {activeTab === "annotations" && (
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-[var(--muted)] mb-4">
              RECENT CITIZEN ANNOTATIONS
            </h2>
            <div className="flex flex-col gap-3">
              {[
                {
                  entity: "L3Harris Technologies",
                  author: "OttawaWatch",
                  note: "Note that L3Harris also appears in the 2024 supplementary estimates for an additional $12M in unspecified defence services. This was not captured in the CanadaBuys disclosure.",
                  votes: 14,
                  sources: 2,
                },
                {
                  entity: "Michael Chen",
                  author: "TransparencyCA",
                  note: "Chen's CIEC filing (2024-06-15) lists his Navigator LLP start date as April 15, 2024 — only 15 days after leaving DND. The standard cooling-off period for ADM-level officials is 2 years under the Conflict of Interest Act.",
                  votes: 28,
                  sources: 1,
                },
                {
                  entity: "Sarah Mitchell",
                  author: "CivicEngager_YOW",
                  note: "Minister Mitchell's public disclosure also lists a family trust holding defence sector ETFs. The trust was established before her appointment but the holdings were not divested.",
                  votes: 19,
                  sources: 1,
                },
                {
                  entity: "Lockheed Martin Canada",
                  author: "DefenceWatch_CA",
                  note: "The CF-35 maintenance contract was originally listed as competitive in the 2024 defence acquisition guide but was reclassified as sole-source in March 2025.",
                  votes: 11,
                  sources: 3,
                },
              ].map((a, i) => (
                <div key={i} className="card">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded">
                      {a.entity}
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">
                      — {a.author}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--foreground)] leading-relaxed">
                    {a.note}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--muted)]">
                    <span>▲ {a.votes}</span>
                    <span>{a.sources} sources cited</span>
                    <button className="text-[var(--primary)] hover:underline">
                      Reply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InvestigationCard({
  title,
  status,
  contributors,
  findings,
  tags,
  description,
}: {
  title: string;
  status: string;
  contributors: number;
  findings: number;
  tags: string[];
  description: string;
}) {
  return (
    <div
      className="card"
      style={{
        borderLeft:
          "3px solid " +
          (status === "active" ? "var(--primary)" : "var(--muted)"),
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold">{title}</span>
        <span
          className={
            "text-[9px] px-1.5 py-0.5 rounded uppercase " +
            (status === "active"
              ? "bg-[var(--primary)]/20 text-[var(--primary)]"
              : "bg-[var(--muted)]/20 text-[var(--muted)]")
          }
        >
          {status}
        </span>
      </div>
      <p className="text-xs text-[var(--muted)] mb-2">{description}</p>
      <div className="flex items-center gap-2">
        {tags.map((t) => (
          <span
            key={t}
            className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--background)] text-[var(--muted)]"
          >
            {t}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-[var(--muted)]">
          {contributors} contributors • {findings} findings
        </span>
      </div>
    </div>
  );
}
