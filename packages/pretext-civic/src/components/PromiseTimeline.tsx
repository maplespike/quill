import { motion } from "motion/react";
import { useMemo } from "react";
import { defaultTheme } from "../theme/dark";

export interface PromiseEntry {
  id: string;
  title: string;
  date: string;
  description?: string;
  status?: "fulfilled" | "broken" | "in_progress" | "pending";
}

export interface EventEntry {
  id: string;
  title: string;
  date: string;
  amount?: number;
  description?: string;
  type: "spending" | "contract" | "lobbying" | "donation" | "disclosure";
}

export interface PromiseTimelineProps {
  /** Promise/mandate commitment markers (shown above the line) */
  promises: PromiseEntry[];
  /** Real-world events (shown below the line) */
  events: EventEntry[];
  /** Time range [start, end] */
  timeRange: [Date, Date];
  width: number;
  height?: number;
  onPromiseClick?: (id: string) => void;
  onEventClick?: (id: string) => void;
}

const EVENT_COLORS: Record<EventEntry["type"], string> = {
  spending: defaultTheme.colors.gold,
  contract: defaultTheme.colors.cyan,
  lobbying: defaultTheme.colors.red,
  donation: defaultTheme.colors.purple,
  disclosure: defaultTheme.colors.blue,
};

const STATUS_COLORS: Record<string, string> = {
  fulfilled: defaultTheme.colors.green,
  broken: defaultTheme.colors.red,
  in_progress: defaultTheme.colors.amber,
  pending: defaultTheme.colors.textMuted,
};

