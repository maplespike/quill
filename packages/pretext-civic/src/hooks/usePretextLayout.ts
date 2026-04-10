/**
 * usePretextLayout — Legacy hook, now backed by real @chenglou/pretext.
 *
 * Previously used require() which always failed in ESM,
 * falling back to charsPerLine slicing. Now uses the real API:
 *   prepare() for one-time measurement
 *   layoutWithLines() for line-by-line output
 *
 * Backward-compatible return type for existing consumers.
 */
import {
  layoutWithLines,
  type PreparedTextWithSegments,
  prepareWithSegments,
} from "@chenglou/pretext";
import { useEffect, useMemo, useRef, useState } from "react";

export interface PretextLayoutLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PretextLayoutResult {
  lines: string[];
  height: number;
  layout: {
    lines: PretextLayoutLine[];
  } | null;
}

/**
 * Layout text with real pretext measurement.
 *
 * ```ts
 * const result = usePretextLayout("Hello world", "Georgia", 300, {
 *   fontSize: 16, fontWeight: 400, lineHeight: 1.5
 * })
 * ```
 */
export function usePretextLayout(
  text: string,
  fontFamily: string,
  width: number,
  options?: {
    fontSize?: number;
    fontWeight?: number;
    lineHeight?: number;
  },
): PretextLayoutResult | null {
  const fontSize = options?.fontSize ?? 16;
  const fontWeight = options?.fontWeight ?? 400;
  const lineHeightRatio = options?.lineHeight ?? 1.5;
  const lineHeightPx = Math.round(fontSize * lineHeightRatio);

  const [fontsReady, setFontsReady] = useState(false);
  const preparedRef = useRef<PreparedTextWithSegments | null>(null);
  const prevDepsRef = useRef("");

  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const depsKey = `${text}│${font}`;

  return useMemo(() => {
    if (typeof window === "undefined" || !fontsReady || !text || width <= 0) {
      return null;
    }

    // Re-prepare only when text/font changes (expensive)
    if (depsKey !== prevDepsRef.current || !preparedRef.current) {
      prevDepsRef.current = depsKey;
      try {
        preparedRef.current = prepareWithSegments(text, font);
      } catch {
        // Graceful fallback
        const charsPerLine = Math.max(1, Math.floor(width / (fontSize * 0.6)));
        const lines: string[] = [];
        for (let i = 0; i < text.length; i += charsPerLine) {
          lines.push(text.slice(i, i + charsPerLine));
        }
        return {
          lines: lines.length > 0 ? lines : [text],
          height: (lines.length || 1) * lineHeightPx,
          layout: null,
        };
      }
    }

    // Layout is pure arithmetic — cheap to re-run
    const result = layoutWithLines(preparedRef.current, width, lineHeightPx);

    const layoutLines: PretextLayoutLine[] = result.lines.map((l, i) => ({
      text: l.text,
      x: 0,
      y: i * lineHeightPx,
      width: l.width,
      height: lineHeightPx,
    }));

    return {
      lines: layoutLines.map((l) => l.text),
      height: result.height,
      layout: { lines: layoutLines },
    };
  }, [fontsReady, text, font, width, fontSize, lineHeightPx, depsKey]);
}
