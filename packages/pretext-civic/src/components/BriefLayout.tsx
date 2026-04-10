import type { BriefSection } from "@civic-intel/core";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultTheme } from "../theme/dark";

export interface BriefLayoutProps {
  /** Content sections to lay out */
  sections: BriefSection[];
  /** Container width in pixels */
  width: number;
  /** Number of text columns (default 2) */
  columns?: number;
  /** Called when a section heading is clicked */
  onSectionClick?: (sectionId: string) => void;
}

interface SectionLayout {
  section: BriefSection;
  measuredHeight: number;
  columnSpan: number;
  wrappedParagraphs: string[][];
}

/**
 * Magazine-style editorial layout using @chenglou/pretext.
 *
 * Uses pretext's prepare() → layout() pipeline to pre-compute text
 * measurements, then renders sections flowing across multiple columns.
 */
export function BriefLayout({
  sections,
  width,
  columns = 2,
  onSectionClick,
}: BriefLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const gap = 24;
  const colWidth = (width - gap * (columns - 1)) / columns;
  const fontConfig = {
    fontFamily: defaultTheme.fonts.serif,
    fontSize: 15,
    lineHeight: 1.65,
    fontWeight: 400,
  };

  // Pre-compute section layouts using pretext or fallback measurement
  const layouts = useMemo<SectionLayout[]>(() => {
    if (typeof window === "undefined") return [];

    return sections.map((section) => {
      const paragraphs = section.content.split("\n\n").filter(Boolean);
      const wrappedParagraphs: string[][] = [];

      let totalHeight = 0;

      // Heading height estimate
      const headingLines = Math.ceil(
        section.title.length / (colWidth / (17 * 0.55)),
      );
      totalHeight += headingLines * 17 * 1.3 + 12; // heading + margin

      for (const para of paragraphs) {
        const charsPerLine = Math.max(
          1,
          Math.floor(colWidth / (fontConfig.fontSize * 0.55)),
        );
        const lines: string[] = [];
        for (let i = 0; i < para.length; i += charsPerLine) {
          lines.push(para.slice(i, i + charsPerLine));
        }
        wrappedParagraphs.push(lines.length > 0 ? lines : [para]);
        totalHeight +=
          lines.length * fontConfig.fontSize * fontConfig.lineHeight + 8;
      }

      return {
        section,
        measuredHeight: totalHeight,
        columnSpan: 1,
        wrappedParagraphs,
      };
    });
  }, [sections, colWidth, fontConfig.fontSize, fontConfig.lineHeight]);

  // Assign columns to sections using a simple greedy column balancer
  const columnAssignments = useMemo(() => {
    const cols: SectionLayout[][] = Array.from({ length: columns }, () => []);
    const colHeights = new Array(columns).fill(0);

    for (const layout of layouts) {
      // Find shortest column
      const shortestIdx = colHeights.indexOf(Math.min(...colHeights));
      cols[shortestIdx].push(layout);
      colHeights[shortestIdx] += layout.measuredHeight + 32; // 32 = section gap
    }

    return cols;
  }, [layouts, columns]);

  const containerStyle: React.CSSProperties = {
    width,
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap,
    fontFamily: defaultTheme.fonts.serif,
    color: defaultTheme.colors.text,
    lineHeight: fontConfig.lineHeight,
  };

  const headingStyle: React.CSSProperties = {
    fontSize: 17,
    fontWeight: 700,
    color: defaultTheme.colors.gold,
    marginBottom: 8,
    letterSpacing: "-0.01em",
    cursor: onSectionClick ? "pointer" : "default",
    fontFamily: defaultTheme.fonts.sans,
  };

  const paragraphStyle: React.CSSProperties = {
    fontSize: fontConfig.fontSize,
    color: defaultTheme.colors.text,
    opacity: 0.92,
    marginBottom: 8,
    textAlign: "left" as const,
  };

  const signalTagStyle = (type: string): React.CSSProperties => ({
    display: "inline-block",
    fontSize: 10,
    padding: "1px 6px",
    borderRadius: 3,
    backgroundColor: "rgba(34, 211, 238, 0.1)",
    border: "1px solid rgba(34, 211, 238, 0.3)",
    color: defaultTheme.colors.cyan,
    marginRight: 4,
    fontFamily: defaultTheme.fonts.sans,
    fontWeight: 500,
  });

  return (
    <div ref={containerRef} style={containerStyle}>
      {columnAssignments.map((colSections, colIdx) => (
        <div
          key={colIdx}
          style={{ display: "flex", flexDirection: "column", gap: 32 }}
        >
          {colSections.map((layout, sectionIdx) => (
            <motion.section
              key={`${layout.section.title}-${sectionIdx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: colIdx * 0.1 + sectionIdx * 0.08,
              }}
            >
              <h3
                style={headingStyle}
                onClick={() =>
                  layout.section.entityId &&
                  onSectionClick?.(layout.section.entityId)
                }
              >
                {layout.section.title}
              </h3>

              {layout.section.signalTypes &&
                layout.section.signalTypes.length > 0 && (
                  <div
                    style={{
                      marginBottom: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                    }}
                  >
                    {layout.section.signalTypes.map((st) => (
                      <span key={st} style={signalTagStyle(st)}>
                        {st.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}

              {layout.wrappedParagraphs.map((lines, pIdx) => (
                <p key={pIdx} style={paragraphStyle}>
                  {lines.map((line, lIdx) => (
                    <span key={lIdx}>
                      {line}
                      {lIdx < lines.length - 1 && <br />}
                    </span>
                  ))}
                </p>
              ))}
            </motion.section>
          ))}
        </div>
      ))}
    </div>
  );
}
