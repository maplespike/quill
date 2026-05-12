import type { SignalType } from "@civic-intel/core";
import { AnimatePresence, motion } from "motion/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { defaultTheme } from "../theme/dark";

export interface IntelChipProps {
  /** Short inline label, e.g. "lobbied 4x", "$45M contract" */
  label: string;
  /** Signal category driving the colour */
  type: SignalType;
  /** Detail content shown in the glassmorphic popover */
  details: ReactNode;
  /** Fired when the chip expands */
  onExpand?: () => void;
}

const signalColorMap: Record<
  SignalType,
  { bg: string; border: string; text: string; glow: string }
> = {
  procurement_lobbying_overlap: {
    bg: "rgba(239, 68, 68, 0.15)",
    border: "#ef4444",
    text: "#fca5a5",
    glow: "rgba(239, 68, 68, 0.25)",
  },
  revolving_door: {
    bg: "rgba(245, 158, 11, 0.15)",
    border: "#f59e0b",
    text: "#fcd34d",
    glow: "rgba(245, 158, 11, 0.25)",
  },
  spousal_interest_proximity: {
    bg: "rgba(34, 211, 238, 0.15)",
    border: "#22d3ee",
    text: "#67e8f9",
    glow: "rgba(34, 211, 238, 0.25)",
  },
  sole_source_heavy_lobbying: {
    bg: "rgba(239, 68, 68, 0.15)",
    border: "#ef4444",
    text: "#fca5a5",
    glow: "rgba(239, 68, 68, 0.25)",
  },
  donation_proximity_correlation: {
    bg: "rgba(212, 168, 83, 0.15)",
    border: "#d4a853",
    text: "#e8c97a",
    glow: "rgba(212, 168, 83, 0.25)",
  },
  mandate_divergence: {
    bg: "rgba(245, 158, 11, 0.15)",
    border: "#f59e0b",
    text: "#fcd34d",
    glow: "rgba(245, 158, 11, 0.25)",
  },
  international_layering: {
    bg: "rgba(167, 139, 250, 0.15)",
    border: "#a78bfa",
    text: "#c4b5fd",
    glow: "rgba(167, 139, 250, 0.25)",
  },
};

export function IntelChip({ label, type, details, onExpand }: IntelChipProps) {
  const [expanded, setExpanded] = useState(false);
  const chipRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const colors =
    signalColorMap[type] ?? signalColorMap.procurement_lobbying_overlap;

  const toggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next) onExpand?.();
  }, [expanded, onExpand]);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        chipRef.current &&
        !chipRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded]);

  const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 10px",
    borderRadius: defaultTheme.borderRadius,
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: defaultTheme.fonts.sans,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    transition: "box-shadow 0.2s ease",
    boxShadow: expanded ? `0 0 12px ${colors.glow}` : "none",
  };

  const popoverStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: "50%",
    transform: "translateX(-50%)",
    minWidth: 240,
    maxWidth: 380,
    padding: 16,
    borderRadius: 10,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    backdropFilter: "blur(16px) saturate(1.4)",
    border: `1px solid ${colors.border}`,
    boxShadow: `0 12px 40px ${colors.glow}, 0 0 0 1px rgba(255,255,255,0.04)`,
    zIndex: 9999,
    color: defaultTheme.colors.text,
    fontSize: 13,
    lineHeight: 1.6,
    fontFamily: defaultTheme.fonts.sans,
  };

  return (
    <span
      ref={chipRef}
      style={{
        position: "relative",
        display: "inline-flex",
        verticalAlign: "middle",
      }}
    >
      <span
        style={chipStyle}
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && toggle()}
      >
        {label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          style={{
            opacity: 0.6,
            transition: "transform 0.2s",
            transform: expanded ? "rotate(180deg)" : "rotate(0)",
          }}
        >
          <path
            d="M2 4 L5 7 L8 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </span>

      <AnimatePresence>
        {expanded && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={popoverStyle}
          >
            {details}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
