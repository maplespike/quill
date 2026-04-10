"use client";

/**
 * BriefView — Magazine-style intelligence brief.
 *
 * This is the pretext showcase view:
 * - Adaptive headline that auto-sizes to fill width
 * - Multi-column editorial with cursor handoff
 * - Drop cap on first paragraph
 * - Pull quotes as visual obstacles
 * - Inline entity chips (rich-inline)
 * - Shrinkwrapped signal cards
 * - DOM-free text measurement throughout
 */

import {
  AdaptiveHeadline,
  type CivicRichItem,
  MultiColumnFlow,
  RichInlineText,
} from "@civic-intel/pretext-civic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCivicStore } from "../lib/store";

// ─── Signal Config ──────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────

/** Resolve CSS var to actual color for inline styles */
function resolveColor(cssVar: string): string {
  if (typeof window === "undefined") return cssVar;
  if (cssVar.startsWith("var(")) {
    const name = cssVar.slice(4, -1);
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim() || cssVar
    );
  }
  return cssVar;
}

// ─── CSS keyframes (injected once) ─────────────────────

const STYLE_ID = "brief-view-styles";
function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
		@keyframes brief-fade-up {
			from { opacity: 0; transform: translateY(16px); }
			to { opacity: 1; transform: translateY(0); }
		}
		@keyframes brief-fade-in {
			from { opacity: 0; }
			to { opacity: 1; }
		}
		@keyframes brief-slide-in {
			from { opacity: 0; transform: translateX(-8px); }
			to { opacity: 1; transform: translateX(0); }
		}
		@keyframes brief-expand {
			from { opacity: 0; max-height: 0; }
			to { opacity: 1; max-height: 400px; }
		}
		@keyframes brief-pulse-dot {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.4; }
		}
		.brief-animate-up {
			animation: brief-fade-up 0.5s ease-out both;
		}
		.brief-animate-in {
			animation: brief-fade-in 0.6s ease-out both;
		}
		.brief-animate-slide {
			animation: brief-slide-in 0.4s ease-out both;
		}
		.brief-animate-expand {
			animation: brief-expand 0.25s ease-out both;
		}
		.brief-pulse {
			animation: brief-pulse-dot 2s ease-in-out infinite;
		}
	`;
  document.head.appendChild(style);
}

// ─── Intersection Observer Hook ─────────────────────────

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("brief-animate-up");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return ref;
}

// ─── Brief Section with Pretext ─────────────────────────

function BriefSection({
  section,
  index,
  containerWidth,
}: {
  section: { title: string; content: string; signalTypes?: string[] };
  index: number;
  containerWidth: number;
}) {
  const revealRef = useScrollReveal();
  const isWide = containerWidth > 640;
  const bodyFont = "15px 'Space Grotesk', system-ui, sans-serif";
  const lineHeight = 26;

  return (
    <div ref={revealRef} className="brief-section" style={{ opacity: 0 }}>
      {/* Section title */}
      <div className="flex items-center gap-3 mb-5">
        {section.signalTypes?.length ? (
          <span className="w-2 h-2 rounded-full bg-[var(--destructive)] brief-pulse" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-[var(--border)]" />
        )}
        <span
          className="text-xs font-bold tracking-[0.2em]"
          style={{
            color: section.signalTypes?.length
              ? "var(--destructive)"
              : "var(--muted)",
          }}
        >
          {section.title.toUpperCase()}
        </span>
        {section.signalTypes?.map((st, j) => (
          <span
            key={j}
            className="text-[9px] px-2 py-0.5 rounded-full border whitespace-nowrap"
            style={{
              borderColor: SIGNAL_COLORS[st],
              color: SIGNAL_COLORS[st],
              backgroundColor: `color-mix(in srgb, ${SIGNAL_COLORS[st]} 10%, transparent)`,
            }}
          >
            {SIGNAL_ICONS[st]} {SIGNAL_LABELS[st]}
          </span>
        ))}
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-[10px] text-[var(--muted)] tabular-nums">
          {index + 1}
        </span>
      </div>

      {/* Multi-column body text */}
      {typeof window !== "undefined" && containerWidth > 100 ? (
        <MultiColumnFlow
          text={section.content}
          font={bodyFont}
          lineHeight={lineHeight}
          width={containerWidth}
          columns={isWide ? 2 : 1}
          gap={40}
          padding={0}
          color="var(--card-foreground)"
          animate={false}
          dropCap={index === 0}
          dropCapFontFamily="'Georgia', serif"
        />
      ) : (
        <div
          className="text-sm leading-relaxed text-[var(--card-foreground)]"
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            lineHeight: 1.8,
          }}
        >
          {section.content}
        </div>
      )}

      {/* Pull quote for signal sections */}
      {section.signalTypes?.length && isWide ? (
        <div
          className="mt-6 mb-2 pl-5 border-l-2 brief-animate-slide"
          style={{
            borderColor: SIGNAL_COLORS[section.signalTypes[0]],
            opacity: 0.6,
          }}
        >
          <span
            style={{
              font: "italic 14px Georgia, serif",
              color: "var(--muted)",
              lineHeight: 1.7,
            }}
          >
            {section.content.split(".")[0]}.
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ─── Signal Card with Rich Inline ───────────────────────

function SignalCard({
  thread,
  isExpanded,
  onToggle,
  containerWidth,
}: {
  thread: {
    id: string;
    signalType: string;
    title: string;
    summary: string;
    confidence: number;
    nodes: string[];
    sources: string[];
  };
  isExpanded: boolean;
  onToggle: () => void;
  containerWidth: number;
}) {
  const color = SIGNAL_COLORS[thread.signalType] || "var(--primary)";
  const resolved = resolveColor(color);

  const richItems: CivicRichItem[] = [
    {
      text:
        thread.summary.length > 150 && !isExpanded
          ? `${thread.summary.slice(0, 150)}…`
          : thread.summary,
      font: "13px 'Space Grotesk', sans-serif",
    },
  ];

  return (
    <div
      className="card cursor-pointer transition-colors hover:bg-[var(--card-hover)]"
      style={{ borderLeft: `3px solid ${color}` }}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <div className="text-lg mt-0.5">
          {SIGNAL_ICONS[thread.signalType] || "◉"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="badge whitespace-nowrap"
              style={{
                background: `${resolved}20`,
                color: resolved,
              }}
            >
              {SIGNAL_LABELS[thread.signalType]}
            </span>
            <span
              className="text-[10px] tabular-nums"
              style={{ color: resolved }}
            >
              {Math.round(thread.confidence * 100)}% confidence
            </span>
          </div>
          <h4 className="text-sm font-semibold mb-1">{thread.title}</h4>

          {/* Rich inline summary */}
          {typeof window !== "undefined" && containerWidth > 100 ? (
            <RichInlineText
              items={richItems}
              maxWidth={containerWidth - 120}
              lineHeight={20}
              lineGap={2}
              animate={false}
              style={{ color: "var(--muted)" }}
            />
          ) : (
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {richItems.map((i) => i.text).join("")}
            </p>
          )}

          {/* Expanded details */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-[var(--border)] brief-animate-expand">
              <div className="mb-2">
                <span className="text-[10px] text-[var(--muted)] tracking-[0.15em]">
                  ENTITIES
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {thread.nodes.map((e) => (
                    <span key={e} className="intel-chip">
                      {e.replace(/org-|person-/g, "").replace(/-/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-[var(--muted)] tracking-[0.15em]">
                  SOURCES
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
        <div className="text-[var(--muted)] text-xs flex-shrink-0">
          {isExpanded ? "▼" : "▶"}
        </div>
      </div>
    </div>
  );
}

// ─── Main View ──────────────────────────────────────────

export function BriefView() {
  const { brief, threads } = useCivicStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Inject CSS animations once
  useEffect(() => {
    injectStyles();
  }, []);

  // Measure container width for pretext layout
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(
          entry.contentRect.width -
            (entry.contentRect.width < 500
              ? 8
              : entry.contentRect.width < 768
                ? 16
                : 24),
        );
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Track active section on scroll
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    const handler = () => {
      let found = 0;
      for (const [i, el] of sectionRefs.current.entries()) {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.5) {
          found = i;
        }
      }
      setActiveSection(found);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollToSection = useCallback((i: number) => {
    const el = sectionRefs.current.get(i);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  if (!brief) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--muted)]">
        No brief available.
      </div>
    );
  }

  const avgConfidence =
    threads.reduce((s, t) => s + t.confidence, 0) / threads.length;
  const confidenceColor =
    avgConfidence > 0.7
      ? "var(--destructive)"
      : avgConfidence > 0.4
        ? "var(--warning)"
        : "var(--success)";

  return (
    <div ref={containerRef} className="max-w-3xl mx-auto px-6 py-12 relative">
      {/* ── Masthead ─────────────────────────────────────── */}
      <div className="mb-16 brief-animate-in">
        {/* Date line */}
        <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] mb-6 tracking-[0.25em]">
          <div className="w-8 h-px bg-[var(--border)]" />
          DAILY INTELLIGENCE BRIEF
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="tabular-nums tracking-normal">
            {new Date().toLocaleDateString("en-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>

        {/* Adaptive headline — the signature pretext moment */}
        {typeof window !== "undefined" && containerWidth > 100 ? (
          <AdaptiveHeadline
            text={brief.title.toUpperCase()}
            fontFamily="'Space Grotesk', system-ui, sans-serif"
            maxWidth={containerWidth}
            maxHeight={containerWidth < 400 ? 80 : 120}
            maxSize={containerWidth < 400 ? 36 : containerWidth < 600 ? 48 : 64}
            weight={700}
            color="var(--foreground)"
            glowColor="rgba(59, 130, 246, 0.08)"
            className="mb-6"
            animate={true}
          />
        ) : (
          <h1
            className="text-2xl font-bold mb-6"
            style={{
              fontFamily: "Space Grotesk, sans-serif",
            }}
          >
            {brief.title}
          </h1>
        )}

        {/* Confidence gauge + summary */}
        <div className="flex items-center gap-6 mb-6">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="var(--border)"
                strokeWidth="5"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={confidenceColor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${avgConfidence * 251.3} 251.3`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base sm:text-lg font-bold tabular-nums">
                {Math.round(avgConfidence * 100)}
              </span>
              <span className="text-[6px] sm:text-[7px] text-[var(--muted)] tracking-widest">
                SCORE
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--muted)] mb-1">
              {threads.length} signals •{brief.entityIds.length} entities
            </p>
            <p className="text-sm text-[var(--card-foreground)] leading-relaxed">
              {brief.summary}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-[9px] text-[var(--muted)] tracking-[0.3em]">
            ◆
          </span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>
      </div>

      {/* ── Brief Sections (Multi-column editorial) ──────── */}
      {brief.sections.map((section, i) => (
        <div
          key={i}
          ref={(el) => {
            if (el) sectionRefs.current.set(i, el);
          }}
          className="mb-12"
        >
          <BriefSection
            section={section}
            index={i}
            containerWidth={containerWidth}
          />
        </div>
      ))}

      {/* ── Signal Deep Dives ────────────────────────────── */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs font-bold tracking-[0.2em] text-[var(--accent)]">
            ◆ SIGNAL ANALYSIS
          </span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        <div className="flex flex-col gap-3">
          {threads.map((thread) => (
            <SignalCard
              key={thread.id}
              thread={thread}
              isExpanded={expandedThread === thread.id}
              onToggle={() =>
                setExpandedThread(
                  expandedThread === thread.id ? null : thread.id,
                )
              }
              containerWidth={containerWidth}
            />
          ))}
        </div>
      </div>

      {/* ── Methodology ──────────────────────────────────── */}
      <div className="mb-12">
        <div className="card bg-[var(--background)] border-dashed">
          <h3 className="text-xs font-semibold tracking-[0.15em] text-[var(--muted)] mb-2">
            METHODOLOGY & SOURCES
          </h3>
          <p className="text-xs text-[var(--muted)] leading-relaxed mb-3">
            This brief is generated from publicly available Canadian government
            data. Every assertion links to a primary source. Signal confidence
            scores reflect the strength of cross-referenced connections, not
            editorial judgment.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              {
                label: "CanadaBuys",
                url: "https://buyandsell.gc.ca/",
              },
              {
                label: "Lobby Commissioner",
                url: "https://lobbycanada.gc.ca/",
              },
              {
                label: "CIEC",
                url: "https://ciec-ccie.parl.gc.ca/",
              },
              {
                label: "Elections Canada",
                url: "https://www.elections.ca/",
              },
              {
                label: "Global Affairs Canada",
                url: "https://www.international.gc.ca/",
              },
              {
                label: "Open Government",
                url: "https://open.canada.ca/",
              },
            ].map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 rounded bg-[var(--accent-dim)] text-[var(--accent)] hover:underline transition-colors"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Side nav dots ────────────────────────────────── */}
      <div className="side-nav-dots fixed right-6 top-1/2 -translate-y-1/2 flex-col gap-2 z-10 hidden sm:flex">
        {brief.sections.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToSection(i)}
            className={`w-2 h-2 rounded-full transition-all ${
              activeSection === i
                ? "bg-[var(--primary)] scale-125"
                : "bg-[var(--border)] hover:bg-[var(--muted)]"
            }`}
            aria-label={`Go to section ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
