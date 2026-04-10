/**
 * usePretextLines — Get actual line-by-line text data from pretext.
 *
 * Returns materialized lines with exact widths and positions.
 * Used by PretextText, FlowText, and anywhere you need to render
 * pretext-laid text into the DOM.
 */
import {
	type LayoutLine,
	layoutWithLines,
	type PreparedTextWithSegments,
	type PrepareOptions,
	prepareWithSegments,
} from "@chenglou/pretext";
import { useEffect, useMemo, useRef, useState } from "react";

export interface PretextLinesResult {
	/** Materialized lines with text and widths */
	lines: LayoutLine[];
	/** Total text height in px */
	height: number;
	/** Number of wrapped lines */
	lineCount: number;
	/** Whether font loading + preparation is complete */
	isReady: boolean;
}

/**
 * Get individual line data for manual rendering.
 *
 * ```tsx
 * const { lines, height } = usePretextLines(text, '15px Georgia', 600, 24)
 * // lines = [{ text: "Hello world", width: 87.5, start: ..., end: ... }, ...]
 * ```
 */
export function usePretextLines(
	text: string,
	font: string,
	maxWidth: number,
	lineHeight: number,
	options?: PrepareOptions,
): PretextLinesResult {
	const [fontsReady, setFontsReady] = useState(false);
	const preparedRef = useRef<PreparedTextWithSegments | null>(null);
	const prevDepsRef = useRef("");

	useEffect(() => {
		document.fonts.ready.then(() => setFontsReady(true));
	}, []);

	const depsKey = `${text}│${font}│${options?.whiteSpace ?? ""}│${options?.wordBreak ?? ""}`;

	return useMemo(() => {
		if (!fontsReady || !text) {
			return { lines: [], height: 0, lineCount: 0, isReady: false };
		}

		// Only re-prepare when text or font changes
		if (depsKey !== prevDepsRef.current || !preparedRef.current) {
			prevDepsRef.current = depsKey;
			preparedRef.current = prepareWithSegments(text, font, options);
		}

		// Layout with materialized lines
		const result = layoutWithLines(preparedRef.current, maxWidth, lineHeight);
		return {
			lines: result.lines,
			height: result.height,
			lineCount: result.lineCount,
			isReady: true,
		};
	}, [fontsReady, text, font, maxWidth, lineHeight, depsKey]);
}
