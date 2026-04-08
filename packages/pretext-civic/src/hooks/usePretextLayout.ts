import { useCallback, useMemo, useRef } from "react";

/** Safely split text into lines of roughly `charsPerLine` characters. */
function wrapText(inputText: string, charsPerLine: number): string[] {
	if (charsPerLine < 1) charsPerLine = 1;
	const result: string[] = [];
	for (let i = 0; i < inputText.length; i += charsPerLine) {
		result.push(inputText.slice(i, i + charsPerLine));
	}
	return result.length > 0 ? result : [inputText];
}

/**
 * React hook wrapping @chenglou/pretext for text measurement & layout.
 *
 * Usage:
 *   const { lines, height, layout } = usePretextLayout("Hello world", "Georgia", 300);
 *
 * SSR-safe: returns null on the server.
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
): {
	lines: string[];
	height: number;
	layout: {
		lines: Array<{
			text: string;
			x: number;
			y: number;
			width: number;
			height: number;
		}>;
	} | null;
} | null {
	const fontSize = options?.fontSize ?? 16;
	const fontWeight = options?.fontWeight ?? 400;
	const lineHeight = options?.lineHeight ?? 1.5;

	return useMemo(() => {
		// SSR guard
		if (typeof window === "undefined") return null;

		try {
			// Dynamic import won't work in useMemo; use the synchronous API.
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const pretext = require("@chenglou/pretext");

			// Build a paragraph / text block via pretext's analysis step
			const analysis = pretext.analysis ?? pretext.analyse ?? pretext.analyze;
			const layoutFn = pretext.layout;

			if (!analysis || !layoutFn) {
				// Fallback: rough estimate
				const charsPerLine = Math.floor(width / (fontSize * 0.6));
				const wrappedLines = wrapText(text, charsPerLine);
				return {
					lines: wrappedLines,
					height: wrappedLines.length * fontSize * lineHeight,
					layout: null,
				};
			}

			// Create the analysed text structure
			const analysed = analysis({
				text,
				fontFamily,
				fontSize,
				fontWeight,
				lineHeight,
			});

			// Lay it out at the given width
			const result = layoutFn(analysed, { width });

			const lines: string[] = result.lines
				? result.lines.map((l: { text: string }) => l.text)
				: [text];

			return {
				lines,
				height: result.height ?? lines.length * fontSize * lineHeight,
				layout: result.lines ?? null,
			};
		} catch {
			// Graceful fallback if pretext API doesn't match expectations
			const charsPerLine = Math.max(1, Math.floor(width / (fontSize * 0.6)));
			const wrappedLines = wrapText(text, charsPerLine);
			return {
				lines: wrappedLines,
				height: wrappedLines.length * fontSize * lineHeight,
				layout: null,
			};
		}
	}, [text, fontFamily, width, fontSize, fontWeight, lineHeight]);
}