export function PromiseTimeline({
  promises,
  events,
  timeRange,
  width,
  height = 300,
  onPromiseClick,
  onEventClick,
}: PromiseTimelineProps) {
  const padding = { top: 60, bottom: 80, left: 40, right: 40 };
  const trackWidth = width - padding.left - padding.right;
  const trackY = height / 2;

  const timeScale = useMemo(() => {
    const [start, end] = timeRange;
    const range = end.getTime() - start.getTime();
    return (date: Date | string) => {
      const d = typeof date === "string" ? new Date(date) : date;
      return (
        padding.left + ((d.getTime() - start.getTime()) / range) * trackWidth
      );
    };
  }, [timeRange, trackWidth, padding.left]);

  // Compute gaps: time ranges between promises and nearest matching events
  const gaps = useMemo(() => {
    const result: Array<{ x1: number; x2: number; promiseId: string }> = [];
    for (const p of promises) {
      const px = timeScale(p.date);
      // Find the closest event
      let closestDist = Number.POSITIVE_INFINITY;
      for (const e of events) {
        const dist = Math.abs(timeScale(e.date) - px);
        if (dist < closestDist) closestDist = dist;
      }
      // If the gap is significant, highlight it
      if (closestDist > 30) {
        result.push({ x1: px, x2: px + closestDist, promiseId: p.id });
      }
    }
    return result;
  }, [promises, events, timeScale]);

  const svgStyle: React.CSSProperties = {
    width,
    height,
    fontFamily: defaultTheme.fonts.sans,
    overflow: "visible",
  };

  return (
    <motion.svg
      style={svgStyle}
      viewBox={`0 0 ${width} ${height}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <defs>
        <linearGradient id="gap-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop
            offset="0%"
            stopColor={defaultTheme.colors.amber}
            stopOpacity={0}
          />
          <stop
            offset="50%"
            stopColor={defaultTheme.colors.amber}
            stopOpacity={0.15}
          />
          <stop
            offset="100%"
            stopColor={defaultTheme.colors.amber}
            stopOpacity={0}
          />
        </linearGradient>
        <filter id="timeline-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main track line */}
      <motion.line
        x1={padding.left}
        y1={trackY}
        x2={width - padding.right}
        y2={trackY}
        stroke={defaultTheme.colors.border}
        strokeWidth={1}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8 }}
      />

      {/* Gap highlights */}
      {gaps.map((gap, i) => (
        <rect
          key={`gap-${i}`}
          x={gap.x1}
          y={trackY - 20}
          width={Math.abs(gap.x2 - gap.x1)}
          height={40}
          fill="url(#gap-gradient)"
          rx={4}
        />
      ))}

      {/* Promises (above) */}
      {promises.map((p, i) => {
        const x = timeScale(p.date);
        const color = STATUS_COLORS[p.status ?? "pending"];
        return (
          <motion.g
            key={`promise-${p.id}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            onClick={() => onPromiseClick?.(p.id)}
            style={{ cursor: onPromiseClick ? "pointer" : "default" }}
          >
            {/* Connector line */}
            <line
              x1={x}
              y1={trackY - 4}
              x2={x}
              y2={trackY - 30}
              stroke={color}
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            {/* Marker */}
            <circle
              cx={x}
              cy={trackY - 34}
              r={5}
              fill={color}
              filter="url(#timeline-glow)"
            />
            {/* Label */}
            <text
              x={x}
              y={trackY - 48}
              textAnchor="middle"
              fill={color}
              fontSize={10}
              fontWeight={600}
            >
              {p.title.length > 22 ? `${p.title.slice(0, 20)}…` : p.title}
            </text>
            {p.status && (
              <text
                x={x}
                y={trackY - 60}
                textAnchor="middle"
                fill={defaultTheme.colors.textMuted}
                fontSize={8}
              >
                {p.status.replace("_", " ")}
              </text>
            )}
          </motion.g>
        );
      })}

      {/* Events (below) */}
      {events.map((e, i) => {
        const x = timeScale(e.date);
        const color = EVENT_COLORS[e.type];
        return (
          <motion.g
            key={`event-${e.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            onClick={() => onEventClick?.(e.id)}
            style={{ cursor: onEventClick ? "pointer" : "default" }}
          >
            {/* Connector line */}
            <line
              x1={x}
              y1={trackY + 4}
              x2={x}
              y2={trackY + 28}
              stroke={color}
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            {/* Marker diamond */}
            <polygon
              points={`${x},${trackY + 28} ${x + 5},${trackY + 33} ${x},${trackY + 38} ${x - 5},${trackY + 33}`}
              fill={color}
            />
            {/* Label */}
            <text
              x={x}
              y={trackY + 52}
              textAnchor="middle"
              fill={color}
              fontSize={10}
              fontWeight={500}
            >
              {e.title.length > 20 ? `${e.title.slice(0, 18)}…` : e.title}
            </text>
            {e.amount !== undefined && (
              <text
                x={x}
                y={trackY + 64}
                textAnchor="middle"
                fill={defaultTheme.colors.textMuted}
                fontSize={9}
              >
                ${(e.amount / 1_000_000).toFixed(1)}M
              </text>
            )}
          </motion.g>
        );
      })}

      {/* Time axis ticks */}
      {(() => {
        const [start, end] = timeRange;
        const months =
          (end.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000);
        const tickCount = Math.min(12, Math.max(4, Math.floor(months)));
        const ticks: Date[] = [];
        for (let i = 0; i <= tickCount; i++) {
          ticks.push(
            new Date(
              start.getTime() +
                (i / tickCount) * (end.getTime() - start.getTime()),
            ),
          );
        }
        return ticks.map((d, i) => {
          const x = timeScale(d);
          return (
            <g key={`tick-${i}`}>
              <line
                x1={x}
                y1={trackY + 2}
                x2={x}
                y2={trackY + 8}
                stroke={defaultTheme.colors.border}
                strokeWidth={1}
              />
              <text
                x={x}
                y={height - padding.bottom / 2}
                textAnchor="middle"
                fill={defaultTheme.colors.textMuted}
                fontSize={9}
              >
                {d.toLocaleDateString("en-CA", {
                  month: "short",
                  year: "2-digit",
                })}
              </text>
            </g>
          );
        });
      })()}
    </motion.svg>
  );
}
