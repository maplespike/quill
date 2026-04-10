/**
 * usePretextShrinkwrap — Find the tightest width that preserves line count.
 *
 * CSS `fit-content` works for single lines but leaves dead space for multiline.
 * Pretext binary-searches over widths to find the narrowest container that
 * still keeps the text at the same line count. Perfect for:
 * - Chat message bubbles
 * - Signal cards
 * - Tooltip labels
 * - Image captions
 *
 * ~20 iterations × ~0.0002ms = ~0.004ms total. Zero DOM reads.
 */
import {
	measureLineStats,
	measureNaturalWidth,
	type PreparedTextWithSegments,
	prepareWithSegments,
} from "@chenglou/pretext";
import { useEffect, useMemo, useRef, useState } from "react";

export interface ShrinkwrapResult {
	/** Optimal width in px */
	width: number;
	/** Height at optimal width */
	height: number;
	/** Line count */
	lineCount: number;
	/** Whether computation is ready */
	isReady: boolean;
}

/**
 * Find the tightest bounding box for multiline text.
 *
 * ```tsx
 * const { width, height } = usePretextShrinkwrap(
 *   signalSummary, '13px Inter', 20, 380, 3
 * )
 * ```
 */
export function usePretextShrinkwrap(
	text: string,
	font: string,
	lineHeight: number,
	maxWidth: number,
	maxLines = 10,
): ShrinkwrapResult {
	const [fontsReady, setFontsReady] = useState(false);
	const preparedRef = useRef<PreparedTextWithSegments | null>(null);
	const prevDepsRef = useRef("");

	useEffect(() => {
		document.fonts.ready.then(() => setFontsReady(true));
	}, []);

	const depsKey = `${text}│${font}`;

	return useMemo(() => {
		if (!fontsReady || !text) {
			return { width: 0, height: 0, lineCount: 0, isReady: false };
		}

		if (depsKey !== prevDepsRef.current || !preparedRef.current) {
			prevDepsRef.current = depsKey;
			preparedRef.current = prepareWithSegments(text, font);
		}

		const prepared = preparedRef.current;

		// Get baseline stats at maxWidth
		const statsAtMax = measureLineStats(prepared, maxWidth);
		if (statsAtMax.lineCount > maxLines) {
			// Text overflows — return max stats
			return {
				width: maxWidth,
				height: statsAtMax.lineCount * lineHeight,
				lineCount: statsAtMax.lineCount,
				isReady: true,
			};
		}

		// Get natural width (widest single line)
		const natural = measureNaturalWidth(prepared);

		// If text fits on one line at natural width, return natural
		if (statsAtMax.lineCount <= 1) {
			return {
				width: Math.ceil(natural),
				height: lineHeight,
				lineCount: 1,
				isReady: true,
			};
		}

		// Binary search: narrowest width that keeps the same line count
		const targetLines = statsAtMax.lineCount;
		let lo = Math.max(50, natural * 0.3);
		let hi = maxWidth;
		let best = maxWidth;

		for (let i = 0; i < 24; i++) {
			const mid = Math.floor((lo + hi) / 2);
			const stats = measureLineStats(prepared, mid);
			if (stats.lineCount <= targetLines) {
				best = mid;
				hi = mid;
			} else {
				lo = mid + 1;
			}
		}

		const finalStats = measureLineStats(prepared, best);
		return {
			width: Math.ceil(best),
			height: finalStats.lineCount * lineHeight,
			lineCount: finalStats.lineCount,
			isReady: true,
		};
	}, [fontsReady, text, font, lineHeight, maxWidth, maxLines, depsKey]);
}
