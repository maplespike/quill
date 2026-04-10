"use client";

import { useState, useMemo } from "react";
import { timelineEvents, sourceLinks, type TimelineEvent } from "../lib/data";

const TYPE_COLORS: Record<string, string> = {
  contract: "var(--signal-procurement)",
  lobbying: "var(--signal-revolving)",
  donation: "var(--signal-donation)",
  disclosure: "var(--signal-spousal)",
  appointment: "var(--signal-international)",
  filing: "var(--signal-sole-source)",
};

const TYPE_ICONS: Record<string, string> = {
  contract: "📄",
  lobbying: "🏛️",
  donation: "💰",
  disclosure: "📋",
  appointment: "👤",
  filing: "📝",
};

const TYPE_LABELS: Record<string, string> = {
  contract: "Contract",
  lobbying: "Lobbying",
  donation: "Donation",
  disclosure: "Disclosure",
  appointment: "Appointment",
  filing: "Filing",
};

export function TimelineView() {
  const [filter, setFilter] = useState<string>("all");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    const events =
      filter === "all"
        ? timelineEvents
        : timelineEvents.filter((e) => e.type === filter);
    return [...events].sort((a, b) => b.date.localeCompare(a.date));
  }, [filter]);

  // Group by year-month
  const grouped = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    for (const e of filteredEvents) {
      const key = e.date.slice(0, 7); // YYYY-MM
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredEvents]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of timelineEvents) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    }
    return counts;
  }, []);

  return (
    <div className="flex h-full">
      {/* ── Left: Filters ───────────────────────────────── */}
      <div className="w-56 border-r border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-4 overflow-auto">
        <div>
          <h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-3">
            EVENT TYPE
          </h3>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setFilter("all")}
              className={
                "text-left text-xs px-2 py-1.5 rounded transition-colors " +
                (filter === "all"
                  ? "bg-[var(--accent-dim)] text-[var(--primary)]"
                  : "text-[var(--muted)] hover:bg-[var(--card-hover)]")
              }
            >
              All Events ({timelineEvents.length})
            </button>
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={
                  "text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center gap-2 " +
                  (filter === type
                    ? "bg-[var(--accent-dim)]"
                    : "hover:bg-[var(--card-hover)]")
                }
              >
                <span>{TYPE_ICONS[type]}</span>
                <span
                  className={
                    filter === type
                      ? "text-[var(--primary)]"
                      : "text-[var(--muted)]"
                  }
                >
                  {label}
                </span>
                <span className="ml-auto opacity-50">
                  {typeCounts[type] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold tracking-widest text-[var(--muted)] mb-2">
            DATA SOURCES
          </h3>
          <div className="flex flex-col gap-1.5">
            {Object.entries(sourceLinks).map(([key, src]) => (
              <a
                key={key}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[var(--muted)] hover:text-[var(--primary)] transition-colors leading-relaxed"
              >
                {src.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-auto">
          <div className="text-[9px] text-[var(--muted)] leading-relaxed">
            All data sourced from official Canadian government portals. Every
            event links to a primary source.
          </div>
        </div>
      </div>

      {/* ── Main: Timeline ──────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-semibold tracking-widest text-[var(--muted)]">
            EVENT TIMELINE ({filteredEvents.length} events)
          </h2>
          <div className="flex gap-2">
            <span className="text-[10px] text-[var(--muted)]">
              {timelineEvents.length} events spanning{" "}
              {timelineEvents[timelineEvents.length - 1]?.date.slice(0, 4)}–
              {timelineEvents[0]?.date.slice(0, 4)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {grouped.map(([monthKey, events]) => {
            const [year, month] = monthKey.split("-");
            const monthName = new Date(
              parseInt(year),
              parseInt(month) - 1,
            ).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
            return (
              <div key={monthKey}>
                {/* Month header */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="text-xs font-bold tracking-widest"
                    style={{ color: "var(--primary)" }}
                  >
                    {monthName.toUpperCase()}
                  </div>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[10px] text-[var(--muted)]">
                    {events.length} events
                  </span>
                </div>

                {/* Events */}
                <div className="flex flex-col gap-2 ml-4 border-l-2 border-[var(--border)] pl-4">
                  {events.map((event) => {
                    const isExpanded =
                      expandedEvent === event.date + event.title;
                    const color = TYPE_COLORS[event.type] || "var(--primary)";
                    const eventId = event.date + event.title;
                    return (
                      <div
                        key={eventId}
                        className="relative cursor-pointer group"
                        onClick={() =>
                          setExpandedEvent(isExpanded ? null : eventId)
                        }
                      >
                        {/* Timeline dot */}
                        <div
                          className="absolute -left-[21px] top-2 w-3 h-3 rounded-full border-2"
                          style={{
                            borderColor: color,
                            backgroundColor: isExpanded
                              ? color
                              : "var(--background)",
                          }}
                        />

                        <div className="card py-2.5 px-3 hover:bg-[var(--card-hover)] transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">
                              {TYPE_ICONS[event.type]}
                            </span>
                            <span className="text-[10px] tabular-nums text-[var(--muted)]">
                              {event.date}
                            </span>
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold"
                              style={{ backgroundColor: color + "20", color }}
                            >
                              {TYPE_LABELS[event.type]}
                            </span>
                          </div>
                          <div className="text-xs font-semibold">
                            {event.title}
                          </div>

                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-[var(--border)]">
                              <p className="text-xs text-[var(--muted)] leading-relaxed mb-2">
                                {event.detail}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-[var(--muted)]">
                                  Entities:
                                </span>
                                {event.entityIds.map((eid) => (
                                  <span
                                    key={eid}
                                    className="intel-chip text-[9px]"
                                  >
                                    {eid
                                      .replace(/org-|person-/g, "")
                                      .replace(/-/g, " ")}
                                  </span>
                                ))}
                              </div>
                              <a
                                href={event.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-block mt-2 text-[10px] text-[var(--primary)] hover:underline"
                              >
                                ↗ View source
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
